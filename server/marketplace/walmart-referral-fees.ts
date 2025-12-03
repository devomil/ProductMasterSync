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
 * Mapping from Walmart product types to contract categories
 * This maps the productType field from Walmart items API to referral fee categories
 */
export const PRODUCT_TYPE_TO_CONTRACT_MAPPING: Record<string, string> = {
  // Electronics Accessories - 15% up to $100, 8% above $100
  'Uninterruptible Power Supplies': 'electronics_accessories',
  'Surge Protectors': 'electronics_accessories',
  'Power Strips': 'electronics_accessories',
  'Computer Cables': 'electronics_accessories',
  'USB Cables': 'electronics_accessories',
  'HDMI Cables': 'electronics_accessories',
  'Network Cables': 'electronics_accessories',
  'Computer Cable Adapters': 'electronics_accessories',
  'Phone Cases': 'electronics_accessories',
  'Phone Chargers': 'electronics_accessories',
  'Phone Cables': 'electronics_accessories',
  'Tablet Cases': 'electronics_accessories',
  'Laptop Bags': 'electronics_accessories',
  'Laptop Cases': 'electronics_accessories',
  'Mouse Pads': 'electronics_accessories',
  'Keyboard Covers': 'electronics_accessories',
  'Screen Protectors': 'electronics_accessories',
  'Memory Cards': 'electronics_accessories',
  'USB Flash Drives': 'electronics_accessories',
  'External Hard Drives': 'electronics_accessories',
  'Webcams': 'electronics_accessories',
  'Microphones': 'electronics_accessories',
  'Headphones': 'electronics_accessories',
  'Earbuds': 'electronics_accessories',
  'Speakers': 'electronics_accessories',
  'Bluetooth Speakers': 'electronics_accessories',
  'Power Banks': 'electronics_accessories',
  'Portable Chargers': 'electronics_accessories',
  'Car Chargers': 'electronics_accessories',
  'Wall Chargers': 'electronics_accessories',
  'Wireless Chargers': 'electronics_accessories',
  'Docking Stations': 'electronics_accessories',
  'Monitor Stands': 'electronics_accessories',
  'Laptop Stands': 'electronics_accessories',
  'TV Mounts': 'electronics_accessories',
  'Remote Controls': 'electronics_accessories',
  'Batteries': 'electronics_accessories',
  'Battery Chargers': 'electronics_accessories',
  'Home Assistants': 'electronics_accessories',
  'Smart Plugs': 'electronics_accessories',
  'Smart Switches': 'electronics_accessories',
  'Network Switch Modules': 'electronics_accessories',
  'Network Switches': 'electronics_accessories',
  'Network Testers': 'electronics_accessories',
  'KVM Switches': 'electronics_accessories',
  'Wireless Access Points': 'electronics_accessories',
  'Network Routers': 'electronics_accessories',
  'Network Adapters': 'electronics_accessories',
  'Network Security Devices': 'electronics_accessories',
  'Network Cards': 'electronics_accessories',
  'Network-Attached Storage Servers': 'electronics_accessories',
  'USB Hubs': 'electronics_accessories',
  'Portable Speakers': 'electronics_accessories',
  'Computer Speakers': 'electronics_accessories',
  'Laptop Docking Stations': 'electronics_accessories',
  'Electronics Docks & Cradles': 'electronics_accessories',
  'Electronics Stands': 'electronics_accessories',
  'Portable Power Packs': 'electronics_accessories',
  'Power Distribution Units': 'electronics_accessories',
  'Power Adapters': 'electronics_accessories',
  'Power Cables': 'electronics_accessories',
  'Cable Splitters': 'electronics_accessories',
  'Signal Repeaters': 'electronics_accessories',
  'Wireless Repeaters & Transceivers': 'electronics_accessories',
  'Memory Card Readers': 'electronics_accessories',
  'Barcode Scanners': 'electronics_accessories',
  'Computer Racks & Mounts': 'electronics_accessories',
  'Computer Rack Hardware & Accessories': 'electronics_accessories',
  'Computer Cooling': 'electronics_accessories',
  'Computer Power Supplies': 'electronics_accessories',
  'Computer Cases': 'electronics_accessories',
  'Computer Video Cards': 'electronics_accessories',
  'Processors': 'electronics_accessories',
  'Computer Port Cards': 'electronics_accessories',
  'Computer Replacement Parts': 'electronics_accessories',
  'Computer Scanners': 'electronics_accessories',
  'Computer Patch Panels': 'electronics_accessories',
  'Other Computer Accessories': 'electronics_accessories',
  'Other Electronic Components & Accessories': 'electronics_accessories',
  'USB Wi-Fi Adapters': 'electronics_accessories',
  'Analog-to-Digital Converters': 'electronics_accessories',
  'Video Capture Devices': 'electronics_accessories',
  'Cable Testers': 'electronics_accessories',
  'Print Servers': 'electronics_accessories',
  'Thin Clients': 'electronics_accessories',
  'Computer Tape Drives': 'electronics_accessories',
  'Drive Bay Caddies': 'electronics_accessories',
  'Headset Adapters': 'electronics_accessories',
  'Surge Suppressors': 'electronics_accessories',
  'Device-Specific Electronics Batteries': 'electronics_accessories',
  'Device-Specific Electronics Chargers': 'electronics_accessories',
  'Electronics Film Protectors': 'electronics_accessories',
  'Electronics Carrying Cases': 'electronics_accessories',
  'Electronics Cleaning Kits': 'electronics_accessories',
  'Electronics Cleaning Cloths': 'electronics_accessories',
  'Cigarette Lighter Adapters': 'electronics_accessories',
  'Car Mounts': 'electronics_accessories',
  'Camera & Camcorder Mounts': 'electronics_accessories',
  'Optical Disk Drives': 'electronics_accessories',
  'Optical Recording Media': 'electronics_accessories',
  'General Purpose Batteries': 'electronics_accessories',
  'Button Cell Batteries': 'electronics_accessories',
  'Projector Replacement Lamps': 'electronics_accessories',
  'Projector Mounts': 'electronics_accessories',
  'Video Switchers': 'electronics_accessories',
  'Magnetic Stripe Readers': 'electronics_accessories',
  'Cable Connectors': 'electronics_accessories',
  'Audio/Video Cables': 'electronics_accessories',
  'Flash Drives': 'electronics_accessories',
  'Hard Drives': 'electronics_accessories',
  'RAM Memory': 'electronics_accessories',
  'Motherboards': 'electronics_accessories',
  'TV & Monitor Mounts': 'electronics_accessories',
  'Headsets': 'electronics_accessories',
  'Computer Mice': 'electronics_accessories',
  'Computer Keyboards': 'electronics_accessories',
  'Cell Phone Cases': 'electronics_accessories',
  'Tablet Holders, Carriers & Cases': 'electronics_accessories',
  'Tablet Computer Stands': 'electronics_accessories',
  'Laptop Sleeves': 'electronics_accessories',
  'Laptop Shells': 'electronics_accessories',
  'Laptop Cooling Pads': 'electronics_accessories',
  'Telephone Cables': 'electronics_accessories',
  'Earbud Tips': 'electronics_accessories',
  'Earbud Straps': 'electronics_accessories',
  'Headphone Cases': 'electronics_accessories',
  'Electronics Port Dust Covers': 'electronics_accessories',
  'Electronics Hand Straps': 'electronics_accessories',
  'Selfie Sticks': 'electronics_accessories',
  'Graphics Tablets': 'electronics_accessories',
  'Presentation Remotes': 'electronics_accessories',
  'USB Lights': 'electronics_accessories',
  'Ring Lights': 'electronics_accessories',
  'On-Camera Lights': 'electronics_accessories',
  'Webcam Privacy Covers': 'electronics_accessories',
  'Computer Glasses': 'electronics_accessories',
  'Digital Pens': 'electronics_accessories',
  'Electronic Touchpads': 'electronics_accessories',
  'Fingerprint Readers': 'electronics_accessories',
  'Data Backup Media': 'electronics_accessories',
  'Lighting Cables': 'electronics_accessories',
  'Cable Markers': 'electronics_accessories',
  'Wire & Cable Organizers': 'electronics_accessories',
  'Wire Connectors': 'electronics_accessories',
  'Terminal Blocks': 'electronics_accessories',
  'Fiber Optic Connectors': 'electronics_accessories',
  'MIDI Adapters': 'electronics_accessories',
  'Headphone Amplifiers': 'electronics_accessories',
  'Distribution Amplifiers': 'electronics_accessories',
  'Audio Power Amplifiers': 'electronics_accessories',
  'Microphone Cables': 'electronics_accessories',
  'Instrument Cables': 'electronics_accessories',
  'Microphone Stands & Booms': 'electronics_accessories',
  'Speaker Mounts & Brackets': 'electronics_accessories',
  'Antenna Mounts & Brackets': 'electronics_accessories',
  'GPS Antennas': 'electronics_accessories',
  'Cell Phone Signal Boosters': 'electronics_accessories',
  'Cell Phone Tool Kits': 'electronics_accessories',
  'FM Transmitters': 'electronics_accessories',
  'TV Tuners': 'electronics_accessories',
  'Television Signal Amplifiers': 'electronics_accessories',
  'Line Conditioners': 'electronics_accessories',
  'Power Entry Modules': 'electronics_accessories',
  'Power Transformers': 'electronics_accessories',
  'DC-to-DC Converters': 'electronics_accessories',
  'Digital-to-Analog Converters': 'electronics_accessories',
  'General Purpose Battery Chargers': 'electronics_accessories',
  'Test Probes & Leads': 'electronics_accessories',
  'Voltage Testers': 'electronics_accessories',
  'Circuit Testers': 'electronics_accessories',
  'Electric Power Testers': 'electronics_accessories',
  'Current Testers': 'electronics_accessories',
  'Wattmeters': 'electronics_accessories',
  'Multimeters': 'electronics_accessories',
  'Cable Insertion & Extraction Tools': 'electronics_accessories',
  'Electronic Component Sensors': 'electronics_accessories',
  'Other Electronic Components': 'electronics_accessories',
  'Other TV & Video Accessories': 'electronics_accessories',
  'Other Home Audio Accessories': 'electronics_accessories',
  'Other Cell Phone Accessories': 'electronics_accessories',
  'Other Projector Accessories': 'electronics_accessories',
  'Other Test & Measurement Equipment': 'electronics_accessories',
  'Other Electrical Equipment Supplies': 'electronics_accessories',
  
  // Flash Memory and Storage
  'Flash Memory': 'electronics_accessories',
  'Flash Memory Cards': 'electronics_accessories',
  'Memory Card Cases': 'electronics_accessories',
  'Memory Card Readers': 'electronics_accessories',
  'USB Flash Drives': 'electronics_accessories',
  
  // Screen and Privacy Protection
  'Screen Privacy Filters': 'electronics_accessories',
  'Screen Protectors': 'electronics_accessories',
  'Privacy Screens': 'electronics_accessories',
  
  // Voice and Recording Devices
  'Voice Recorders': 'electronics_accessories',
  'Digital Voice Recorders': 'electronics_accessories',
  'Dictation Machines': 'electronics_accessories',
  
  // Network and Connectivity
  'Patch Cables': 'electronics_accessories',
  'Network Patch Cables': 'electronics_accessories',
  'VoIP Phone Adapters': 'electronics_accessories',
  'VoIP Phones': 'consumer_electronics',
  'KVM Switches': 'electronics_accessories',
  'USB Hubs': 'electronics_accessories',
  'Network Cards': 'electronics_accessories',
  'Wireless Network Adapters': 'electronics_accessories',
  'Wireless Access Points': 'electronics_accessories',
  'Network Switches': 'electronics_accessories',
  'Routers': 'consumer_electronics',
  'Modems': 'consumer_electronics',
  'Network Interface Cards': 'electronics_accessories',
  
  // Power and Battery
  'Power Adapters': 'electronics_accessories',
  'AC Adapters': 'electronics_accessories',
  'DC Adapters': 'electronics_accessories',
  'Battery Backups': 'electronics_accessories',
  'UPS Systems': 'electronics_accessories',
  'Uninterruptible Power Supplies': 'electronics_accessories',
  'Device-Specific Electronics Batteries': 'electronics_accessories',
  'Device-Specific Electronics Chargers': 'electronics_accessories',
  'Laptop Batteries': 'electronics_accessories',
  'Camera Batteries': 'electronics_accessories',
  'Phone Batteries': 'electronics_accessories',
  'Tablet Batteries': 'electronics_accessories',
  
  // Audio Components
  'Sound Cards': 'electronics_accessories',
  'Internal Sound Cards': 'electronics_accessories',
  'External Sound Cards': 'electronics_accessories',
  'Audio Interfaces': 'electronics_accessories',
  
  // Computer Racks and Mounting
  'Computer Racks & Mounts': 'electronics_accessories',
  'Computer Rack Hardware & Accessories': 'electronics_accessories',
  'Server Racks': 'electronics_accessories',
  'Rack Mount Hardware': 'electronics_accessories',
  'Computer Port Cards': 'electronics_accessories',
  'Expansion Cards': 'electronics_accessories',
  
  // Docking and Charging
  'Electronics Docks & Cradles': 'electronics_accessories',
  'Laptop Docking Stations': 'electronics_accessories',
  'Tablet Docking Stations': 'electronics_accessories',
  'Phone Docking Stations': 'electronics_accessories',
  'Charging Docks': 'electronics_accessories',
  
  // Earbud Accessories
  'Earbud Covers': 'electronics_accessories',
  'Earphone Cushions': 'electronics_accessories',
  'Ear Pads': 'electronics_accessories',
  'Earphone Tips': 'electronics_accessories',
  
  // Printer Accessories
  'Printer Transfer Rollers': 'office_products',
  'Printer Rollers': 'office_products',
  'Printer Drums': 'office_products',
  'Printer Fusers': 'office_products',
  'Printer Maintenance Kits': 'office_products',
  
  // Other Electronic Components
  'Other Electronic Components & Accessories': 'electronics_accessories',
  'Electronic Kits': 'electronics_accessories',
  'Electronic Modules': 'electronics_accessories',
  
  // Media and Duplication
  'Media Duplicators': 'electronics_accessories',
  'CD Duplicators': 'electronics_accessories',
  'DVD Duplicators': 'electronics_accessories',
  'Blu-ray Duplicators': 'electronics_accessories',
  
  // Network Hardware
  'Network Hubs': 'electronics_accessories',
  'Ethernet Hubs': 'electronics_accessories',
  'Networking Hubs': 'electronics_accessories',
  
  // Metal Detectors and Security
  'Metal Detectors': 'electronics_accessories',
  'Security Metal Detectors': 'electronics_accessories',
  'Hand-Held Metal Detectors': 'electronics_accessories',
  
  // Audio and PA Systems
  'Megaphones': 'consumer_electronics',
  'Bullhorns': 'consumer_electronics',
  'Boomboxes': 'consumer_electronics',
  'Portable Stereos': 'consumer_electronics',
  'PA Systems': 'consumer_electronics',
  'Public Address Systems': 'consumer_electronics',
  'Audio Mixers': 'consumer_electronics',
  'DJ Mixers': 'consumer_electronics',
  'Mixing Consoles': 'consumer_electronics',
  'Loudspeakers': 'consumer_electronics',
  'PA Speakers': 'consumer_electronics',
  'CD Players': 'consumer_electronics',
  'Portable CD Players': 'consumer_electronics',
  'Digital Audio Players': 'consumer_electronics',
  'MP3 Players': 'consumer_electronics',
  'Blank Audio Tapes': 'consumer_electronics',
  'Cassette Tapes': 'consumer_electronics',
  
  // Portable Video
  'Portable Blu Ray & DVD Players': 'consumer_electronics',
  'Portable DVD Players': 'consumer_electronics',
  'Portable Blu-ray Players': 'consumer_electronics',
  'Mini Projectors': 'consumer_electronics',
  'Pocket Projectors': 'consumer_electronics',
  'Pico Projectors': 'consumer_electronics',
  
  // Older Mobile Devices
  'PDAs': 'consumer_electronics',
  'Personal Digital Assistants': 'consumer_electronics',
  'Handheld Computers': 'consumer_electronics',
  
  // Office Equipment
  'Cash Registers': 'office_products',
  'POS Systems': 'office_products',
  'Point of Sale Systems': 'office_products',
  'Printer Transfer Belts': 'office_products',
  'Shredder Bags': 'office_products',
  'Shredder Accessories': 'office_products',
  'Typewriter Ribbons': 'office_products',
  'Typewriter Supplies': 'office_products',
  'Phone Shoulder Rests': 'office_products',
  'Telephone Accessories': 'office_products',
  'Sticky Notes': 'office_products',
  'Post-it Notes': 'office_products',
  'Adhesive Notes': 'office_products',
  
  // T-Shirts and Apparel
  'T-Shirts': 'apparel_accessories',
  'Tee Shirts': 'apparel_accessories',
  'Shirts': 'apparel_accessories',
  
  // Workstations and High-End Computers
  'Workstations': 'personal_computers',
  'Computer Workstations': 'personal_computers',
  
  // Wireless Input Devices
  'Wireless Keypads': 'electronics_accessories',
  'Numeric Keypads': 'electronics_accessories',
  
  // Luggage and Travel
  'Briefcases': 'luggage_travel',
  'Attache Cases': 'luggage_travel',
  'Document Cases': 'luggage_travel',
  'Duffel Bags': 'luggage_travel',
  'Duffle Bags': 'luggage_travel',
  'Gym Bags': 'luggage_travel',
  'Luggage Scales': 'luggage_travel',
  'Travel Scales': 'luggage_travel',
  'Travel Accessories': 'luggage_travel',
  
  // Handbags and Accessories
  'Handbags': 'shoes_handbags_accessories',
  'Purses': 'shoes_handbags_accessories',
  'Shoulder Bags': 'shoes_handbags_accessories',
  
  // Fitness and Exercise Equipment
  'Yoga Mats': 'outdoors_sports',
  'Exercise Mats': 'outdoors_sports',
  'Exercise Balls': 'outdoors_sports',
  'Stability Balls': 'outdoors_sports',
  'Fitness Equipment': 'outdoors_sports',
  
  // Lab and Safety Equipment
  'Lab Face Masks & Shields': 'industrial_scientific',
  'Lab Safety Equipment': 'industrial_scientific',
  'Eye Wash Units': 'industrial_scientific',
  'Eye Wash Stations': 'industrial_scientific',
  'Emergency Eye Wash': 'industrial_scientific',
  
  // Office Equipment Additions
  'Fax Machines': 'office_products',
  'Fax Equipment': 'office_products',
  'Name Plates': 'office_products',
  'Desk Name Plates': 'office_products',
  'Coin Counters, Sorters & Changers': 'office_products',
  'Coin Counters': 'office_products',
  'Coin Sorters': 'office_products',
  
  // Optics and Vision
  'Binoculars': 'camera_photo',
  'Telescopes': 'camera_photo',
  'Spotting Scopes': 'camera_photo',
  'Magnifiers & Low-Vision Aids': 'office_products',
  'Magnifying Glasses': 'office_products',
  
  // More Consumer Electronics
  'Blu Ray & DVD Players': 'consumer_electronics',
  'Blu-Ray/DVD Combo Players': 'consumer_electronics',
  'Video Monitors': 'consumer_electronics',
  'Security Monitors': 'consumer_electronics',
  'Corded/Cordless Phone Combos': 'consumer_electronics',
  'Phone Combos': 'consumer_electronics',
  'Karaoke Machines': 'consumer_electronics',
  'Karaoke Systems': 'consumer_electronics',
  'Cassette Tape Recorders': 'consumer_electronics',
  'Tape Recorders': 'consumer_electronics',
  'Compact Stereos': 'consumer_electronics',
  'Stereo Systems': 'consumer_electronics',
  'Disc Repairers': 'consumer_electronics',
  'CD/DVD Repair Kits': 'consumer_electronics',
  
  // Safety Footwear
  'Safety Shoes & Boots': 'industrial_scientific',
  'Work Boots': 'industrial_scientific',
  'Safety Footwear': 'industrial_scientific',
  
  // Other Hardware
  'Other Hardware': 'electronics_accessories',
  'Hardware Accessories': 'electronics_accessories',
  
  // Consumer Electronics - 8% flat
  'Televisions': 'consumer_electronics',
  'TVs': 'consumer_electronics',
  'Smart TVs': 'consumer_electronics',
  'Streaming Devices': 'consumer_electronics',
  'Streaming Media Players': 'consumer_electronics',
  'Blu-ray Players': 'consumer_electronics',
  'DVD Players': 'consumer_electronics',
  'Soundbars': 'consumer_electronics',
  'Sound Bars': 'consumer_electronics',
  'Home Theater Systems': 'consumer_electronics',
  'Home Speakers & Subwoofers': 'consumer_electronics',
  'Receivers': 'consumer_electronics',
  'Audio & Video Receivers': 'consumer_electronics',
  'Projectors': 'consumer_electronics',
  'Multimedia Projectors': 'consumer_electronics',
  'Video Projectors': 'consumer_electronics',
  'Cell Phones': 'consumer_electronics',
  'Smartphones': 'consumer_electronics',
  'GPS Devices': 'consumer_electronics',
  'Aerial Drones': 'consumer_electronics',
  'Drones': 'consumer_electronics',
  'Intercoms': 'consumer_electronics',
  'Surveillance Cameras': 'consumer_electronics',
  'Video Cameras': 'consumer_electronics',
  'Two-Way Radios': 'consumer_electronics',
  'Portable Radios': 'consumer_electronics',
  'VoIP Phones': 'consumer_electronics',
  'Cordless Phones': 'consumer_electronics',
  'Corded Phones': 'consumer_electronics',
  'Audio Conferencing Phones': 'consumer_electronics',
  'Modems': 'consumer_electronics',
  'Car In-Dash Units': 'consumer_electronics',
  'TV Antennas': 'consumer_electronics',
  'Antennas': 'consumer_electronics',
  'Smart Watches': 'consumer_electronics',
  'Fitness Trackers': 'consumer_electronics',
  'Digital Video Recorders': 'consumer_electronics',
  
  // Personal Computers - 6% flat
  'Laptops': 'personal_computers',
  'Laptop Computers': 'personal_computers',
  'Desktop Computers': 'personal_computers',
  'Chromebooks': 'personal_computers',
  'Tablets': 'personal_computers',
  'Monitors': 'personal_computers',
  'Computer Monitors': 'personal_computers',
  'All-in-One Computers': 'personal_computers',
  
  // Camera & Photo - 8% flat
  'Cameras': 'camera_photo',
  'Digital Cameras': 'camera_photo',
  'DSLR Cameras': 'camera_photo',
  'Mirrorless Cameras': 'camera_photo',
  'Action Cameras': 'camera_photo',
  'Camcorders': 'camera_photo',
  'Camera Lenses': 'camera_photo',
  'Camera Bags': 'camera_photo',
  'Tripods': 'camera_photo',
  'Camera Accessories': 'camera_photo',
  
  // Major Appliances - 8% flat
  'Refrigerators': 'appliances_major',
  'Freezers': 'appliances_major',
  'Washers': 'appliances_major',
  'Dryers': 'appliances_major',
  'Dishwashers': 'appliances_major',
  'Ranges': 'appliances_major',
  'Ovens': 'appliances_major',
  'Range Hoods': 'appliances_major',
  'Cooktops': 'appliances_major',
  'Wall Ovens': 'appliances_major',
  
  // Compact Appliances - 12% up to $300, 8% above
  'Microwaves': 'appliances_compact',
  'Coffee Makers': 'appliances_compact',
  'Blenders': 'appliances_compact',
  'Toasters': 'appliances_compact',
  'Air Fryers': 'appliances_compact',
  'Slow Cookers': 'appliances_compact',
  'Food Processors': 'appliances_compact',
  'Stand Mixers': 'appliances_compact',
  'Vacuum Cleaners': 'appliances_compact',
  'Robot Vacuums': 'appliances_compact',
  'Air Purifiers': 'appliances_compact',
  'Humidifiers': 'appliances_compact',
  'Dehumidifiers': 'appliances_compact',
  'Space Heaters': 'appliances_compact',
  'Fans': 'appliances_compact',
  
  // Automotive - 12% flat
  'Car Parts': 'automotive_powersports',
  'Auto Parts': 'automotive_powersports',
  'Motor Oil': 'automotive_powersports',
  'Car Batteries': 'automotive_powersports',
  'Windshield Wipers': 'automotive_powersports',
  'Air Filters': 'automotive_powersports',
  'Brake Pads': 'automotive_powersports',
  'Car Covers': 'automotive_powersports',
  'Automotive Specialty Parts': 'automotive_powersports',
  'Exterior Automotive Accessories': 'automotive_powersports',
  'Floor Mats': 'automotive_powersports',
  'Seat Covers': 'automotive_powersports',
  'Car Care': 'automotive_powersports',
  'Automotive Hood Shields & Bug Deflectors': 'automotive_powersports',
  'Automotive Shock Absorbers': 'automotive_powersports',
  'Automotive Electrical Parts & Accessories': 'automotive_powersports',
  'Automotive Hitch & Towing Parts & Sets': 'automotive_powersports',
  'Automotive Fenders & Fender Flares': 'automotive_powersports',
  'Automotive Light Bars': 'automotive_powersports',
  'Automotive Exterior Trim': 'automotive_powersports',
  'Automotive Clearance & Marker Lights': 'automotive_powersports',
  'Automotive Light Covers & Guards': 'automotive_powersports',
  'Automotive Floor Mats': 'automotive_powersports',
  'Automotive Seat Covers': 'automotive_powersports',
  'Automotive Decorative Interior Hardware & Accessories': 'automotive_powersports',
  'Automotive Hitch Ball Mounts': 'automotive_powersports',
  'Automotive Hitch Balls': 'automotive_powersports',
  'Automotive Winch Replacement Parts & Hardware': 'automotive_powersports',
  'Automotive Wiper Blades': 'automotive_powersports',
  'Automotive Grilles': 'automotive_powersports',
  'Automotive Radiator Repair Parts & Hardware': 'automotive_powersports',
  'Automotive Bumpers': 'automotive_powersports',
  'Automotive Steering Wheels': 'automotive_powersports',
  'Brake System Replacement Parts & Hardware': 'automotive_powersports',
  'Spark Plug Wires': 'automotive_powersports',
  'Suspension Leveling Kits': 'automotive_powersports',
  'Suspension Lift Kits': 'automotive_powersports',
  'Suspension Bushings': 'automotive_powersports',
  'Vehicle Mufflers': 'automotive_powersports',
  'Exhaust Gaskets': 'automotive_powersports',
  'Tail Lights': 'automotive_powersports',
  'Headlights': 'automotive_powersports',
  'Automotive Fog Lights': 'automotive_powersports',
  'Automotive Exterior Decorative Lights': 'automotive_powersports',
  'Automotive Light Bulbs': 'automotive_powersports',
  'Side View Mirrors': 'automotive_powersports',
  'Towing Mirrors': 'automotive_powersports',
  'Rearview Mirrors': 'automotive_powersports',
  'Engine Air Filters': 'automotive_powersports',
  'Fuel Injection Accessories & Parts': 'automotive_powersports',
  'Ignition Coils': 'automotive_powersports',
  'Intake Manifolds': 'automotive_powersports',
  'Vehicle Rotors': 'automotive_powersports',
  'Car Electronics Installation Kits': 'automotive_powersports',
  'Car Speakers': 'automotive_powersports',
  'Vehicle Speakers': 'automotive_powersports',
  'Car Dash Cameras': 'automotive_powersports',
  'Vehicle Charging Stations': 'automotive_powersports',
  'Vehicle Cup Holders': 'automotive_powersports',
  'Vehicle Audio Amplifier': 'automotive_powersports',
  'Automotive Backup Camera Systems': 'automotive_powersports',
  'Automotive Interior Thermometers': 'automotive_powersports',
  'Automotive Keys & Remotes': 'automotive_powersports',
  'Automotive Organizers': 'automotive_powersports',
  'Automotive Seat Cushions': 'automotive_powersports',
  'Automotive Seats': 'automotive_powersports',
  'Vehicle Batteries': 'automotive_powersports',
  'Automotive Batteries': 'automotive_powersports',
  'Marine Batteries': 'automotive_powersports',
  'Motorcycle Batteries': 'automotive_powersports',
  'RV Accessories': 'automotive_powersports',
  'Boat Accessories': 'automotive_powersports',
  'Automotive Steps': 'automotive_powersports',
  'Automotive Gaskets': 'automotive_powersports',
  'Lifting Jacks': 'automotive_powersports',
  'Power Inverters': 'automotive_powersports',
  
  // Tires & Wheels - 10% flat
  'Tires': 'tires_wheels',
  'Car Tires': 'tires_wheels',
  'Truck Tires': 'tires_wheels',
  'Wheels': 'tires_wheels',
  'Wheel Covers': 'tires_wheels',
  'Hubcaps': 'tires_wheels',
  'Automotive Rims': 'tires_wheels',
  'Automotive Wheel Covers & Hub Caps': 'tires_wheels',
  
  // Industrial & Scientific - 12% flat
  'Industrial Supplies': 'industrial_scientific',
  'Safety Equipment': 'industrial_scientific',
  'Lab Supplies': 'industrial_scientific',
  'Janitorial Supplies': 'industrial_scientific',
  'Material Handling': 'industrial_scientific',
  '3D Printer Filaments': 'industrial_scientific',
  '3D Printer Parts': 'industrial_scientific',
  '3D Printers': 'industrial_scientific',
  '3D Printer Pens': 'industrial_scientific',
  'Aerial Drone Accessories': 'industrial_scientific',
  'Aerial Drone Propeller Guards': 'industrial_scientific',
  'Aerial Drone Replacement Parts': 'industrial_scientific',
  'Drone Propellers': 'industrial_scientific',
  'Commercial Vacuums': 'industrial_scientific',
  'Compressed Air Dusters': 'industrial_scientific',
  'Janitor-Housekeeping Carts': 'industrial_scientific',
  'Protective Eyewear': 'industrial_scientific',
  'Protective Hardhats & Helmets': 'industrial_scientific',
  'Safety Vests': 'industrial_scientific',
  'Workwear Safety Gloves': 'industrial_scientific',
  'Workwear Overalls & Coveralls': 'industrial_scientific',
  'Disposable Gloves': 'industrial_scientific',
  'First Aid Kits': 'industrial_scientific',
  'First Aid Gauze & Pads': 'industrial_scientific',
  'Adhesive Bandages': 'industrial_scientific',
  'Earplugs': 'industrial_scientific',
  
  // Baby Products - 8% up to $10, 15% above
  'Baby Gear': 'baby_products',
  'Car Seats': 'baby_products',
  'Strollers': 'baby_products',
  'Baby Monitors': 'baby_products',
  'High Chairs': 'baby_products',
  'Baby Cribs': 'baby_products',
  'Baby Clothing': 'baby_products',
  'Diapers': 'baby_products',
  'Baby Formula': 'baby_products',
  'Baby Toys': 'baby_products',
  
  // Office Products - 15% (12% for printer cartridges)
  'Ink Cartridges': 'office_products',
  'Toner Cartridges': 'office_products',
  'Printer Cartridges': 'office_products',
  'Printers': 'office_products',
  'Printers & All-in-Ones': 'office_products',
  'Label Printers': 'office_products',
  'Receipt Printers': 'office_products',
  'Printer Ribbons': 'office_products',
  'Printer Drums': 'office_products',
  'Printer Trays & Feeders': 'office_products',
  'Printer Labels': 'office_products',
  'Printer Maintenance Kits': 'office_products',
  'Office Chairs': 'office_products',
  'Desk Chairs': 'office_products',
  'Reception Chairs & Seating': 'office_products',
  'Folding & Stacking Chairs': 'office_products',
  'Desks': 'office_products',
  'Office Supplies': 'office_products',
  'Paper': 'office_products',
  'School & Office Paper': 'office_products',
  'Photo Paper': 'office_products',
  'Card Stock': 'office_products',
  'Kraft Paper': 'office_products',
  'Binders': 'office_products',
  'Folders': 'office_products',
  'File Folders': 'office_products',
  'Pocket Folders': 'office_products',
  'Pens': 'office_products',
  'Mechanical Pencils': 'office_products',
  'Mechanical Pencil Refills': 'office_products',
  'Pencils': 'office_products',
  'Pencil & Pen Erasers': 'office_products',
  'Highlighters': 'office_products',
  'Markers': 'office_products',
  'Dry Erase Markers': 'office_products',
  'Ink Pen Refills': 'office_products',
  'Stylus Pens': 'office_products',
  'Notebooks': 'office_products',
  'Writing Notebooks & Sketch Books': 'office_products',
  'Composition Notebooks': 'office_products',
  'Writing Pads': 'office_products',
  'Staplers': 'office_products',
  'Desk Staplers': 'office_products',
  'Desk Stapler Staples': 'office_products',
  'Calculators': 'office_products',
  'Label Makers': 'office_products',
  'Label Maker Tape': 'office_products',
  'Labels': 'office_products',
  'Index Dividers': 'office_products',
  'Index Tabs': 'office_products',
  'Index Cards': 'office_products',
  'Shredders': 'office_products',
  'Envelopes': 'office_products',
  'Mailers': 'office_products',
  'Planners & Appointment Books': 'office_products',
  'Planners & Appointment Book Refills': 'office_products',
  'Wall Calendars': 'office_products',
  'Desk Calendars': 'office_products',
  'Screen Privacy Filters': 'office_products',
  'Report Covers': 'office_products',
  'Desktop Organizers': 'office_products',
  'Record Books & Ledgers': 'office_products',
  'Scissors': 'office_products',
  'Receipt Paper Rolls': 'office_products',
  'Laminating Pouches': 'office_products',
  'Laminators': 'office_products',
  'Badge & ID Holders': 'office_products',
  'Desk Pads': 'office_products',
  'Paper Hole Punches': 'office_products',
  'Sheet Protectors': 'office_products',
  'Wrist Rests': 'office_products',
  'Letter Trays': 'office_products',
  'Desk Risers': 'office_products',
  'Binder Clips': 'office_products',
  'Paper Trimmers': 'office_products',
  'Paper Clips': 'office_products',
  'Business Card Holders': 'office_products',
  'Desktop Copyholders': 'office_products',
  'File Guides': 'office_products',
  'Rulers': 'office_products',
  'Correction Tape': 'office_products',
  'Award Certificates': 'office_products',
  'File & Paper Fasteners': 'office_products',
  'Tape Flags': 'office_products',
  'Stamp Ink Pads': 'office_products',
  'Stamps & Stamp Sets': 'office_products',
  'Adhesive Tape Dispensers': 'office_products',
  'Paper Sorters': 'office_products',
  'Ticket Holders': 'office_products',
  'Electric Pencil Sharpeners': 'office_products',
  'Money Deposit Bags': 'office_products',
  'Certificate Holders': 'office_products',
  'Filler Paper': 'office_products',
  'Hanging File Folder Frames': 'office_products',
  'Attendance Time Cards': 'office_products',
  'Attendance Time Clocks': 'office_products',
  'Blank Identification Badges': 'office_products',
  'Coin Roll Wrappers': 'office_products',
  'Computer Keyboard Trays': 'office_products',
  'Keyboard Drawers & Platforms': 'office_products',
  'Office Chair Mats': 'office_products',
  'Pencil Holders': 'office_products',
  'File Cabinets, Boxes & Carts': 'office_products',
  'Literature Display Racks & Organizers': 'office_products',
  'Sign Holders': 'office_products',
  'Poster Boards': 'office_products',
  'Magazine Racks & Holders': 'office_products',
  'Binder Pockets': 'office_products',
  'Standard Forms & Applications': 'office_products',
  'Cash Register Drawers & Trays': 'office_products',
  'Whiteboards': 'office_products',
  'Bulletin Boards': 'office_products',
  'Bulletin Board Decorations': 'office_products',
  'Chalkboard Erasers': 'office_products',
  'Easel Pads': 'office_products',
  'Packing Tapes': 'office_products',
  'Packing & Shipping Boxes': 'office_products',
  'Transparent Tapes': 'office_products',
  'Adhesive Tapes': 'office_products',
  'Mounting Tapes': 'office_products',
  'Masking Tapes': 'office_products',
  'Duct Tapes': 'office_products',
  'Hook & Loop Fasteners': 'office_products',
  'Rubber Bands': 'office_products',
  'Lanyards': 'office_products',
  'Binding Combs, Spines & Bars': 'office_products',
  'File Organizers': 'office_products',
  'Stickers': 'office_products',
  'Form Holders & Clipboards': 'office_products',
  'Cable Organizers': 'office_products',
  'Laptop Security Locks': 'office_products',
  'Disc & Tape Storage': 'office_products',
  'Computer & Machine Carts': 'office_products',
  'Utility Carts': 'office_products',
  'Poly Bags': 'office_products',
  'Recycling Bins': 'office_products',
  'Office Boxes': 'office_products',
  'Keyboard Protectors': 'office_products',
  'Computer Keyboard & Mouse Sets': 'office_products',
  'Computer Software': 'office_products',
  
  // Tools & Home Improvement - 15% flat
  'Hand Tool Crimpers & Strippers': 'tools_home_improvement',
  'Hand Tool Punches': 'tools_home_improvement',
  'Screwdrivers': 'tools_home_improvement',
  'Pliers': 'tools_home_improvement',
  'Tool Boxes & Organizers': 'tools_home_improvement',
  'Tool Bags': 'tools_home_improvement',
  'Tool Sets': 'tools_home_improvement',
  'Socket Wrenches & Sets': 'tools_home_improvement',
  'Measurement Lasers': 'tools_home_improvement',
  'Power Tool Blades': 'tools_home_improvement',
  'Replacement Cutting Blades': 'tools_home_improvement',
  'Power Saws': 'tools_home_improvement',
  'Power Tool Polishers': 'tools_home_improvement',
  'Power Screwdrivers': 'tools_home_improvement',
  'Power Tool Sets': 'tools_home_improvement',
  'Other Power & Hand Tool Accessories': 'tools_home_improvement',
  'Clamps': 'tools_home_improvement',
  'Hardware Locks': 'tools_home_improvement',
  'Padlocks': 'tools_home_improvement',
  'Hardware Hinges': 'tools_home_improvement',
  'Hardware Nuts': 'tools_home_improvement',
  'Hardware Hooks': 'tools_home_improvement',
  'Hardware Latches & Catches': 'tools_home_improvement',
  'Hardware Spacers & Standoffs': 'tools_home_improvement',
  'Hardware Anchors': 'tools_home_improvement',
  'Hardware Grommets': 'tools_home_improvement',
  'Pipe Fittings & Couplers': 'tools_home_improvement',
  'Electrical Wire': 'tools_home_improvement',
  'Electrical Switches': 'tools_home_improvement',
  'Electrical Plugs': 'tools_home_improvement',
  'Electrical Conduit Fittings': 'tools_home_improvement',
  'Electrical System Relays': 'tools_home_improvement',
  'Glue Guns': 'tools_home_improvement',
  'Ladder Accessories': 'tools_home_improvement',
  'Workbenches': 'tools_home_improvement',
  'Safety Barriers': 'tools_home_improvement',
  'Safety Cones & Triangles': 'tools_home_improvement',
  'Warning Alarms & Sirens': 'tools_home_improvement',
  
  // Power Tools - 12% flat
  'Drills': 'base_power_tools',
  'Power Drills': 'base_power_tools',
  'Impact Drivers': 'base_power_tools',
  'Circular Saws': 'base_power_tools',
  'Jigsaws': 'base_power_tools',
  'Sanders': 'base_power_tools',
  'Grinders': 'base_power_tools',
  'Routers': 'base_power_tools',
  'Nail Guns': 'base_power_tools',
  'Power Tool Batteries': 'base_power_tools',
  
  // Outdoor Power Tools - 15% up to $500, 8% above
  'Lawn Mowers': 'outdoor_power_tools',
  'Riding Mowers': 'outdoor_power_tools',
  'String Trimmers': 'outdoor_power_tools',
  'Leaf Blowers': 'outdoor_power_tools',
  'Chainsaws': 'outdoor_power_tools',
  'Pressure Washers': 'outdoor_power_tools',
  'Snow Blowers': 'outdoor_power_tools',
  'Generators': 'outdoor_power_tools',
  'Wood Chippers': 'outdoor_power_tools',
  
  // Furniture - 15% up to $200, 10% above
  'Sofas': 'indoor_outdoor_furniture',
  'Couches': 'indoor_outdoor_furniture',
  'Recliners': 'indoor_outdoor_furniture',
  'Beds': 'indoor_outdoor_furniture',
  'Mattresses': 'indoor_outdoor_furniture',
  'Dressers': 'indoor_outdoor_furniture',
  'Nightstands': 'indoor_outdoor_furniture',
  'Dining Tables': 'indoor_outdoor_furniture',
  'Dining Chairs': 'indoor_outdoor_furniture',
  'Bookcases': 'indoor_outdoor_furniture',
  'TV Stands': 'indoor_outdoor_furniture',
  'Patio Furniture': 'indoor_outdoor_furniture',
  'Outdoor Chairs': 'indoor_outdoor_furniture',
  'Outdoor Tables': 'indoor_outdoor_furniture',
  
  // Video Game Consoles - 8% flat
  'Gaming Consoles': 'video_game_consoles',
  'PlayStation': 'video_game_consoles',
  'Xbox': 'video_game_consoles',
  'Nintendo Switch': 'video_game_consoles',
  
  // Toys & Games - 15% flat
  'Board Games': 'toys_games',
  'Card Games': 'toys_games',
  'Dice': 'toys_games',
  'Trading Card Sleeves & Holders': 'toys_games',
  'Trading Card Games': 'toys_games',
  'Action Figures': 'toys_games',
  'Figurines & Knick-Knacks': 'toys_games',
  'Video Games': 'software_games',
  'Video Game Accessories': 'software_games',
  'Video Game Controllers': 'software_games',
  'Video Game Chairs': 'software_games',
  'Game Replacement Parts': 'toys_games',
  'Jigsaw Puzzles': 'toys_games',
  'Pool Toys & Floats': 'toys_games',
  'Interlocking Block Building Sets': 'toys_games',
  'Mathematics & Counting Toys': 'toys_games',
  'Flash Cards': 'toys_games',
  'Art Paints & Pigment Powders': 'toys_games',
  'Art Pencils': 'toys_games',
  'Art & Craft Kits': 'toys_games',
  'Art Pads & Paper': 'toys_games',
  'Art Brushes': 'toys_games',
  'Clays & Doughs': 'toys_games',
  'Crayons': 'toys_games',
  'Craft Vinyl': 'toys_games',
  'Craft Paper': 'toys_games',
  'Die-Cut Cartridges': 'toys_games',
  'Replacement Cutting Blades': 'toys_games',
  'Craft & Hobby Storage Bags & Cases': 'toys_games',
  'Transfer Paper': 'toys_games',
  'Construction Paper': 'toys_games',
  
  // Home, Kitchen, Decor & Garden - 15% flat
  'Garbage Bags': 'home_kitchen_decor_garden',
  'Garbage Cans & Wastebaskets': 'home_kitchen_decor_garden',
  'Air Fresheners': 'home_kitchen_decor_garden',
  'Cleaning Cloths & Wipes': 'home_kitchen_decor_garden',
  'Hand Soaps': 'home_kitchen_decor_garden',
  'Paper Towels': 'home_kitchen_decor_garden',
  'Mop Heads': 'home_kitchen_decor_garden',
  'Household Cleaners': 'home_kitchen_decor_garden',
  'All Purpose Cleaners': 'home_kitchen_decor_garden',
  'Cleaning Sponges & Scrubbing Pads': 'home_kitchen_decor_garden',
  'Cleaning Brushes': 'home_kitchen_decor_garden',
  'Brooms': 'home_kitchen_decor_garden',
  'Broom & Mop Handles': 'home_kitchen_decor_garden',
  'Squeegees': 'home_kitchen_decor_garden',
  'Dusters': 'home_kitchen_decor_garden',
  'Floor Polishing Machine Replacement Pads': 'home_kitchen_decor_garden',
  'Urinal Deodorizers': 'home_kitchen_decor_garden',
  'Food Storage Jars & Containers': 'home_kitchen_decor_garden',
  'Picture Frames': 'home_kitchen_decor_garden',
  'Shelves & Shelf Units': 'home_kitchen_decor_garden',
  'Storage Chests & Boxes': 'home_kitchen_decor_garden',
  'Baskets': 'home_kitchen_decor_garden',
  'Decorative Clocks': 'home_kitchen_decor_garden',
  'Alarm Clocks': 'home_kitchen_decor_garden',
  'Flashlights': 'home_kitchen_decor_garden',
  'Extension Cords': 'home_kitchen_decor_garden',
  'Light Bulbs': 'home_kitchen_decor_garden',
  'Switch & Outlet Plates': 'home_kitchen_decor_garden',
  'Electrical Outlets': 'home_kitchen_decor_garden',
  'Electrical Boxes': 'home_kitchen_decor_garden',
  'Hardware Brackets': 'home_kitchen_decor_garden',
  'Hardware Hooks': 'home_kitchen_decor_garden',
  'Hardware Screws': 'home_kitchen_decor_garden',
  'Casters': 'home_kitchen_decor_garden',
  'Safes': 'home_kitchen_decor_garden',
  'Vacuum Cleaner Bags': 'home_kitchen_decor_garden',
  'Floor Mats & Doormats': 'home_kitchen_decor_garden',
  'Cups & Mugs': 'home_kitchen_decor_garden',
  'Glue': 'home_kitchen_decor_garden',
  'Soap & Lotion Dispensers': 'home_kitchen_decor_garden',
  'Hand Sanitizers': 'home_kitchen_decor_garden',
  'Toilet Paper': 'home_kitchen_decor_garden',
  'Facial Tissue': 'home_kitchen_decor_garden',
  'Paper Cups': 'home_kitchen_decor_garden',
  'Plastic Cups': 'home_kitchen_decor_garden',
  'Disposable Spoons': 'home_kitchen_decor_garden',
  'Cup Lids': 'home_kitchen_decor_garden',
  'Napkins': 'home_kitchen_decor_garden',
  'Paper Plates': 'home_kitchen_decor_garden',
  'Take-Out Containers': 'home_kitchen_decor_garden',
  'Food Wraps': 'home_kitchen_decor_garden',
  'Disposable Storage Bags': 'home_kitchen_decor_garden',
  'Paper Holders & Dispensers': 'home_kitchen_decor_garden',
  'Tableware Sets': 'home_kitchen_decor_garden',
  'Serving Trays': 'home_kitchen_decor_garden',
  'Anti-Fatigue Mats': 'home_kitchen_decor_garden',
  'Grill Covers': 'home_kitchen_decor_garden',
  'Patio Furniture Covers': 'home_kitchen_decor_garden',
  'Fire Pits': 'home_kitchen_decor_garden',
  'Kitchen Scales': 'home_kitchen_decor_garden',
  'Body Weight Scales': 'home_kitchen_decor_garden',
  'Desk Lamps': 'home_kitchen_decor_garden',
  'Posters': 'home_kitchen_decor_garden',
  'Plaques & Signs': 'home_kitchen_decor_garden',
  'Outdoor Flags & Banners': 'home_kitchen_decor_garden',
  'Dish Soaps': 'home_kitchen_decor_garden',
  'Laundry Detergents': 'home_kitchen_decor_garden',
  'Hand Wipes': 'home_kitchen_decor_garden',
  'Cable Ties': 'home_kitchen_decor_garden',
  'Cable Covers': 'home_kitchen_decor_garden',
  
  // Personal Computers - 6% flat (additions)
  'Tablet Computers': 'personal_computers',
  'Computer Servers': 'personal_computers',
  
  // Books - 15% flat
  'Books': 'books',
  
  // Luggage & Travel - 15% flat
  'Luggage & Luggage Sets': 'luggage_travel',
  'Backpacks': 'shoes_handbags_accessories',
  'Travel Plug Adapters': 'luggage_travel',
  
  // Grocery - 8% up to $15, 15% above
  'Ground Coffee': 'grocery',
  'Coffee Pods': 'grocery',
  'Tea Bags': 'grocery',
  'Snack Bars': 'grocery',
  'Snack Crackers': 'grocery',
  'Snack Chips': 'grocery',
  'Cookies': 'grocery',
  'Non-Dairy Creamers': 'grocery',
  
  // Watches - 15% up to $1500, 3% above
  'Wristwatches': 'watches',
  
  // Outdoors & Sports - 15% (8% for binoculars, etc.)
  'Baseball Gloves & Mitts': 'outdoors_sports',
  'Baseball Bats': 'outdoors_sports',
  'Pocket Knives': 'outdoors_sports',
  'Tactical Knives': 'outdoors_sports',
  'Multitools': 'outdoors_sports',
  'Utility Knives': 'outdoors_sports',
  'Gun Cases': 'outdoors_sports',
  'Tool Boxes & Organizers': 'outdoors_sports',
  
  // Camera & Photo - 8% (additions)
  'Camera Bags & Cases': 'camera_photo',
  'Camera Film': 'camera_photo',
  'Camera Accessory Bundles': 'camera_photo',
  'Camera Stabilizers': 'camera_photo',
  'Lens Filters': 'camera_photo',
  'Lens Caps': 'camera_photo',
  'Projector Bags & Cases': 'camera_photo',
  'Projector Lenses': 'camera_photo',
  'Photo Printers': 'camera_photo',
  'Photo Albums': 'camera_photo',
  'Digital Photo Frames': 'camera_photo',
  'Photo Paper': 'camera_photo',
  'Photo Enlarger Lens Mounts': 'camera_photo',
  'Instant Cameras': 'camera_photo',
  'Skins for Cameras': 'camera_photo',
  'Rangefinders': 'camera_photo',
  
  // Compact Appliances (additions)
  'Microwave Ovens': 'appliances_compact',
  'Drip Coffee Makers': 'appliances_compact',
  'Electric Household Fans': 'appliances_compact',
  'Electric Blankets': 'appliances_compact',
  'Hair Dryers': 'appliances_compact',
  'Sewing Machines': 'appliances_compact',
  'Electric Kettles': 'appliances_compact',
  'Hand Mixers': 'appliances_compact',
  'Meat Grinders': 'appliances_compact',
  'Electric Rice Cookers': 'appliances_compact',
  'Single-Serve Brewers': 'appliances_compact',
  'Toaster Ovens': 'appliances_compact',
  'Electric Waffle Makers': 'appliances_compact',
  'Electric Skillets': 'appliances_compact',
  'Electric Griddles': 'appliances_compact',
  'Electric Food Slicers': 'appliances_compact',
  'Electric Juicers': 'appliances_compact',
  'Electric Knives': 'appliances_compact',
  'Electric Knife Sharpeners': 'appliances_compact',
  'Electric Can Openers': 'appliances_compact',
  'Electric Deep Fryers': 'appliances_compact',
  'Electric Popcorn Poppers': 'appliances_compact',
  'Electric Rotisseries & Roasters': 'appliances_compact',
  'Electric Food Choppers': 'appliances_compact',
  'Food Dehydrators': 'appliances_compact',
  'Vacuum Sealers': 'appliances_compact',
  'Clothes Irons': 'appliances_compact',
  'Garment Steamers': 'appliances_compact',
  'Steam Mops': 'appliances_compact',
  'Carpet Cleaners': 'appliances_compact',
  'Floor Cleaning Machines': 'appliances_compact',
  'Floor Polishing Machines': 'appliances_compact',
  'Wet/Dry Vacuum Cleaners': 'appliances_compact',
  'Air Conditioners': 'appliances_compact',
  'Ice Makers': 'appliances_compact',
  'Countertop Burners': 'appliances_compact',
  'Pressure Cookers & Canners': 'appliances_compact',
  'Appliance Air Filters': 'appliances_compact',
  'Air Purifier Filters': 'appliances_compact',
  'Humidifier Filters': 'appliances_compact',
  'Vacuum Cleaner Filters': 'appliances_compact',
  'Appliance Replacement Parts': 'appliances_compact',
  
  // Home, Kitchen & Garden (additions)
  'Outdoor Gas Grills': 'home_kitchen_decor_garden',
  'Charcoal Grills': 'home_kitchen_decor_garden',
  'Grill Tool Sets': 'home_kitchen_decor_garden',
  'Grill Covers': 'home_kitchen_decor_garden',
  'Grill Gloves': 'home_kitchen_decor_garden',
  'Grill Handle Lights': 'home_kitchen_decor_garden',
  'Grill Bags': 'home_kitchen_decor_garden',
  'Smoker Chips': 'home_kitchen_decor_garden',
  'Outdoor Griddles': 'home_kitchen_decor_garden',
  'Outdoor Electric Grills': 'home_kitchen_decor_garden',
  'Griddles & Grill Pans': 'home_kitchen_decor_garden',
  'Fire Pits': 'home_kitchen_decor_garden',
  'Fireplace Tools': 'home_kitchen_decor_garden',
  'Fireplace Screens': 'home_kitchen_decor_garden',
  'Heating Stoves': 'home_kitchen_decor_garden',
  'Patio Heaters': 'home_kitchen_decor_garden',
  'Patio Furniture Covers': 'home_kitchen_decor_garden',
  'Weather Thermometers': 'home_kitchen_decor_garden',
  'Weather Stations': 'home_kitchen_decor_garden',
  'Sprinkler & Watering Controllers & Timers': 'home_kitchen_decor_garden',
  'Sprinkler Heads': 'home_kitchen_decor_garden',
  'Lawn Sprinklers': 'home_kitchen_decor_garden',
  'Watering Nozzles': 'home_kitchen_decor_garden',
  'Garden Hoses': 'home_kitchen_decor_garden',
  'Hose Connectors': 'home_kitchen_decor_garden',
  'Irrigation Timers': 'home_kitchen_decor_garden',
  'Soap & Lotion Dispensers': 'home_kitchen_decor_garden',
  'Shelves & Shelf Units': 'home_kitchen_decor_garden',
  'Floating Shelves': 'home_kitchen_decor_garden',
  'Storage Chests & Boxes': 'home_kitchen_decor_garden',
  'Closet Organizers': 'home_kitchen_decor_garden',
  'Clothes Hangers': 'home_kitchen_decor_garden',
  'Shoe Racks': 'home_kitchen_decor_garden',
  'Spice Racks & Organizers': 'home_kitchen_decor_garden',
  'Desk Lamps': 'home_kitchen_decor_garden',
  'Under-Cabinet Lights': 'home_kitchen_decor_garden',
  'Pendant Lights': 'home_kitchen_decor_garden',
  'Flush Mount Lights': 'home_kitchen_decor_garden',
  'Flood & Security Lights': 'home_kitchen_decor_garden',
  'Spotlight Lights': 'home_kitchen_decor_garden',
  'Television Stands': 'home_kitchen_decor_garden',
  'Desk Risers': 'home_kitchen_decor_garden',
  'Desk Pads': 'home_kitchen_decor_garden',
  'Lap Desks': 'home_kitchen_decor_garden',
  'Ergonomic Footrests': 'home_kitchen_decor_garden',
  'Ergonomic Backrests': 'home_kitchen_decor_garden',
  'Anti-Fatigue Mats': 'home_kitchen_decor_garden',
  'Kitchen Scales': 'home_kitchen_decor_garden',
  'Food Thermometers': 'home_kitchen_decor_garden',
  'Showerheads & Handheld Showers': 'home_kitchen_decor_garden',
  'Shower Valve Trim': 'home_kitchen_decor_garden',
  'Faucets': 'home_kitchen_decor_garden',
  'Household Sensors & Alarms': 'home_kitchen_decor_garden',
  'Household Water Sensors': 'home_kitchen_decor_garden',
  'Motion Detectors': 'home_kitchen_decor_garden',
  'Security Alarms': 'home_kitchen_decor_garden',
  'Cookware Sets': 'home_kitchen_decor_garden',
  'Soup & Stockpots': 'home_kitchen_decor_garden',
  'Skillets & Frying Pans': 'home_kitchen_decor_garden',
  'Serving Platters': 'home_kitchen_decor_garden',
  'Tableware Sets': 'home_kitchen_decor_garden',
  'Travel Mugs': 'home_kitchen_decor_garden',
  'Water Bottles': 'home_kitchen_decor_garden',
  'Beverage Dispensers': 'home_kitchen_decor_garden',
  'Condiment Servers': 'home_kitchen_decor_garden',
  'Airpots': 'home_kitchen_decor_garden',
  'Coffee & Tea Urns': 'home_kitchen_decor_garden',
  'Ice Packs': 'home_kitchen_decor_garden',
  'Hard-Sided Coolers': 'home_kitchen_decor_garden',
  'Cooler Backpacks': 'home_kitchen_decor_garden',
  'Rolling Coolers': 'home_kitchen_decor_garden',
  'Thermocoolers': 'home_kitchen_decor_garden',
  'Bungee Cords': 'home_kitchen_decor_garden',
  'Cord Reels': 'home_kitchen_decor_garden',
  'Cutting Mats': 'home_kitchen_decor_garden',
  'Dry Boxes': 'home_kitchen_decor_garden',
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
  'Computers, Laptops and Tablets': 'personal_computers',
  'Laptops': 'personal_computers',
  'Tablets': 'personal_computers',
  'Computer Accessories': 'electronics_accessories',
  'Surge Protectors & UPS': 'electronics_accessories',
  'Cables & Connectors': 'electronics_accessories',
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
  'Board Games': 'toys_games',
  'Card Games': 'toys_games',
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
 * Determine contract category from product type or taxonomy path
 * @param productType - Product type from Walmart (most specific)
 * @param categoryPath - Array of category names from Walmart taxonomy
 * @returns Contract category key or 'everything_else' if no match
 */
export function getContractCategory(categoryPath: string[] | null, productType?: string | null): string {
  // First priority: Check product type mapping (most specific)
  if (productType) {
    const normalizedProductType = productType.trim();
    
    // Direct match first
    if (PRODUCT_TYPE_TO_CONTRACT_MAPPING[normalizedProductType]) {
      return PRODUCT_TYPE_TO_CONTRACT_MAPPING[normalizedProductType];
    }
    
    // Case-insensitive match as fallback
    const lowerProductType = normalizedProductType.toLowerCase();
    for (const [key, value] of Object.entries(PRODUCT_TYPE_TO_CONTRACT_MAPPING)) {
      if (key.toLowerCase() === lowerProductType) {
        return value;
      }
    }
  }
  
  // Second priority: Check category path from most specific to most general
  if (categoryPath && categoryPath.length > 0) {
    for (let i = categoryPath.length - 1; i >= 0; i--) {
      const category = categoryPath[i]?.trim();
      if (!category) continue;
      
      // Direct match first
      if (TAXONOMY_TO_CONTRACT_MAPPING[category]) {
        return TAXONOMY_TO_CONTRACT_MAPPING[category];
      }
      
      // Case-insensitive match as fallback
      const lowerCategory = category.toLowerCase();
      for (const [key, value] of Object.entries(TAXONOMY_TO_CONTRACT_MAPPING)) {
        if (key.toLowerCase() === lowerCategory) {
          return value;
        }
      }
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
 * @param productType - Product type from Walmart (optional, takes priority)
 * @returns Complete fee calculation result
 */
export function calculateReferralFee(
  priceInCents: number,
  categoryPath: string[] | null,
  productType?: string | null
): ReferralFeeResult {
  const contractCategoryKey = getContractCategory(categoryPath, productType);
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
