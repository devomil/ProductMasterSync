/**
 * Walmart Marketplace Referral Fee Calculator
 * 
 * Calculates referral fees based on contract category (product type) and sale price.
 * Fee structures include:
 * - Flat percentage fees
 * - Tiered fees based on total sales price
 * - Portion-based fees (different rates for different price portions)
 */

export type FeeStructureType = 'flat' | 'tiered' | 'portion';

export interface FlatFee {
  type: 'flat';
  percentage: number;
}

export interface TieredFee {
  type: 'tiered';
  tiers: Array<{
    maxPrice: number | null;  // null means no upper limit
    percentage: number;
  }>;
}

export interface PortionFee {
  type: 'portion';
  portions: Array<{
    upTo: number | null;  // null means remainder
    percentage: number;
  }>;
}

export type FeeStructure = FlatFee | TieredFee | PortionFee;

export interface ContractCategory {
  name: string;
  feeStructure: FeeStructure;
  notes?: string;
}

/**
 * Complete Walmart Referral Fee schedule by contract category
 */
export const WALMART_REFERRAL_FEES: Record<string, ContractCategory> = {
  'apparel_accessories': {
    name: 'Apparel & Accessories',
    feeStructure: {
      type: 'tiered',
      tiers: [
        { maxPrice: 1500, percentage: 5 },      // $15 or less
        { maxPrice: 2000, percentage: 10 },     // $15 - $20
        { maxPrice: null, percentage: 15 }      // greater than $20
      ]
    }
  },
  'appliances_compact': {
    name: 'Appliances - Compact',
    feeStructure: {
      type: 'portion',
      portions: [
        { upTo: 30000, percentage: 12 },        // up to $300
        { upTo: null, percentage: 8 }           // above $300
      ]
    }
  },
  'appliances_major': {
    name: 'Appliances - Major',
    feeStructure: { type: 'flat', percentage: 8 }
  },
  'automotive_powersports': {
    name: 'Automotive & Powersports',
    feeStructure: { type: 'flat', percentage: 12 }
  },
  'baby_products': {
    name: 'Baby Products',
    feeStructure: {
      type: 'tiered',
      tiers: [
        { maxPrice: 1000, percentage: 8 },      // $10 or less
        { maxPrice: null, percentage: 15 }      // greater than $10
      ]
    }
  },
  'base_power_tools': {
    name: 'Base Power Tools',
    feeStructure: { type: 'flat', percentage: 12 }
  },
  'beauty_health_personal_care': {
    name: 'Beauty, Health & Personal care',
    feeStructure: {
      type: 'tiered',
      tiers: [
        { maxPrice: 1000, percentage: 8 },      // $10 or less
        { maxPrice: null, percentage: 15 }      // greater than $10
      ]
    }
  },
  'books': {
    name: 'Books',
    feeStructure: { type: 'flat', percentage: 15 }
  },
  'camera_photo': {
    name: 'Camera & Photo',
    feeStructure: { type: 'flat', percentage: 8 }
  },
  'collectibles': {
    name: 'Collectibles',
    feeStructure: { type: 'flat', percentage: 8 },
    notes: 'For approved sellers only'
  },
  'consumer_electronics': {
    name: 'Consumer Electronics',
    feeStructure: { type: 'flat', percentage: 8 }
  },
  'electronics_accessories': {
    name: 'Electronics Accessories',
    feeStructure: {
      type: 'portion',
      portions: [
        { upTo: 10000, percentage: 15 },        // up to $100
        { upTo: null, percentage: 8 }           // above $100
      ]
    }
  },
  'grocery': {
    name: 'Grocery',
    feeStructure: {
      type: 'tiered',
      tiers: [
        { maxPrice: 1500, percentage: 8 },      // $15 or less
        { maxPrice: null, percentage: 15 }      // greater than $15
      ]
    }
  },
  'home_kitchen_decor_garden': {
    name: 'Home, Kitchen, Decor & Garden',
    feeStructure: { type: 'flat', percentage: 15 }
  },
  'indoor_outdoor_furniture': {
    name: 'Indoor & Outdoor Furniture',
    feeStructure: {
      type: 'portion',
      portions: [
        { upTo: 20000, percentage: 15 },        // up to $200
        { upTo: null, percentage: 10 }          // above $200
      ]
    }
  },
  'industrial_scientific': {
    name: 'Industrial & Scientific Supplies',
    feeStructure: { type: 'flat', percentage: 12 }
  },
  'jewelry_precious_metals': {
    name: 'Jewelry & Precious Metals',
    feeStructure: {
      type: 'portion',
      portions: [
        { upTo: 25000, percentage: 20 },        // up to $250
        { upTo: null, percentage: 5 }           // above $250
      ]
    }
  },
  'luggage_travel': {
    name: 'Luggage & Travel Accessories',
    feeStructure: { type: 'flat', percentage: 15 }
  },
  'music': {
    name: 'Music',
    feeStructure: { type: 'flat', percentage: 15 }
  },
  'musical_instruments': {
    name: 'Musical Instruments',
    feeStructure: { type: 'flat', percentage: 12 }
  },
  'office_products': {
    name: 'Office Products',
    feeStructure: { type: 'flat', percentage: 15 },
    notes: '12% for printer cartridges'
  },
  'outdoor_power_tools': {
    name: 'Outdoor Power Tools',
    feeStructure: {
      type: 'tiered',
      tiers: [
        { maxPrice: 50000, percentage: 15 },    // up to $500
        { maxPrice: null, percentage: 8 }       // greater than $500
      ]
    }
  },
  'outdoors_sports': {
    name: 'Outdoors Products & Sports',
    feeStructure: { type: 'flat', percentage: 15 },
    notes: '8% for hunting trail monitors, binoculars, telescopes, spotting scopes, night vision goggles'
  },
  'personal_computers': {
    name: 'Personal Computers',
    feeStructure: { type: 'flat', percentage: 6 }
  },
  'pet_supplies': {
    name: 'Pet Supplies',
    feeStructure: { type: 'flat', percentage: 15 }
  },
  'plumbing_hvac': {
    name: 'Plumbing Heating Cooling & Ventilation',
    feeStructure: { type: 'flat', percentage: 10 }
  },
  'shoes_handbags_accessories': {
    name: 'Shoes, Handbags, Backpacks & Sunglasses',
    feeStructure: { type: 'flat', percentage: 15 }
  },
  'software_games': {
    name: 'Software & Computer Video Games',
    feeStructure: { type: 'flat', percentage: 15 }
  },
  'tires_wheels': {
    name: 'Tires & Wheels',
    feeStructure: { type: 'flat', percentage: 10 }
  },
  'tools_home_improvement': {
    name: 'Tools & Home Improvement',
    feeStructure: { type: 'flat', percentage: 15 }
  },
  'toys_games': {
    name: 'Toys & Games',
    feeStructure: { type: 'flat', percentage: 15 }
  },
  'video_dvd': {
    name: 'Video & DVD',
    feeStructure: { type: 'flat', percentage: 15 }
  },
  'video_game_consoles': {
    name: 'Video Game Consoles',
    feeStructure: { type: 'flat', percentage: 8 }
  },
  'watches': {
    name: 'Watches',
    feeStructure: {
      type: 'portion',
      portions: [
        { upTo: 150000, percentage: 15 },       // up to $1,500
        { upTo: null, percentage: 3 }           // above $1,500
      ]
    }
  },
  'everything_else': {
    name: 'Everything Else',
    feeStructure: { type: 'flat', percentage: 15 }
  }
};

