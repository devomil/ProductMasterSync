/**
 * Description Processing Utilities
 * Cleans up HTML-heavy product descriptions from suppliers
 */

export interface ProcessedDescription {
  cleanText: string;
  formattedText: string;
  bulletPoints: string[];
  features: string[];
  warnings: string[];
}

/**
 * Clean HTML tags from description text
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  
  return html
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&trade;/g, '™')
    .replace(/&reg;/g, '®')
    .replace(/&copy;/g, '©')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract bullet points from HTML lists
 */
export function extractBulletPoints(html: string): string[] {
  if (!html) return [];
  
  const bullets: string[] = [];
  
  // Extract from <li> tags
  const liMatches = html.match(/<li[^>]*>(.*?)<\/li>/gi);
  if (liMatches) {
    liMatches.forEach(match => {
      const text = stripHtml(match);
      if (text.trim()) {
        bullets.push(text.trim());
      }
    });
  }
  
  return bullets;
}

/**
 * Extract features section from description
 */
export function extractFeatures(html: string): string[] {
  if (!html) return [];
  
  const features: string[] = [];
  
  // Look for features section
  const featuresMatch = html.match(/<strong[^>]*>Features:?<\/strong>(.*?)(?=<p|<div|$)/si);
  if (featuresMatch) {
    const featuresHtml = featuresMatch[1];
    const bullets = extractBulletPoints(featuresHtml);
    features.push(...bullets);
  }
  
  // Also extract from any bullet points that might be features
  const allBullets = extractBulletPoints(html);
  features.push(...allBullets);
  
  return [...new Set(features)]; // Remove duplicates
}

/**
 * Extract warning text (like Prop 65 warnings)
 */
export function extractWarnings(html: string): string[] {
  if (!html) return [];
  
  const warnings: string[] = [];
  
  // Look for WARNING text
  const warningMatches = html.match(/<[^>]*>WARNING:.*?<\/[^>]*>/gi);
  if (warningMatches) {
    warningMatches.forEach(match => {
      const text = stripHtml(match);
      if (text.trim()) {
        warnings.push(text.trim());
      }
    });
  }
  
  return warnings;
}

/**
 * Process a product description and return cleaned versions
 */
export function processDescription(html: string): string {
  // Return only clean text for imports - no JSON objects
  return stripHtml(html);
}

/**
 * Auto-format description for different display contexts
 */
export function formatDescriptionForContext(html: string, context: 'catalog' | 'detail' | 'search'): string {
  const cleanText = processDescription(html);
  
  switch (context) {
    case 'catalog':
      // Short, clean version for catalog listings
      return cleanText.length > 150 
        ? cleanText.substring(0, 147) + '...'
        : cleanText;
        
    case 'detail':
      // Clean text version for master catalog
      return cleanText;
      
    case 'search':
      // Clean text optimized for search indexing
      return cleanText.toLowerCase();
      
    default:
      return cleanText;
  }
}