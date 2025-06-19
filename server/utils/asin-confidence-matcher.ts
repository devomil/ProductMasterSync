/**
 * ASIN Confidence Matching System
 * Implements intelligent matching based on UPC, MPN, and Description with confidence scoring
 */

interface ProductData {
  upc?: string;
  manufacturerPartNumber?: string;
  description?: string;
  name?: string;
}

interface AmazonAsinData {
  asin: string;
  upc?: string;
  manufacturerPartNumber?: string;
  title?: string;
  description?: string;
  brand?: string;
  imageUrl?: string;
}

interface MatchResult {
  asin: string;
  confidenceScore: number;
  matchReason: string;
  matchDetails: {
    upcMatch: boolean;
    mpnMatch: boolean;
    descriptionMatch: boolean;
    imageAvailable: boolean;
  };
  status: 'primary' | 'review' | 'low_confidence';
  imageUrl?: string;
}

/**
 * Calculate confidence score based on UPC, MPN, and description matching
 */
export function calculateMatchConfidence(
  catalogProduct: ProductData,
  amazonAsin: AmazonAsinData
): MatchResult {
  let score = 0;
  let matchReason = "";
  const matchDetails = {
    upcMatch: false,
    mpnMatch: false,
    descriptionMatch: false,
    imageAvailable: !!amazonAsin.imageUrl
  };

  // UPC matching (40 points - highest priority)
  if (catalogProduct.upc && amazonAsin.upc) {
    const normalizedCatalogUpc = normalizeUPC(catalogProduct.upc);
    const normalizedAmazonUpc = normalizeUPC(amazonAsin.upc);
    
    if (normalizedCatalogUpc === normalizedAmazonUpc) {
      score += 40;
      matchDetails.upcMatch = true;
      matchReason += "UPC match";
    }
  }

  // MPN matching (30 points)
  if (catalogProduct.manufacturerPartNumber && amazonAsin.manufacturerPartNumber) {
    const normalizedCatalogMPN = normalizeMPN(catalogProduct.manufacturerPartNumber);
    const normalizedAmazonMPN = normalizeMPN(amazonAsin.manufacturerPartNumber);
    
    if (normalizedCatalogMPN === normalizedAmazonMPN) {
      score += 30;
      matchDetails.mpnMatch = true;
      matchReason += matchReason ? ", MPN match" : "MPN match";
    }
  }

  // Description/Title matching (30 points)
  const catalogDescription = catalogProduct.description || catalogProduct.name || "";
  const amazonDescription = amazonAsin.title || amazonAsin.description || "";
  
  if (catalogDescription && amazonDescription) {
    const descriptionSimilarity = calculateDescriptionSimilarity(catalogDescription, amazonDescription);
    
    if (descriptionSimilarity >= 0.8) {
      score += 30;
      matchDetails.descriptionMatch = true;
      matchReason += matchReason ? ", Description match" : "Description match";
    } else if (descriptionSimilarity >= 0.6) {
      score += 20; // Partial description match
      matchReason += matchReason ? ", Partial description match" : "Partial description match";
    }
  }

  // Image availability bonus (5 points)
  if (matchDetails.imageAvailable) {
    score += 5;
  }

  // No image penalty for manual review flag
  if (!matchDetails.imageAvailable && score > 0) {
    matchReason += matchReason ? ", No image available" : "No image available";
  }

  // Determine status based on confidence score
  let status: 'primary' | 'review' | 'low_confidence';
  if (score >= 90) {
    status = 'primary';
  } else if (score >= 60) {
    status = 'review';
  } else {
    status = 'low_confidence';
  }

  return {
    asin: amazonAsin.asin,
    confidenceScore: score,
    matchReason: matchReason || "No significant matches found",
    matchDetails,
    status,
    imageUrl: amazonAsin.imageUrl
  };
}

/**
 * Normalize UPC for comparison (remove spaces, dashes, ensure 12 digits)
 */
function normalizeUPC(upc: string): string {
  const cleaned = upc.replace(/[\s-]/g, '');
  // Pad with leading zeros if needed to make it 12 digits
  return cleaned.padStart(12, '0');
}

/**
 * Normalize MPN for comparison (trim, uppercase, remove special chars)
 */
function normalizeMPN(mpn: string): string {
  return mpn.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Calculate similarity between product descriptions using fuzzy matching
 */
function calculateDescriptionSimilarity(desc1: string, desc2: string): number {
  const normalize = (str: string) => str.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const normalized1 = normalize(desc1);
  const normalized2 = normalize(desc2);

  // Simple word-based similarity
  const words1 = normalized1.split(' ');
  const words2 = normalized2.split(' ');
  const words1Set = new Set(words1);
  const words2Set = new Set(words2);
  
  const intersectionCount = words1.filter(word => words2Set.has(word)).length;
  const unionSize = words1Set.size + words2Set.size - intersectionCount;
  
  return intersectionCount / unionSize;
}

/**
 * Process multiple ASIN candidates and rank by confidence
 */
export function rankAsinCandidates(
  catalogProduct: ProductData,
  asinCandidates: AmazonAsinData[]
): MatchResult[] {
  const results = asinCandidates.map(asin => 
    calculateMatchConfidence(catalogProduct, asin)
  );

  // Sort by confidence score (highest first)
  results.sort((a, b) => b.confidenceScore - a.confidenceScore);

  // Auto-assign primary ASIN if confidence is high enough
  if (results.length > 0 && results[0].confidenceScore >= 90) {
    results[0].status = 'primary';
  }

  return results;
}

/**
 * Get confidence level description for UI display
 */
export function getConfidenceLevel(score: number): {
  level: string;
  color: string;
  description: string;
} {
  if (score >= 90) {
    return {
      level: "High",
      color: "green",
      description: "Excellent match - UPC, MPN, and description align"
    };
  } else if (score >= 75) {
    return {
      level: "Good", 
      color: "blue",
      description: "Good match - UPC and MPN or strong description match"
    };
  } else if (score >= 60) {
    return {
      level: "Medium",
      color: "yellow", 
      description: "Moderate match - requires review"
    };
  } else {
    return {
      level: "Low",
      color: "red",
      description: "Poor match - manual verification needed"
    };
  }
}

/**
 * Validate ASIN candidate for potential issues
 */
export function validateAsinCandidate(result: MatchResult): string[] {
  const issues: string[] = [];

  if (!result.matchDetails.imageAvailable) {
    issues.push("No product image available");
  }

  if (result.confidenceScore < 60) {
    issues.push("Low confidence match - manual review recommended");
  }

  if (!result.matchDetails.upcMatch && !result.matchDetails.mpnMatch) {
    issues.push("No UPC or MPN match found");
  }

  if (result.matchDetails.upcMatch && !result.matchDetails.mpnMatch) {
    issues.push("UPC matches but MPN differs - verify product variant");
  }

  return issues;
}