/**
 * Mapping from Walmart taxonomy categories to contract categories
 * This maps the category path from Walmart catalog to referral fee categories
 */
export const TAXONOMY_TO_CONTRACT_MAPPING: Record<string, string> = {
  // Electronics categories
  'Electronics': 'consumer_electronics',
  'Marine Electronics': 'consumer_electronics',
  'Transducers & Accessories': 'electronics_accessories',
  'Cell Phones': 'consumer_electronics',
  'Computers': 'personal_computers',
  'Laptops': 'personal_computers',
  'Tablets': 'personal_computers',
  'Computer Accessories': 'electronics_accessories',
  'TV & Video': 'consumer_electronics',
  'Audio': 'consumer_electronics',
  'Camera & Photo': 'camera_photo',
  'Cameras': 'camera_photo',
  'Wearable Technology': 'electronics_accessories',
  'Smart Home': 'consumer_electronics',
  'Video Games': 'software_games',
  'Video Game Consoles': 'video_game_consoles',
  'GPS & Navigation': 'consumer_electronics',
  
  // Apparel & Fashion
  'Clothing': 'apparel_accessories',
  'Apparel': 'apparel_accessories',
  'Fashion': 'apparel_accessories',
  "Men's Clothing": 'apparel_accessories',
  "Women's Clothing": 'apparel_accessories',
  "Kids' Clothing": 'apparel_accessories',
  'Shoes': 'shoes_handbags_accessories',
  'Handbags': 'shoes_handbags_accessories',
  'Backpacks': 'shoes_handbags_accessories',
  'Sunglasses': 'shoes_handbags_accessories',
  'Bags & Accessories': 'shoes_handbags_accessories',
  'Jewelry': 'jewelry_precious_metals',
  'Watches': 'watches',
  'Fine Jewelry': 'jewelry_precious_metals',
  
  // Home & Garden
  'Home': 'home_kitchen_decor_garden',
  'Kitchen': 'home_kitchen_decor_garden',
  'Kitchen & Dining': 'home_kitchen_decor_garden',
  'Decor': 'home_kitchen_decor_garden',
  'Garden': 'home_kitchen_decor_garden',
  'Patio & Garden': 'home_kitchen_decor_garden',
  'Furniture': 'indoor_outdoor_furniture',
  'Living Room Furniture': 'indoor_outdoor_furniture',
  'Bedroom Furniture': 'indoor_outdoor_furniture',
  'Office Furniture': 'indoor_outdoor_furniture',
  'Outdoor Furniture': 'indoor_outdoor_furniture',
  'Bedding': 'home_kitchen_decor_garden',
  'Bath': 'home_kitchen_decor_garden',
  'Storage & Organization': 'home_kitchen_decor_garden',
  
  // Appliances
  'Appliances': 'appliances_major',
  'Large Appliances': 'appliances_major',
  'Major Appliances': 'appliances_major',
  'Small Appliances': 'appliances_compact',
  'Compact Appliances': 'appliances_compact',
  'Refrigerators': 'appliances_major',
  'Washers & Dryers': 'appliances_major',
  'Ranges & Ovens': 'appliances_major',
  'Dishwashers': 'appliances_major',
  'Microwaves': 'appliances_compact',
  'Coffee Makers': 'appliances_compact',
  'Blenders': 'appliances_compact',
  
  // Tools & Hardware
  'Tools': 'tools_home_improvement',
  'Power Tools': 'base_power_tools',
  'Hand Tools': 'tools_home_improvement',
  'Tool Storage': 'tools_home_improvement',
  'Hardware': 'tools_home_improvement',
  'Home Improvement': 'tools_home_improvement',
  'Plumbing': 'plumbing_hvac',
  'Heating & Cooling': 'plumbing_hvac',
  'HVAC': 'plumbing_hvac',
  'Electrical': 'tools_home_improvement',
  'Building Materials': 'tools_home_improvement',
  'Outdoor Power Equipment': 'outdoor_power_tools',
  'Lawn Mowers': 'outdoor_power_tools',
  'Snow Blowers': 'outdoor_power_tools',
  'Chainsaws': 'outdoor_power_tools',
  
  // Automotive
  'Auto': 'automotive_powersports',
  'Automotive': 'automotive_powersports',
  'Auto & Tires': 'automotive_powersports',
  'Car Electronics': 'automotive_powersports',
  'Auto Parts': 'automotive_powersports',
  'Tires': 'tires_wheels',
  'Wheels': 'tires_wheels',
  'Powersports': 'automotive_powersports',
  'Motorcycles': 'automotive_powersports',
  'ATVs': 'automotive_powersports',
  
  // Sports & Outdoors
  'Sports': 'outdoors_sports',
  'Sports & Outdoors': 'outdoors_sports',
  'Outdoors': 'outdoors_sports',
  'Exercise & Fitness': 'outdoors_sports',
  'Camping & Hiking': 'outdoors_sports',
  'Hunting': 'outdoors_sports',
  'Fishing': 'outdoors_sports',
  'Biking': 'outdoors_sports',
  'Team Sports': 'outdoors_sports',
  'Binoculars': 'outdoors_sports',  // 8% exception
  'Telescopes': 'outdoors_sports',  // 8% exception
  
  // Baby & Kids
  'Baby': 'baby_products',
  'Baby Products': 'baby_products',
  'Baby Gear': 'baby_products',
  'Nursery': 'baby_products',
  'Toys': 'toys_games',
  'Toys & Games': 'toys_games',
  'Games': 'toys_games',
  'Puzzles': 'toys_games',
  'Arts & Crafts': 'toys_games',
  
  // Health & Beauty
  'Beauty': 'beauty_health_personal_care',
  'Health': 'beauty_health_personal_care',
  'Personal Care': 'beauty_health_personal_care',
  'Pharmacy': 'beauty_health_personal_care',
  'Vitamins': 'beauty_health_personal_care',
  'Skincare': 'beauty_health_personal_care',
  'Haircare': 'beauty_health_personal_care',
  'Makeup': 'beauty_health_personal_care',
  
  // Food & Grocery
  'Food': 'grocery',
  'Grocery': 'grocery',
  'Beverages': 'grocery',
  'Snacks': 'grocery',
  'Pantry': 'grocery',
  'Fresh Food': 'grocery',
  
  // Pets
  'Pets': 'pet_supplies',
  'Pet Supplies': 'pet_supplies',
  'Dog': 'pet_supplies',
  'Cat': 'pet_supplies',
  'Fish': 'pet_supplies',
  'Bird': 'pet_supplies',
  
  // Office & School
  'Office': 'office_products',
  'Office Supplies': 'office_products',
  'School Supplies': 'office_products',
  'Printer Ink': 'office_products',  // 12% exception
  'Printer Cartridges': 'office_products',  // 12% exception
  
  // Media & Entertainment
  'Books': 'books',
  'Music': 'music',
  'Movies': 'video_dvd',
  'Movies & TV': 'video_dvd',
  'DVD': 'video_dvd',
  'Blu-ray': 'video_dvd',
  'Musical Instruments': 'musical_instruments',
  
  // Industrial
  'Industrial': 'industrial_scientific',
  'Industrial & Scientific': 'industrial_scientific',
  'Safety': 'industrial_scientific',
  'Janitorial': 'industrial_scientific',
  
  // Travel
  'Luggage': 'luggage_travel',
  'Travel': 'luggage_travel',
  'Travel Accessories': 'luggage_travel',
  
  // Collectibles
  'Collectibles': 'collectibles',
  'Collectibles & Art': 'collectibles'
};

