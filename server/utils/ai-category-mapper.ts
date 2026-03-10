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

/**
 * Strip Markdown code fences from AI response text
 * Claude often wraps JSON in ```json ... ``` which breaks JSON.parse
 */
function stripCodeFences(text: string): string {
  // Remove ```json ... ``` or ``` ... ``` wrappers
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '')
    .trim();
}

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
          content: [
            {
              type: 'text',
              text: prompt
            }
          ]
        }]
      });

      const textContent = response.content[0];
      if (textContent.type !== 'text') {
        console.error('Unexpected response type from AI');
        continue;
      }

      // Parse the AI response with error handling
      let aiResult;
      try {
        const cleanedText = stripCodeFences(textContent.text);
        aiResult = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error('Failed to parse AI response:', textContent.text);
        console.error('Parse error:', parseError);
        continue;
      }
      
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

export interface SupplierCategoryCode {
  code: string;
  count: number;
  sampleProducts: string[];
}

export async function batchMapSupplierCategories(
  supplierName: string,
  categoryCodes: SupplierCategoryCode[],
  existingCategories: Array<{ id: number; name: string; code: string; path: string | null }>
): Promise<CategoryMappingResult[]> {
  const results: CategoryMappingResult[] = [];
  const BATCH_SIZE = 30;
  const batches: SupplierCategoryCode[][] = [];

  for (let i = 0; i < categoryCodes.length; i += BATCH_SIZE) {
    batches.push(categoryCodes.slice(i, i + BATCH_SIZE));
  }

  console.log(`[AI Category] Processing ${categoryCodes.length} category codes in ${batches.length} batches`);

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    console.log(`[AI Category] Batch ${batchIdx + 1}/${batches.length} (${batch.length} codes)`);

    try {
      const categoryList = batch.map((cat, i) =>
        `${i + 1}. Code: "${cat.code}" (${cat.count.toLocaleString()} products)\n   Samples: ${cat.sampleProducts.slice(0, 3).join('; ') || 'N/A'}`
      ).join('\n');

      const existingCatList = existingCategories.length > 0
        ? existingCategories.slice(0, 50).map(c => `- ${c.name}`).join('\n')
        : '(none yet)';

      const prompt = `You are an IT/electronics product categorization expert. Map these supplier category codes from "${supplierName}" to a clean, human-readable category hierarchy.

**Supplier Category Codes to Map:**
${categoryList}

**Existing Master Categories (reuse these when appropriate):**
${existingCatList}

**Instructions:**
- Map each supplier code to a clear category path using " > " separators (e.g., "Networking > Ethernet Cables", "Software > Security > Licenses")
- Codes like "ETHERN | CABL" mean Category "ETHERN" (Ethernet) and Sub Category "CABL" (Cables)
- Codes like "VA-SW | MLIC" mean Category "VA-SW" (Value-Added Software) and Sub Category "MLIC" (Multi-License)
- DEPLOY | SVCS = Deployment Services, EXWARR | SVCS = Extended Warranty Services
- Reuse existing master categories when they fit
- Suggest a Google Merchant category path for each
- Provide confidence (0-100) based on how clear the mapping is
- Keep category names professional and concise

Respond with ONLY a JSON array:
[
  {
    "supplierCode": "ETHERN | CABL",
    "categoryName": "Networking > Ethernet Cables",
    "googleCategory": "Electronics > Networking > Ethernet Cables",
    "confidence": 95,
    "reasoning": "ETHERN = Ethernet networking, CABL = Cables"
  }
]

Map ALL ${batch.length} codes. Do not skip any.`;

      const response = await anthropic.messages.create({
        model: DEFAULT_MODEL_STR,
        max_tokens: 4096,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }]
      });

      const textContent = response.content[0];
      if (textContent.type !== 'text') continue;

      let parsed;
      try {
        parsed = JSON.parse(stripCodeFences(textContent.text));
      } catch {
        console.error(`[AI Category] Failed to parse batch ${batchIdx + 1} response`);
        continue;
      }

      if (Array.isArray(parsed)) {
        for (const mapping of parsed) {
          const matchingCode = batch.find(c => c.code === mapping.supplierCode);
          results.push({
            supplierCategoryName: mapping.supplierCode || '',
            suggestions: [{
              categoryName: mapping.categoryName || mapping.supplierCode,
              confidence: mapping.confidence || 70,
              reasoning: mapping.reasoning || '',
              googleCategory: mapping.googleCategory || ''
            }],
            detectedIndustry: 'electronics',
            productCount: matchingCode?.count || 0
          });
        }
      }

      for (const cat of batch) {
        if (!results.find(r => r.supplierCategoryName === cat.code)) {
          results.push({
            supplierCategoryName: cat.code,
            suggestions: [{
              categoryName: cat.code,
              confidence: 30,
              reasoning: 'AI did not return a mapping for this code',
              googleCategory: ''
            }],
            detectedIndustry: 'electronics',
            productCount: cat.count
          });
        }
      }
    } catch (error) {
      console.error(`[AI Category] Batch ${batchIdx + 1} error:`, (error as Error).message);
      for (const cat of batch) {
        if (!results.find(r => r.supplierCategoryName === cat.code)) {
          results.push({
            supplierCategoryName: cat.code,
            suggestions: [{
              categoryName: cat.code,
              confidence: 0,
              reasoning: `Error: ${(error as Error).message}`,
              googleCategory: ''
            }],
            detectedIndustry: 'electronics',
            productCount: cat.count
          });
        }
      }
    }

    if (batchIdx < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  results.sort((a, b) => b.productCount - a.productCount);
  console.log(`[AI Category] Completed: ${results.length} categories mapped`);
  return results;
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
        content: [
          {
            type: 'text',
            text: prompt
          }
        ]
      }]
    });

    const textContent = response.content[0];
    if (textContent.type !== 'text') {
      throw new Error('Unexpected response type from AI');
    }

    let result;
    try {
      const cleanedText = stripCodeFences(textContent.text);
      result = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse Google category response:', textContent.text);
      throw new Error('Failed to parse AI response');
    }
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

