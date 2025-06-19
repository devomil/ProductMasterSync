/**
 * Fix confidence scoring for all products based on five-tier rules
 */

const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

// Five-tier confidence scoring implementation
function calculateFiveTierConfidence(catalogUpc, catalogMpn, catalogTitle, amazonUpc, amazonMpn, amazonTitle) {
  const normalizeId = (str) => str ? str.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : null;
  const calculateSimilarity = (str1, str2) => {
    if (!str1 || !str2) return 0;
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);
    const intersection = words1.filter(word => words2.includes(word));
    return intersection.length / Math.max(words1.length, words2.length);
  };

  const upcMatch = catalogUpc && amazonUpc && normalizeId(catalogUpc) === normalizeId(amazonUpc);
  const mpnMatch = catalogMpn && amazonMpn && normalizeId(catalogMpn) === normalizeId(amazonMpn);
  const titleSimilarity = calculateSimilarity(catalogTitle, amazonTitle);

  // Apply five-tier rules
  if (upcMatch && mpnMatch && titleSimilarity > 0.8) return 100;
  if (upcMatch && mpnMatch) return 90;
  if (upcMatch) return 80;
  if (mpnMatch) return 70;
  if (titleSimilarity > 0.8) return 50;
  if (titleSimilarity > 0.6) return 40;
  if (titleSimilarity > 0.4) return 30;
  return 10;
}

async function fixConfidenceScoring() {
  await client.connect();
  
  console.log('Fixing confidence scoring based on five-tier rules...');
  
  // Get all product-ASIN mappings with their data
  const query = `
    SELECT 
      pam.id as mapping_id,
      pam.asin,
      p.upc as catalog_upc,
      p.manufacturer_part_number as catalog_mpn,
      p.name as catalog_title,
      acd.upc as amazon_upc,
      acd.part_number as amazon_mpn,
      acd.title as amazon_title,
      pam.match_confidence as current_confidence
    FROM product_asin_mapping pam
    JOIN products p ON pam.product_id = p.id
    LEFT JOIN amazon_catalog_data acd ON pam.asin = acd.asin
    ORDER BY p.upc
  `;
  
  const result = await client.query(query);
  let updated = 0;
  
  for (const row of result.rows) {
    const newConfidence = calculateFiveTierConfidence(
      row.catalog_upc,
      row.catalog_mpn,
      row.catalog_title,
      row.amazon_upc,
      row.amazon_mpn,
      row.amazon_title
    );
    
    if (newConfidence !== row.current_confidence) {
      await client.query(
        'UPDATE product_asin_mapping SET match_confidence = $1, mapping_source = $2 WHERE id = $3',
        [newConfidence, 'five_tier_scoring', row.mapping_id]
      );
      updated++;
      
      console.log(`Updated ${row.asin}: ${row.current_confidence}% → ${newConfidence}%`);
    }
  }
  
  console.log(`Fixed confidence scoring for ${updated} mappings`);
  await client.end();
}

fixConfidenceScoring().catch(console.error);