/**
 * Calculate referral fee for a product
 * @param priceInCents - Sale price in cents
 * @param feeStructure - The fee structure for the category
 * @returns Fee in cents
 */
export function calculateFee(priceInCents: number, feeStructure: FeeStructure): number {
  if (priceInCents <= 0) return 0;
  
  switch (feeStructure.type) {
    case 'flat':
      return Math.round(priceInCents * (feeStructure.percentage / 100));
      
    case 'tiered':
      // Tiered: One percentage based on total price
      for (const tier of feeStructure.tiers) {
        if (tier.maxPrice === null || priceInCents <= tier.maxPrice) {
          return Math.round(priceInCents * (tier.percentage / 100));
        }
      }
      // Fallback to last tier
      const lastTier = feeStructure.tiers[feeStructure.tiers.length - 1];
      return Math.round(priceInCents * (lastTier.percentage / 100));
      
    case 'portion':
      // Portion-based: Different percentages for different portions of the price
      let remainingPrice = priceInCents;
      let totalFee = 0;
      let previousUpTo = 0;
      
      for (const portion of feeStructure.portions) {
        if (remainingPrice <= 0) break;
        
        const portionUpTo = portion.upTo ?? Infinity;
        const portionSize = Math.min(remainingPrice, portionUpTo - previousUpTo);
        
        if (portionSize > 0) {
          totalFee += Math.round(portionSize * (portion.percentage / 100));
          remainingPrice -= portionSize;
          previousUpTo = portionUpTo;
        }
      }
      
      return totalFee;
      
    default:
      // Default to 15% (Everything Else)
      return Math.round(priceInCents * 0.15);
  }
}