export interface BatchCategoryResult {
  categoryName: string;
  categoryPath: string;
  productIds: number[];
  confidence: number;
}

export async function batchCategorizeProducts(
  products: Array<{ id: number; name: string; manufacturerName: string | null }>,
  batchSize: number = 50
): Promise<BatchCategoryResult[]> {
  const results: BatchCategoryResult[] = [];

  const batches: typeof products[] = [];
  for (let i = 0; i < products.length; i += batchSize) {
    batches.push(products.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    try {
      const productList = batch.map((p, i) => 
        `${i + 1}. [ID:${p.id}] ${p.name} (${p.manufacturerName || 'Unknown'})`
      ).join('\n');

      const prompt = `You are a product categorization expert for IT/electronics distribution. Categorize each product into a standard hierarchy.

**Products to categorize:**
${productList}

**Instructions:**
- Use this hierarchy format: "Top Level > Sub Category > Specific Type"
- Example categories: "Computers > Laptops > Business Laptops", "Networking > Switches > Managed Switches", "Peripherals > Keyboards & Mice > Wireless Keyboards", "Software > Security > Antivirus", "Accessories > Cables > USB Cables", "Printers > Inkjet > Large Format", "Storage > SSDs > NVMe SSDs", "Services > Warranties > Extended Warranties"
- Group products with the same category together
- Be specific but not overly granular

Respond with ONLY a JSON array:
[
  {
    "categoryPath": "Top Level > Sub Category > Type",
    "productIds": [1, 5, 12],
    "confidence": 90
  }
]

Use the product index numbers (1-based) in productIds, not the database IDs.`;

      const response = await anthropic.messages.create({
        model: DEFAULT_MODEL_STR,
        max_tokens: 4096,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }]
      });

      const textContent = response.content[0];
      if (textContent.type !== 'text') continue;

      let parsed;
      try {
        parsed = JSON.parse(stripCodeFences(textContent.text));
      } catch {
        console.error('[AI Category] Failed to parse response for batch');
        continue;
      }

      if (Array.isArray(parsed)) {
        for (const group of parsed) {
          const categoryPath = group.categoryPath || group.category || '';
          const parts = categoryPath.split('>').map((s: string) => s.trim());
          const categoryName = parts[parts.length - 1] || categoryPath;
          const ids = (group.productIds || []).map((idx: number) => {
            const product = batch[idx - 1];
            return product ? product.id : null;
          }).filter(Boolean) as number[];

          if (ids.length > 0 && categoryName) {
            results.push({
              categoryName,
              categoryPath,
              productIds: ids,
              confidence: group.confidence || 80,
            });
          }
        }
      }
    } catch (error) {
      console.error('[AI Category] Batch error:', (error as Error).message);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
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
        content: [
          {
            type: 'text',
            text: prompt
          }
        ]
      }]
    });

    const textContent = response.content[0];
    if (textContent.type !== 'text') {
      throw new Error('Unexpected response type from AI');
    }

    let result;
    try {
      const cleanedText = stripCodeFences(textContent.text);
      result = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse overlap detection response:', textContent.text);
      throw new Error('Failed to parse AI response');
    }
    
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
        content: [
          {
            type: 'text',
            text: prompt
          }
        ]
      }]
    });

    const textContent = response.content[0];
    if (textContent.type !== 'text') {
      throw new Error('Unexpected response type from AI');
    }

    let result;
    try {
      const cleanedText = stripCodeFences(textContent.text);
      result = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse normalization response:', textContent.text);
      throw new Error('Failed to parse AI response');
    }
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
