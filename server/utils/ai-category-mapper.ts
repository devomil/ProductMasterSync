import Anthropic from '@anthropic-ai/sdk';

/*
Reference: blueprint:javascript_anthropic
The newest Anthropic model is "claude-sonnet-4-20250514", not "claude-3-7-sonnet-20250219", "claude-3-5-sonnet-20241022" nor "claude-3-sonnet-20240229". 
If the user doesn't specify a model, always prefer using "claude-sonnet-4-20250514" as it is the latest model.
*/

const DEFAULT_MODEL_STR = "claude-sonnet-4-20250514";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ProductSample {
  name?: string;
  description?: string;
  category?: string;
  manufacturerName?: string;
  attributes?: Record<string, any>;
}

export interface CategorySuggestion {
  categoryName: string;
  confidence: number; // 0-100
  reasoning: string;
  googleCategory?: string;
}

export interface CategoryMappingResult {
  supplierCategoryName: string;
  suggestions: CategorySuggestion[];
  detectedIndustry: string;
  productCount: number;
}

/**
 * Analyze product samples and suggest category mappings
 */
export async function suggestCategoryMappings(
  supplierName: string,
  productSamples: ProductSample[],
  existingCategories: Array<{ id: number; name: string; code: string; path: string | null }>,
  supplierCategories: string[]
): Promise<CategoryMappingResult[]> {
  try {
    // Group products by their supplier category
    const categoryGroups = new Map<string, ProductSample[]>();
    productSamples.forEach(product => {
      const category = product.category || 'Uncategorized';
      if (!categoryGroups.has(category)) {
        categoryGroups.set(category, []);
      }
      categoryGroups.get(category)!.push(product);
    });

    const results: CategoryMappingResult[] = [];

    // Process each category group
    for (const [supplierCategory, products] of Array.from(categoryGroups.entries())) {
      // Sample up to 5 products from each category for analysis
      const sampleProducts = products.slice(0, 5);
      
      const prompt = `You are an expert product categorization AI. Analyze these products from supplier "${supplierName}" in category "${supplierCategory}" and suggest the best master category mapping.

**Product Samples:**
${sampleProducts.map((p: ProductSample, i: number) => `
Product ${i + 1}:
- Name: ${p.name || 'N/A'}
- Description: ${p.description || 'N/A'}
- Manufacturer: ${p.manufacturerName || 'N/A'}
- Category: ${p.category || 'N/A'}
`).join('\n')}

**Existing Master Categories:**
${existingCategories.map(c => `- ${c.name} (${c.code})${c.path ? ` - Path: ${c.path}` : ''}`).join('\n')}

**Task:**
1. Determine which existing master category best fits these products, OR suggest a new category name if none match well
2. Detect the industry (e.g., marine, electronics, tools, automotive, home_goods, sporting_goods, etc.)
3. Suggest an appropriate Google Merchant category for these products
4. Provide confidence scores (0-100) and reasoning

Respond in JSON format:
{
  "suggestions": [
    {
      "categoryName": "exact name from existing categories OR new category name",
      "confidence": 85,
      "reasoning": "brief explanation",
      "googleCategory": "Google Merchant category path"
    }
  ],
  "detectedIndustry": "industry name",
  "notes": "any additional observations"
}

Provide 1-3 suggestions, ordered by confidence (highest first).`;

      const response = await anthropic.messages.create({
        model: DEFAULT_MODEL_STR,
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const textContent = response.content[0];
      if (textContent.type !== 'text') {
        console.error('Unexpected response type from AI');
        continue;
      }

      // Parse the AI response
      const aiResult = JSON.parse(textContent.text);
      
      results.push({
        supplierCategoryName: supplierCategory,
        suggestions: aiResult.suggestions || [],
        detectedIndustry: aiResult.detectedIndustry || 'general',
        productCount: products.length
      });
    }

    return results;
  } catch (error) {
    console.error('Error in AI category mapping:', error);
    throw new Error(`AI category mapping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Suggest Google category for a single product
 */
export async function suggestGoogleCategory(
  productName: string,
  productDescription?: string,
  category?: string
): Promise<{ googleCategory: string; confidence: number }> {
  try {
    const prompt = `Suggest the most appropriate Google Merchant category for this product:

Product Name: ${productName}
${productDescription ? `Description: ${productDescription}` : ''}
${category ? `Current Category: ${category}` : ''}

Respond with ONLY a JSON object in this format:
{
  "googleCategory": "Full > Google > Merchant > Category > Path",
  "confidence": 85
}

Use the official Google product taxonomy. Be specific and accurate.`;

    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL_STR,
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const textContent = response.content[0];
    if (textContent.type !== 'text') {
      throw new Error('Unexpected response type from AI');
    }

    const result = JSON.parse(textContent.text);
    return {
      googleCategory: result.googleCategory || '',
      confidence: result.confidence || 0
    };
  } catch (error) {
    console.error('Error suggesting Google category:', error);
    return {
      googleCategory: '',
      confidence: 0
    };
  }
}

/**
 * Detect product overlap between suppliers
 */
export async function detectProductOverlap(
  products1: ProductSample[],
  products2: ProductSample[],
  supplier1Name: string,
  supplier2Name: string
): Promise<{
  overlapPercentage: number;
  matchingProducts: Array<{ product1: ProductSample; product2: ProductSample; confidence: number }>;
  recommendation: string;
}> {
  try {
    // Sample products for comparison
    const sample1 = products1.slice(0, 10);
    const sample2 = products2.slice(0, 10);

    const prompt = `Analyze product overlap between two suppliers:

**Supplier 1 (${supplier1Name}):**
${sample1.map((p, i) => `${i + 1}. ${p.name} - ${p.manufacturerName || 'N/A'}`).join('\n')}

**Supplier 2 (${supplier2Name}):**
${sample2.map((p, i) => `${i + 1}. ${p.name} - ${p.manufacturerName || 'N/A'}`).join('\n')}

Respond with JSON:
{
  "estimatedOverlap": 25,
  "matchingProducts": [
    {
      "index1": 0,
      "index2": 3,
      "confidence": 90,
      "reason": "Same product, different naming"
    }
  ],
  "recommendation": "advice on handling overlap"
}`;

    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL_STR,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const textContent = response.content[0];
    if (textContent.type !== 'text') {
      throw new Error('Unexpected response type from AI');
    }

    const result = JSON.parse(textContent.text);
    
    const matchingProducts = result.matchingProducts?.map((match: any) => ({
      product1: sample1[match.index1],
      product2: sample2[match.index2],
      confidence: match.confidence
    })) || [];

    return {
      overlapPercentage: result.estimatedOverlap || 0,
      matchingProducts,
      recommendation: result.recommendation || ''
    };
  } catch (error) {
    console.error('Error detecting product overlap:', error);
    return {
      overlapPercentage: 0,
      matchingProducts: [],
      recommendation: 'Error analyzing overlap'
    };
  }
}

/**
 * Normalize category names from different suppliers
 */
export async function normalizeCategoryNames(
  categoryVariants: string[]
): Promise<{ normalizedName: string; confidence: number }> {
  try {
    const prompt = `These are category names from different suppliers that likely refer to the same category:

${categoryVariants.map((cat, i) => `${i + 1}. "${cat}"`).join('\n')}

Suggest a single, normalized category name that best represents all of these. Respond with JSON:
{
  "normalizedName": "the normalized category name",
  "confidence": 90
}`;

    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL_STR,
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const textContent = response.content[0];
    if (textContent.type !== 'text') {
      throw new Error('Unexpected response type from AI');
    }

    const result = JSON.parse(textContent.text);
    return {
      normalizedName: result.normalizedName || categoryVariants[0],
      confidence: result.confidence || 0
    };
  } catch (error) {
    console.error('Error normalizing category names:', error);
    return {
      normalizedName: categoryVariants[0] || 'Uncategorized',
      confidence: 0
    };
  }
}
