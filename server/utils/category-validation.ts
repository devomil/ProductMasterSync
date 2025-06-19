/**
 * Category and Product Type Validation
 * 
 * Cross-references product categories with Amazon ASIN data for consistency validation
 */

interface CategoryValidationResult {
  isConsistent: boolean;
  confidence: number;
  issues: string[];
  suggestions: string[];
  categoryMismatch: boolean;
  productTypeMismatch: boolean;
}

interface ProductData {
  category?: string;
  productType?: string;
  description?: string;
  name?: string;
}

interface AmazonData {
  mainCategory?: string;
  categories?: string[];
  productType?: string;
  title?: string;
  description?: string;
}

/**
 * Validate category consistency between catalog product and Amazon ASIN
 */
export function validateCategoryConsistency(
  catalogProduct: ProductData,
  amazonData: AmazonData
): CategoryValidationResult {
  const result: CategoryValidationResult = {
    isConsistent: true,
    confidence: 100,
    issues: [],
    suggestions: [],
    categoryMismatch: false,
    productTypeMismatch: false
  };

  // Category mapping for common variations
  const categoryMappings: Record<string, string[]> = {
    'electronics': ['electronics', 'electronic', 'tech', 'technology'],
    'automotive': ['automotive', 'auto', 'car', 'vehicle', 'motor'],
    'marine': ['marine', 'boat', 'nautical', 'ship', 'sailing'],
    'safety': ['safety', 'emergency', 'rescue', 'security'],
    'communication': ['communication', 'radio', 'wireless', 'comm'],
    'navigation': ['navigation', 'gps', 'compass', 'nav'],
    'tools': ['tools', 'hardware', 'equipment', 'instrument']
  };

  // Normalize categories for comparison
  const normalizeCat = (cat: string) => cat?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
  
  const catalogCat = normalizeCat(catalogProduct.category || '');
  const amazonCat = normalizeCat(amazonData.mainCategory || '');

  // Check direct category match
  if (catalogCat && amazonCat) {
    if (catalogCat === amazonCat) {
      result.confidence = 100;
      return result;
    }

    // Check category mapping variations
    let foundMatch = false;
    for (const [baseCategory, variations] of Object.entries(categoryMappings)) {
      const catalogInVariations = variations.some(v => catalogCat.includes(v));
      const amazonInVariations = variations.some(v => amazonCat.includes(v));
      
      if (catalogInVariations && amazonInVariations) {
        foundMatch = true;
        result.confidence = 85;
        break;
      }
    }

    if (!foundMatch) {
      result.categoryMismatch = true;
      result.isConsistent = false;
      result.confidence = 30;
      result.issues.push(`Category mismatch: "${catalogProduct.category}" vs "${amazonData.mainCategory}"`);
      result.suggestions.push('Verify product category classification');
    }
  }

  // Check product type consistency
  const catalogType = normalizeCat(catalogProduct.productType || '');
  const amazonType = normalizeCat(amazonData.productType || '');

  if (catalogType && amazonType && catalogType !== amazonType) {
    result.productTypeMismatch = true;
    result.confidence = Math.min(result.confidence, 60);
    result.issues.push(`Product type mismatch: "${catalogProduct.productType}" vs "${amazonData.productType}"`);
  }

  // Cross-check with product description/title keywords
  const descriptionKeywords = extractKeywords(
    `${catalogProduct.description || ''} ${catalogProduct.name || ''}`
  );
  const amazonKeywords = extractKeywords(
    `${amazonData.title || ''} ${amazonData.description || ''}`
  );

  const keywordOverlap = calculateKeywordOverlap(descriptionKeywords, amazonKeywords);
  
  if (keywordOverlap < 0.3) {
    result.confidence = Math.min(result.confidence, 50);
    result.issues.push('Low keyword overlap between product descriptions');
    result.suggestions.push('Review product description accuracy');
  }

  // Additional category validation rules
  if (catalogProduct.category?.toLowerCase().includes('marine') && 
      !amazonData.mainCategory?.toLowerCase().includes('marine') &&
      !amazonData.title?.toLowerCase().includes('marine')) {
    result.issues.push('Marine product may be miscategorized on Amazon');
    result.suggestions.push('Verify this is a marine-specific product');
  }

  if (catalogProduct.category?.toLowerCase().includes('safety') &&
      !amazonData.title?.toLowerCase().includes('safety') &&
      !amazonData.title?.toLowerCase().includes('emergency')) {
    result.issues.push('Safety product classification may not match Amazon listing');
    result.suggestions.push('Confirm safety/emergency product features');
  }

  return result;
}

/**
 * Extract meaningful keywords from text
 */
function extractKeywords(text: string): Set<string> {
  const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
  
  return new Set(
    text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 20) // Limit to most relevant keywords
  );
}

/**
 * Calculate keyword overlap percentage
 */
function calculateKeywordOverlap(keywords1: Set<string>, keywords2: Set<string>): number {
  if (keywords1.size === 0 || keywords2.size === 0) return 0;
  
  const intersection = new Set([...keywords1].filter(x => keywords2.has(x)));
  const union = new Set([...keywords1, ...keywords2]);
  
  return intersection.size / union.size;
}

/**
 * Generate category validation flags
 */
export function generateCategoryValidationFlags(result: CategoryValidationResult): string[] {
  const flags: string[] = [];

  if (result.categoryMismatch) {
    flags.push('CATEGORY_MISMATCH');
  }

  if (result.productTypeMismatch) {
    flags.push('PRODUCT_TYPE_MISMATCH');
  }

  if (result.confidence < 50) {
    flags.push('LOW_CATEGORY_CONFIDENCE');
  }

  if (result.issues.length > 2) {
    flags.push('MULTIPLE_CATEGORY_ISSUES');
  }

  return flags;
}

/**
 * Suggest category corrections based on Amazon data
 */
export function suggestCategoryCorrections(
  catalogProduct: ProductData,
  amazonData: AmazonData
): string[] {
  const suggestions: string[] = [];

  if (amazonData.mainCategory && catalogProduct.category !== amazonData.mainCategory) {
    suggestions.push(`Consider updating category to: ${amazonData.mainCategory}`);
  }

  if (amazonData.productType && catalogProduct.productType !== amazonData.productType) {
    suggestions.push(`Consider updating product type to: ${amazonData.productType}`);
  }

  // Analyze Amazon categories for better suggestions
  if (amazonData.categories && amazonData.categories.length > 0) {
    const relevantCategories = amazonData.categories
      .filter(cat => cat.toLowerCase().includes('marine') || 
                    cat.toLowerCase().includes('safety') ||
                    cat.toLowerCase().includes('automotive'))
      .slice(0, 2);
    
    if (relevantCategories.length > 0) {
      suggestions.push(`Amazon categories suggest: ${relevantCategories.join(', ')}`);
    }
  }

  return suggestions;
}