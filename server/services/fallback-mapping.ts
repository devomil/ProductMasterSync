interface FieldMapping {
  sourceField: string;
  targetField: string;
  confidence: number;
  reasoning: string;
}

interface TargetField {
  id: string;
  targetField: string;
  description: string;
  example?: string;
  category: string;
}

interface AutoMappingResult {
  mappings: FieldMapping[];
  unmapped: string[];
  totalConfidence: number;
}

export class FallbackMappingService {
  private static instance: FallbackMappingService;

  public static getInstance(): FallbackMappingService {
    if (!FallbackMappingService.instance) {
      FallbackMappingService.instance = new FallbackMappingService();
    }
    return FallbackMappingService.instance;
  }

  // Common field mapping patterns for supplier data
  private mappingPatterns: Record<string, { target: string; confidence: number; category: string }> = {
    // Pricing fields
    'your cost': { target: 'yourCost', confidence: 0.95, category: 'pricing' },
    'cost': { target: 'yourCost', confidence: 0.90, category: 'pricing' },
    'list price': { target: 'listPrice', confidence: 0.95, category: 'pricing' },
    'price': { target: 'listPrice', confidence: 0.85, category: 'pricing' },
    'map price': { target: 'mapPrice', confidence: 0.95, category: 'pricing' },
    'mrp price': { target: 'mrpPrice', confidence: 0.95, category: 'pricing' },
    'm.a.p. price': { target: 'mapPrice', confidence: 0.95, category: 'pricing' },
    'm.r.p. price': { target: 'mrpPrice', confidence: 0.95, category: 'pricing' },
    'original price': { target: 'originalPriceSale', confidence: 0.90, category: 'pricing' },

    // Product identification
    'supplier part number': { target: 'usin', confidence: 0.95, category: 'master_catalog' },
    'supplierpart number': { target: 'usin', confidence: 0.95, category: 'master_catalog' },
    'supplierpartnumber': { target: 'usin', confidence: 0.95, category: 'master_catalog' },
    'cwr part number': { target: 'usin', confidence: 0.95, category: 'master_catalog' },
    'cwrpartnumber': { target: 'usin', confidence: 0.95, category: 'master_catalog' },
    'part number': { target: 'usin', confidence: 0.90, category: 'master_catalog' },
    'partnumber': { target: 'usin', confidence: 0.90, category: 'master_catalog' },
    'manufacturer part number': { target: 'manufacturerPartNumber', confidence: 0.95, category: 'master_catalog' },
    'manufacturerpartnumber': { target: 'manufacturerPartNumber', confidence: 0.95, category: 'master_catalog' },
    'mfg part number': { target: 'manufacturerPartNumber', confidence: 0.90, category: 'master_catalog' },
    'upc code': { target: 'upc', confidence: 0.95, category: 'master_catalog' },
    'upccode': { target: 'upc', confidence: 0.95, category: 'master_catalog' },
    'upc': { target: 'upc', confidence: 0.90, category: 'master_catalog' },
    'title': { target: 'name', confidence: 0.85, category: 'master_catalog' },
    'product name': { target: 'name', confidence: 0.90, category: 'master_catalog' },
    'name': { target: 'name', confidence: 0.80, category: 'master_catalog' },
    'description': { target: 'description', confidence: 0.85, category: 'master_catalog' },
    'full description': { target: 'description', confidence: 0.90, category: 'master_catalog' },
    'manufacturer name': { target: 'manufacturerName', confidence: 0.95, category: 'master_catalog' },
    'brand': { target: 'manufacturerName', confidence: 0.85, category: 'master_catalog' },

    // Inventory fields
    'quantity available': { target: 'quantityAvailableCombined', confidence: 0.95, category: 'inventory' },
    'qty available': { target: 'quantityAvailableCombined', confidence: 0.90, category: 'inventory' },
    'available': { target: 'quantityAvailableCombined', confidence: 0.80, category: 'inventory' },
    'quantity available to ship (combined)': { target: 'quantityAvailableCombined', confidence: 0.98, category: 'inventory' },
    'quantity available to ship (nj)': { target: 'quantityAvailableNj', confidence: 0.98, category: 'inventory' },
    'quantity available to ship (fl)': { target: 'quantityAvailableFl', confidence: 0.98, category: 'inventory' },
    'shipping weight': { target: 'shippingWeight', confidence: 0.95, category: 'inventory' },
    'weight': { target: 'shippingWeight', confidence: 0.80, category: 'inventory' },
    'case qty': { target: 'caseQuantity', confidence: 0.90, category: 'inventory' },
    'case quantity': { target: 'caseQuantity', confidence: 0.95, category: 'inventory' },

    // Shipping fields
    'box height': { target: 'boxHeight', confidence: 0.95, category: 'shipping' },
    'box length': { target: 'boxLength', confidence: 0.95, category: 'shipping' },
    'box width': { target: 'boxWidth', confidence: 0.95, category: 'shipping' },
    'height': { target: 'boxHeight', confidence: 0.75, category: 'shipping' },
    'length': { target: 'boxLength', confidence: 0.75, category: 'shipping' },
    'width': { target: 'boxWidth', confidence: 0.75, category: 'shipping' },
    'drop ships direct': { target: 'dropShipsDirect', confidence: 0.95, category: 'shipping' },
    'dropship': { target: 'dropShipsDirect', confidence: 0.85, category: 'shipping' },
    'truck freight': { target: 'truckFreight', confidence: 0.95, category: 'shipping' },
    'oversized': { target: 'oversized', confidence: 0.95, category: 'shipping' },
    'country of origin': { target: 'countryOfOrigin', confidence: 0.95, category: 'shipping' },
    'harmonization code': { target: 'harmonizationCode', confidence: 0.95, category: 'shipping' },

    // Compliance fields
    'hazardous materials': { target: 'hazardousMaterials', confidence: 0.95, category: 'compliance' },
    'hazmat': { target: 'hazardousMaterials', confidence: 0.90, category: 'compliance' },
    'exportable': { target: 'exportable', confidence: 0.95, category: 'compliance' },
    'remanufactured': { target: 'remanufactured', confidence: 0.95, category: 'compliance' },
    'google merchant category': { target: 'googleMerchantCategory', confidence: 0.95, category: 'compliance' },
    'prop 65': { target: 'prop65Warning', confidence: 0.90, category: 'compliance' },
    'fcc id': { target: 'fccId', confidence: 0.95, category: 'compliance' },

    // Promotions fields
    'sale': { target: 'sale', confidence: 0.90, category: 'promotions' },
    'on sale': { target: 'sale', confidence: 0.85, category: 'promotions' },
    'sale start date': { target: 'saleStartDate', confidence: 0.95, category: 'promotions' },
    'sale end date': { target: 'saleEndDate', confidence: 0.95, category: 'promotions' },
    'closeout': { target: 'closeout', confidence: 0.95, category: 'promotions' },
    'rebate': { target: 'rebate', confidence: 0.90, category: 'promotions' },
    'rebate description': { target: 'rebateDescription', confidence: 0.95, category: 'promotions' },
    'rebate start date': { target: 'rebateStartDate', confidence: 0.95, category: 'promotions' },
    'rebate end date': { target: 'rebateEndDate', confidence: 0.95, category: 'promotions' },

    // Documentation fields
    'image (300x300) url': { target: 'image300x300', confidence: 0.98, category: 'documentation' },
    'image 300x300 url': { target: 'image300x300', confidence: 0.95, category: 'documentation' },
    'image300x300url': { target: 'image300x300', confidence: 0.95, category: 'documentation' },
    'image (1000x1000) url': { target: 'image1000x1000', confidence: 0.98, category: 'documentation' },
    'image 1000x1000 url': { target: 'image1000x1000', confidence: 0.95, category: 'documentation' },
    'image1000x1000url': { target: 'image1000x1000', confidence: 0.95, category: 'documentation' },
    'image url': { target: 'image300x300', confidence: 0.85, category: 'documentation' },
    'image': { target: 'image300x300', confidence: 0.80, category: 'documentation' },
    'quick specs': { target: 'quickSpecs', confidence: 0.95, category: 'documentation' },
    'specifications': { target: 'quickSpecs', confidence: 0.85, category: 'documentation' },
    'accessories by sku': { target: 'accessoriesBySku', confidence: 0.95, category: 'documentation' },
    'accessories by mfg': { target: 'accessoriesByMfg', confidence: 0.95, category: 'documentation' },
  };