/**
 * Determine contract category from Walmart taxonomy path
 * @param categoryPath - Array of category names from Walmart taxonomy
 * @returns Contract category key or 'everything_else' if no match
 */
export function getContractCategory(categoryPath: string[] | null): string {
  if (!categoryPath || categoryPath.length === 0) {
    return 'everything_else';
  }
  
  // Check each category in path, starting from most specific (last) to most general (first)
  for (let i = categoryPath.length - 1; i >= 0; i--) {
    const category = categoryPath[i];
    if (TAXONOMY_TO_CONTRACT_MAPPING[category]) {
      return TAXONOMY_TO_CONTRACT_MAPPING[category];
    }
  }
  
  return 'everything_else';
}

/**
 * Get fee structure description for display
 */
export function getFeeDescription(contractCategoryKey: string): string {
  const category = WALMART_REFERRAL_FEES[contractCategoryKey];
  if (!category) return '15% (Default)';
  
  const fs = category.feeStructure;
  
  switch (fs.type) {
    case 'flat':
      return `${fs.percentage}%`;
      
    case 'tiered':
      return fs.tiers.map((tier, i) => {
        const prev = i > 0 ? fs.tiers[i - 1].maxPrice! / 100 : 0;
        if (tier.maxPrice === null) {
          return `${tier.percentage}% above $${prev}`;
        }
        return `${tier.percentage}% up to $${tier.maxPrice / 100}`;
      }).join(', ');
      
    case 'portion':
      return fs.portions.map((portion, i) => {
        if (portion.upTo === null) {
          const prev = i > 0 ? fs.portions[i - 1].upTo! / 100 : 0;
          return `${portion.percentage}% above $${prev}`;
        }
        return `${portion.percentage}% on first $${portion.upTo / 100}`;
      }).join(', ');
      
    default:
      return '15%';
  }
}

