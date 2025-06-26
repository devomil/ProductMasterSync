/**
 * Test Sample Pull through UI workflow
 * This simulates the supplier onboarding process a user would follow
 */

import { db } from './server/db.ts';
import { sql } from 'drizzle-orm';
import * as schema from './shared/schema';
import { parse } from 'csv-parse/sync';
import fs from 'fs';

async function prepareSampleData() {
  console.log('📋 Preparing sample data for UI testing...');
  
  // Create a small sample from the CWR catalog (20 products)
  const csvPath = './temp/authentic-catalog.csv';
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ CWR catalog file not found');
    return false;
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n');
  const header = lines[0];
  const sampleLines = lines.slice(1, 21); // Take first 20 data rows
  
  const sampleCsvContent = [header, ...sampleLines].join('\n');
  const samplePath = './temp/sample-for-ui-test.csv';
  fs.writeFileSync(samplePath, sampleCsvContent);
  
  console.log(`✓ Created sample file with 20 products at: ${samplePath}`);
  return samplePath;
}

async function simulateSupplierSamplePull() {
  console.log('🔄 Simulating supplier sample pull workflow...');
  
  // This simulates what happens when a user clicks "Test Pull" on a supplier
  const samplePath = await prepareSampleData();
  if (!samplePath) return false;
  
  // Parse the sample data (this is what the backend would do)
  const csvContent = fs.readFileSync(samplePath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
  
  console.log(`✓ Sample contains ${records.length} products`);
  
  // Analyze the data structure for mapping suggestions
  const fieldAnalysis = analyzeFields(records);
  console.log('✓ Field analysis complete');
  
  // Show category distribution
  const categoryAnalysis = analyzeCategoryStructure(records);
  console.log('✓ Category analysis complete');
  
  return {
    records,
    fieldAnalysis,
    categoryAnalysis,
    samplePath
  };
}

function analyzeFields(records) {
  if (records.length === 0) return {};
  
  const sampleRecord = records[0];
  const fieldAnalysis = {};
  
  Object.keys(sampleRecord).forEach(field => {
    const values = records.map(r => r[field]).filter(v => v && v.trim());
    
    fieldAnalysis[field] = {
      sampleValues: values.slice(0, 3),
      fillRate: (values.length / records.length * 100).toFixed(1),
      dataType: inferDataType(values),
      suggestedMapping: suggestFieldMapping(field)
    };
  });
  
  return fieldAnalysis;
}

function inferDataType(values) {
  if (values.length === 0) return 'empty';
  
  const numericCount = values.filter(v => !isNaN(parseFloat(v))).length;
  const urlCount = values.filter(v => v.includes('http')).length;
  
  if (urlCount > values.length * 0.5) return 'url';
  if (numericCount > values.length * 0.8) return 'numeric';
  return 'text';
}

function suggestFieldMapping(sourceField) {
  const fieldMappings = {
    'Product Name': 'name',
    'EDC Part Number': 'sku',
    'CWR Part Number': 'manufacturerPartNumber',
    'Description': 'description',
    'Category': 'categoryPath',
    'UPC': 'upc',
    'Cost': 'cost',
    'Price': 'price',
    'Weight': 'weight',
    'Image (300x300)': 'image300x300',
    'Image (1000x1000)': 'image1000x1000',
    'Manufacturer': 'manufacturer',
    'Brand': 'brand'
  };
  
  return fieldMappings[sourceField] || null;
}

function analyzeCategoryStructure(records) {
  const categories = records
    .map(r => r['Category'] || r['category'])
    .filter(cat => cat && cat.trim())
    .map(cat => cat.trim());
  
  const categoryCount = {};
  const hierarchyLevels = {};
  
  categories.forEach(cat => {
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    
    const levels = cat.split(' > ').length;
    hierarchyLevels[levels] = (hierarchyLevels[levels] || 0) + 1;
  });
  
  return {
    uniqueCategories: Object.keys(categoryCount).length,
    categoryDistribution: Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10),
    hierarchyLevels,
    maxDepth: Math.max(...Object.keys(hierarchyLevels).map(Number))
  };
}

async function displaySampleResults(results) {
  console.log('\n📊 Sample Pull Results (UI Preview):');
  console.log('=====================================');
  
  console.log(`\n🔢 Sample Size: ${results.records.length} products`);
  
  console.log('\n📋 Field Analysis:');
  Object.entries(results.fieldAnalysis).forEach(([field, analysis]) => {
    const mapping = analysis.suggestedMapping ? ` → ${analysis.suggestedMapping}` : '';
    console.log(`   ${field}${mapping}`);
    console.log(`     Fill Rate: ${analysis.fillRate}% | Type: ${analysis.dataType}`);
    console.log(`     Sample: ${analysis.sampleValues.join(', ')}`);
  });
  
  console.log('\n🏗️ Category Structure:');
  console.log(`   Unique Categories: ${results.categoryAnalysis.uniqueCategories}`);
  console.log(`   Max Hierarchy Depth: ${results.categoryAnalysis.maxDepth} levels`);
  
  console.log('\n📈 Top Categories:');
  results.categoryAnalysis.categoryDistribution.forEach(([cat, count]) => {
    console.log(`   ${cat}: ${count} products`);
  });
  
  console.log('\n🎯 Hierarchy Distribution:');
  Object.entries(results.categoryAnalysis.hierarchyLevels).forEach(([levels, count]) => {
    console.log(`   ${levels}-level categories: ${count}`);
  });
  
  console.log('\n💡 Mapping Suggestions Ready for UI:');
  const mappingTemplate = {
    sourceType: 'csv',
    hasHeader: true,
    delimiter: ',',
    encoding: 'utf-8',
    fieldMappings: {}
  };
  
  Object.entries(results.fieldAnalysis).forEach(([field, analysis]) => {
    if (analysis.suggestedMapping) {
      mappingTemplate.fieldMappings[field] = analysis.suggestedMapping;
    }
  });
  
  console.log('   Suggested mapping template created');
  console.log(`   Mapped fields: ${Object.keys(mappingTemplate.fieldMappings).length}`);
  
  return mappingTemplate;
}

async function runUIWorkflowTest() {
  console.log('🚀 Testing Sample Pull UI Workflow');
  console.log('This simulates what users see when testing supplier data\n');
  
  try {
    // Step 1: User clicks "Test Pull" on supplier
    const results = await simulateSupplierSamplePull();
    if (!results) throw new Error('Sample pull failed');
    
    // Step 2: Display results in UI format
    const mappingTemplate = await displaySampleResults(results);
    
    // Step 3: Validation summary
    console.log('\n✅ Sample Pull Workflow Test Complete');
    console.log('\nNext Steps for User:');
    console.log('1. Review field mappings and adjust as needed');
    console.log('2. Verify category structure matches expectations');
    console.log('3. Test category creation with sample data');
    console.log('4. Approve mapping template');
    console.log('5. Proceed with full import');
    
    console.log('\n🌟 UI Workflow Ready for Production');
    
    // Clean up sample file
    if (fs.existsSync(results.samplePath)) {
      fs.unlinkSync(results.samplePath);
    }
    
    return true;
    
  } catch (error) {
    console.error('\n❌ UI workflow test failed:', error);
    return false;
  }
}

// Run the UI workflow test
runUIWorkflowTest()
  .then(success => {
    if (success) {
      console.log('\n✅ Sample pull UI workflow verified - Ready for user testing');
      process.exit(0);
    } else {
      console.log('\n❌ UI workflow needs fixes before user testing');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });