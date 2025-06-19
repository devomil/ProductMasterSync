/**
 * Comprehensive Amazon SP-API Search Utility
 * Searches using UPC, MPN, and keywords to find all possible ASIN matches
 */

import { searchCatalogItemsByUPC, searchCatalogItemsByKeywords } from './amazon-spapi';

interface ProductSearchParams {
  upc?: string;
  mpn?: string;
  description?: string;
  brand?: string;
  name?: string;
}

interface ASINMatch {
  asin: string;
  title: string;
  brand?: string;
  imageUrl?: string;
  matchMethod: 'UPC' | 'MPN' | 'Keywords';
  confidence: number;
}

/**
 * Performs comprehensive Amazon search using multiple methods
 */
export async function comprehensiveAmazonSearch(params: ProductSearchParams): Promise<ASINMatch[]> {
  const allMatches: ASINMatch[] = [];
  const seenASINs = new Set<string>();

  try {
    // Method 1: Search by UPC
    if (params.upc) {
      try {
        const upcResults = await searchCatalogItemsByUPC(params.upc);
        if (upcResults?.items) {
          for (const item of upcResults.items) {
            if (!seenASINs.has(item.asin)) {
              seenASINs.add(item.asin);
              allMatches.push({
                asin: item.asin,
                title: item.summaries?.[0]?.itemName || 'Unknown',
                brand: item.summaries?.[0]?.brand,
                imageUrl: `https://images-na.ssl-images-amazon.com/images/P/${item.asin}.01.L.jpg`,
                matchMethod: 'UPC',
                confidence: 0.95
              });
            }
          }
        }
      } catch (error) {
        console.log(`UPC search failed for ${params.upc}:`, error.message);
      }
    }

    // Method 2: Search by MPN (Manufacturer Part Number)
    if (params.mpn) {
      try {
        const mpnResults = await searchCatalogItemsByKeywords(`${params.mpn} ${params.brand || ''}`);
        if (mpnResults?.items) {
          for (const item of mpnResults.items) {
            if (!seenASINs.has(item.asin)) {
              // Validate MPN match in product details
              const itemMPN = item.attributes?.item_part_number?.[0]?.value || 
                             item.attributes?.part_number?.[0]?.value ||
                             item.attributes?.model_number?.[0]?.value;
              
              if (itemMPN && itemMPN.toLowerCase().includes(params.mpn.toLowerCase())) {
                seenASINs.add(item.asin);
                allMatches.push({
                  asin: item.asin,
                  title: item.summaries?.[0]?.itemName || 'Unknown',
                  brand: item.summaries?.[0]?.brand,
                  imageUrl: `https://images-na.ssl-images-amazon.com/images/P/${item.asin}.01.L.jpg`,
                  matchMethod: 'MPN',
                  confidence: 0.90
                });
              }
            }
          }
        }
      } catch (error) {
        console.log(`MPN search failed for ${params.mpn}:`, error.message);
      }
    }

    // Method 3: Search by product description/keywords
    if (params.description || params.name) {
      try {
        const searchTerms = [
          params.brand,
          params.description,
          params.name
        ].filter(Boolean).join(' ');

        const keywordResults = await searchCatalogItemsByKeywords(searchTerms);
        if (keywordResults?.items) {
          for (const item of keywordResults.items) {
            if (!seenASINs.has(item.asin)) {
              // Calculate relevance score based on title match
              const title = item.summaries?.[0]?.itemName || '';
              const brand = item.summaries?.[0]?.brand || '';
              
              let confidence = 0.50; // Base confidence for keyword match
              
              // Boost confidence if brand matches
              if (params.brand && brand.toLowerCase().includes(params.brand.toLowerCase())) {
                confidence += 0.20;
              }
              
              // Boost confidence if key terms match
              const keyTerms = [params.mpn, params.description?.split(' ').slice(0, 3).join(' ')].filter(Boolean);
              for (const term of keyTerms) {
                if (title.toLowerCase().includes(term.toLowerCase())) {
                  confidence += 0.15;
                  break;
                }
              }

              if (confidence >= 0.60) { // Only include if confidence is reasonable
                seenASINs.add(item.asin);
                allMatches.push({
                  asin: item.asin,
                  title,
                  brand,
                  imageUrl: `https://images-na.ssl-images-amazon.com/images/P/${item.asin}.01.L.jpg`,
                  matchMethod: 'Keywords',
                  confidence
                });
              }
            }
          }
        }
      } catch (error) {
        console.log(`Keyword search failed:`, error.message);
      }
    }

    // Sort by confidence score
    return allMatches.sort((a, b) => b.confidence - a.confidence);

  } catch (error) {
    console.error('Comprehensive Amazon search failed:', error);
    return [];
  }
}

/**
 * Search and update product ASIN mappings using comprehensive search
 */
export async function updateProductASINMappings(productId: number, searchParams: ProductSearchParams): Promise<ASINMatch[]> {
  const matches = await comprehensiveAmazonSearch(searchParams);
  
  if (matches.length > 0) {
    // Store the best match as primary mapping
    const bestMatch = matches[0];
    console.log(`Found ${matches.length} ASIN matches for product ${productId}, best: ${bestMatch.asin}`);
    
    // You can implement database update logic here if needed
    // This function returns matches for manual review and approval
  }
  
  return matches;
}