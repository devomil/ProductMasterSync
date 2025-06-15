# Amazon ASIN Mapping Database Schema Fix

## Problem Summary
The Amazon marketplace opportunities system had critical database schema conflicts causing:
- Duplicate ASIN entries (SKU 127480 showing 9 entries instead of 3)
- Wrong ASIN mappings (SKU 198596 showing incorrect ASINs)
- Query inconsistencies between direct UPC mapping and productAsinMapping table

## Root Cause
Two conflicting ASIN mapping approaches:
1. **Direct UPC mapping**: `products.upc = amazonAsins.upc` (incorrect)
2. **Product ASIN mapping table**: `productAsinMapping` (correct)

The marketplace opportunities endpoint was using the incorrect direct UPC approach.

## Solution Applied

### 1. Database Schema Correction
- Cleared conflicting data from `productAsinMapping` and `amazonMarketIntelligence` tables
- Repopulated with authentic Amazon SP-API catalog search results
- Used only verified ASINs from real Amazon search results

### 2. Query Fix
Updated marketplace opportunities endpoint to use correct schema:
```typescript
// BEFORE (incorrect - caused duplicates)
.innerJoin(amazonAsins, eq(products.upc, amazonAsins.upc))

// AFTER (correct - uses proper mapping table)
.innerJoin(productAsinMapping, eq(products.id, productAsinMapping.productId))
.innerJoin(amazonAsins, eq(productAsinMapping.asin, amazonAsins.asin))
```

### 3. Authentic Data Population
All ASINs verified against real Amazon search results:

| SKU | ASINs | Prices | Status |
|-----|-------|---------|---------|
| 488270 | B0012TNXKC | $7.99 | ✓ Reference working |
| 139229 | B00DMWKX8E | $127.48 | ✓ Fixed |
| 165731 | B01FXQM8Y2 | $1105.16 | ✓ Fixed |
| 198596 | B000THUD1A, B011LO27R2, B013XRR6SS | $234.49, $272.95, $265.99 | ✓ Fixed (3 authentic ASINs) |
| 127480 | B000S5SH20, B000SMULIG, B011LOA7G0 | $23.30, $19.99, $26.50 | ✓ Fixed (3 authentic ASINs) |
| 370129 | B01M8QZXV4 | $157.95 | ✓ Fixed |

## Critical Rules for Future Development

### 1. Always Use productAsinMapping Table
```typescript
// CORRECT: Use product mapping table
.from(products)
.innerJoin(productAsinMapping, eq(products.id, productAsinMapping.productId))
.innerJoin(amazonAsins, eq(productAsinMapping.asin, amazonAsins.asin))

// NEVER: Direct UPC mapping
.innerJoin(amazonAsins, eq(products.upc, amazonAsins.upc)) // WRONG
```

### 2. Authentic Data Only
- Use only Amazon SP-API catalog search results
- Verify all ASINs against real Amazon product pages
- No estimates, placeholders, or synthetic data

### 3. Prevent Duplicates
- Clear existing mappings before repopulating
- Use `productAsinMapping.isActive = true` filter
- One mapping record per product-ASIN pair

## Files Modified
- `server/marketplace/routes.ts` - Fixed opportunities query
- `server/services/asin-mapping-fix.ts` - Created permanent fix module
- Database tables: `productAsinMapping`, `amazonMarketIntelligence`

## Verification Commands
```bash
# Check ASIN mapping counts per product
curl -s http://localhost:5000/api/marketplace/analytics/opportunities | jq '.opportunities | group_by(.sku) | map({sku: .[0].sku, count: length, asins: [.[].asin] | unique})'

# Verify no duplicates
curl -s http://localhost:5000/api/marketplace/analytics/opportunities | jq '.opportunities | length'
```

## Result
✓ No more duplicate ASIN entries  
✓ All ASINs verified against Amazon search results  
✓ Consistent database schema using productAsinMapping table  
✓ Authentic pricing data from Amazon SP-API