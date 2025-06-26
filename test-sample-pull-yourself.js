/**
 * Interactive Sample Pull Test - Run this yourself!
 * 
 * This creates a small sample dataset and lets you test the mapping workflow
 * that users would experience when onboarding a new supplier.
 */

import { parse } from 'csv-parse/sync';
import fs from 'fs';

async function createTestSample() {
  console.log('🎯 Creating test sample from CWR data...\n');
  
  // Check if we have the CWR catalog
  const csvPath = './temp/authentic-catalog.csv';
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ CWR catalog not found. Please ensure temp/authentic-catalog.csv exists');
    return false;
  }
  
  // Create a 10-product sample for quick testing
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n');
  const header = lines[0];
  const sampleLines = lines.slice(1, 11); // First 10 products
  
  const testSample = [header, ...sampleLines].join('\n');
  const testPath = './temp/your-test-sample.csv';
  fs.writeFileSync(testPath, testSample);
  
  console.log(`✓ Created test sample: ${testPath}`);
  console.log(`✓ Contains ${sampleLines.length} products for testing\n`);
  
  return testPath;
}

async function analyzeTestSample(samplePath) {
  console.log('📊 Analyzing your test sample...\n');
  
  const csvContent = fs.readFileSync(samplePath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
  
  console.log(`Sample contains ${records.length} products\n`);
  
  // Show first product as example
  console.log('📋 Sample Product Data:');
  console.log('========================');
  
  const sampleProduct = records[0];
  Object.entries(sampleProduct).slice(0, 10).forEach(([field, value]) => {
    const displayValue = value.length > 50 ? value.substring(0, 47) + '...' : value;
    console.log(`${field}: ${displayValue}`);
  });
  
  console.log('\n🎯 Field Mapping Analysis:');
  console.log('===========================');
  
  // Analyze key fields for mapping
  const keyFields = [
    'Product Name', 
    'EDC Part Number', 
    'CWR Part Number', 
    'Description', 
    'Category', 
    'UPC', 
    'Cost', 
    'Image (300x300)', 
    'Image (1000x1000)'
  ];
  
  keyFields.forEach(field => {
    const values = records.map(r => r[field]).filter(v => v && v.trim());
    const fillRate = (values.length / records.length * 100).toFixed(1);
    const sample = values[0] || 'N/A';
    const displaySample = sample.length > 30 ? sample.substring(0, 27) + '...' : sample;
    
    console.log(`${field}:`);
    console.log(`  Fill Rate: ${fillRate}%`);
    console.log(`  Sample: ${displaySample}`);
    console.log('');
  });
  
  return records;
}

async function suggestMappings(records) {
  console.log('💡 Suggested Field Mappings:');
  console.log('=============================');
  
  const mappingSuggestions = {
    'Product Name': 'name',
    'EDC Part Number': 'sku', 
    'CWR Part Number': 'manufacturerPartNumber',
    'Description': 'description',
    'Category': 'categoryPath',
    'UPC': 'upc',
    'Cost': 'cost',
    'Price': 'price',
    'Image (300x300)': 'image300x300',
    'Image (1000x1000)': 'image1000x1000'
  };
  
  console.log('Source Field → Target Field');
  console.log('---------------------------');
  Object.entries(mappingSuggestions).forEach(([source, target]) => {
    console.log(`${source} → ${target}`);
  });
  
  console.log('\n🏗️ Category Analysis:');
  console.log('=====================');
  
  const categories = records
    .map(r => r['Category'])
    .filter(cat => cat && cat.trim());
  
  const uniqueCategories = [...new Set(categories)];
  console.log(`Found ${uniqueCategories.length} unique categories:`);
  
  uniqueCategories.slice(0, 5).forEach(cat => {
    const count = categories.filter(c => c === cat).length;
    console.log(`  ${cat} (${count} products)`);
  });
  
  if (uniqueCategories.length > 5) {
    console.log(`  ... and ${uniqueCategories.length - 5} more`);
  }
}

async function runYourTest() {
  console.log('🚀 Sample Pull Test - Try It Yourself!');
  console.log('=======================================\n');
  
  try {
    // Step 1: Create test sample
    const samplePath = await createTestSample();
    if (!samplePath) return false;
    
    // Step 2: Analyze the sample
    const records = await analyzeTestSample(samplePath);
    
    // Step 3: Show mapping suggestions
    await suggestMappings(records);
    
    console.log('\n✅ Sample Pull Test Complete!');
    console.log('\n📝 What This Shows:');
    console.log('- How supplier data looks when imported');
    console.log('- Field mapping suggestions for users');
    console.log('- Category structure analysis');
    console.log('- Data quality assessment');
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Review the field mappings above');
    console.log('2. Check category structure matches expectations');
    console.log('3. Verify data quality is acceptable');
    console.log('4. Test with your own CSV files if needed');
    
    console.log(`\n📁 Your test file: ${samplePath}`);
    console.log('Feel free to modify it and re-run this test!');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    return false;
  }
}

// Run your test
runYourTest()
  .then(success => {
    console.log(success ? '\n🌟 Test successful!' : '\n❌ Test failed');
  })
  .catch(error => {
    console.error('Error:', error);
  });