export interface ReferralFeeResult {
  contractCategoryKey: string;
  contractCategoryName: string;
  feeInCents: number;
  feePercentageEffective: number;
  feeDescription: string;
  notes?: string;
}

/**
 * Calculate complete referral fee information for a product
 * @param priceInCents - Sale price in cents
 * @param categoryPath - Walmart taxonomy category path
 * @returns Complete fee calculation result
 */
export function calculateReferralFee(
  priceInCents: number,
  categoryPath: string[] | null
): ReferralFeeResult {
  const contractCategoryKey = getContractCategory(categoryPath);
  const category = WALMART_REFERRAL_FEES[contractCategoryKey] || WALMART_REFERRAL_FEES['everything_else'];
  
  const feeInCents = calculateFee(priceInCents, category.feeStructure);
  const feePercentageEffective = priceInCents > 0 
    ? Math.round((feeInCents / priceInCents) * 10000) / 100 
    : 0;
  
  return {
    contractCategoryKey,
    contractCategoryName: category.name,
    feeInCents,
    feePercentageEffective,
    feeDescription: getFeeDescription(contractCategoryKey),
    notes: category.notes
  };
}

/**
 * Get all available contract categories for display
 */
export function getAllContractCategories(): Array<{
  key: string;
  name: string;
  feeDescription: string;
  notes?: string;
}> {
  return Object.entries(WALMART_REFERRAL_FEES).map(([key, category]) => ({
    key,
    name: category.name,
    feeDescription: getFeeDescription(key),
    notes: category.notes
  }));
}