  private normalizeFieldName(fieldName: string): string {
    return fieldName.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateSimilarity(source: string, target: string): number {
    const sourceNorm = this.normalizeFieldName(source);
    const targetNorm = this.normalizeFieldName(target);

    // Exact match
    if (sourceNorm === targetNorm) return 1.0;

    // Check if one contains the other
    if (sourceNorm.includes(targetNorm) || targetNorm.includes(sourceNorm)) {
      return 0.85;
    }

    // Word overlap scoring
    const sourceWords = sourceNorm.split(' ');
    const targetWords = targetNorm.split(' ');
    const intersection = sourceWords.filter(word => targetWords.includes(word));
    
    if (intersection.length > 0) {
      return intersection.length / Math.max(sourceWords.length, targetWords.length);
    }

    return 0;
  }

  autoMapFields(sourceFields: string[], targetFields: TargetField[]): AutoMappingResult {
    const mappings: FieldMapping[] = [];
    const unmapped: string[] = [];

    for (const sourceField of sourceFields) {
      const normalizedSource = this.normalizeFieldName(sourceField);
      let bestMatch: FieldMapping | null = null;
      
      // Check exact pattern matches first
      const pattern = this.mappingPatterns[normalizedSource];
      if (pattern) {
        const targetField = targetFields.find(tf => tf.targetField === pattern.target);
        
        if (targetField) {
          bestMatch = {
            sourceField,
            targetField: pattern.target,
            confidence: pattern.confidence,
            reasoning: `Exact pattern match for common CWR field "${sourceField}"`
          };
        }
      }

      // If no exact pattern match, try semantic similarity
      if (!bestMatch) {
        let highestSimilarity = 0;
        let bestTargetField: TargetField | null = null;

        for (const targetField of targetFields) {
          // Compare with target field name
          const targetSimilarity = this.calculateSimilarity(sourceField, targetField.targetField);
          
          // Compare with description keywords
          const descSimilarity = this.calculateSimilarity(sourceField, targetField.description);
          
          const maxSimilarity = Math.max(targetSimilarity, descSimilarity * 0.8);
          
          if (maxSimilarity > highestSimilarity && maxSimilarity >= 0.6) {
            highestSimilarity = maxSimilarity;
            bestTargetField = targetField;
          }
        }

        if (bestTargetField && highestSimilarity >= 0.6) {
          bestMatch = {
            sourceField,
            targetField: bestTargetField.targetField,
            confidence: highestSimilarity * 0.9, // Slight penalty for non-exact matches
            reasoning: `Semantic similarity match (${Math.round(highestSimilarity * 100)}% similarity)`
          };
        }
      }

      if (bestMatch && bestMatch.confidence >= 0.6) {
        mappings.push(bestMatch);
      } else {
        unmapped.push(sourceField);
      }
    }

    const totalConfidence = mappings.length > 0 
      ? mappings.reduce((sum, m) => sum + m.confidence, 0) / mappings.length 
      : 0;

    return {
      mappings,
      unmapped,
      totalConfidence: Math.round(totalConfidence * 100) / 100
    };
  }

  suggestBestMatch(sourceField: string, targetFields: TargetField[]): FieldMapping | null {
    const result = this.autoMapFields([sourceField], targetFields);
    return result.mappings.length > 0 ? result.mappings[0] : null;
  }
}