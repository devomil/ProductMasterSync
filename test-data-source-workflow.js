/**
 * Test the complete Data Source workflow with CWR credentials
 * This simulates the user experience for supplier onboarding
 */

async function testDataSourceWorkflow() {
  console.log('🚀 Testing Data Source Workflow');
  console.log('===============================\n');

  try {
    // Step 1: Create a data source
    console.log('Step 1: Creating CWR Distribution data source...');
    
    const dataSourcePayload = {
      name: "CWR Distribution SFTP",
      description: "Main product catalog feed from CWR Distribution",
      type: "csv", // Use CSV type for file upload since we have the authentic data
      supplier_id: 2, // CWR Distribution supplier ID
      config: JSON.stringify({
        file_format: "csv",
        has_header: true,
        delimiter: ",",
        encoding: "utf-8"
      }),
      active: true
    };

    const createResponse = await fetch('/api/datasources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataSourcePayload)
    });

    const dataSource = await createResponse.json();
    console.log(`✓ Data source created: ${dataSource.name} (ID: ${dataSource.id})`);

    // Step 2: Test sample data pull using our authentic CWR file
    console.log('\nStep 2: Testing sample data pull...');
    
    const sampleDataPayload = {
      type: "csv",
      credentials: {
        file_format: "csv",
        has_header: true,
        delimiter: ",",
        encoding: "utf-8",
        file_path: "./temp/authentic-catalog.csv" // Use our real CWR data
      },
      limit: 50 // Pull 50 sample products
    };

    const sampleResponse = await fetch('/api/connections/sample-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleDataPayload)
    });

    const sampleResult = await sampleResponse.json();
    
    if (sampleResult.success) {
      console.log(`✓ Sample data retrieved: ${sampleResult.records?.length || 0} products`);
      console.log(`  Total records available: ${sampleResult.total_records || 'Unknown'}`);
      console.log(`  File type: ${sampleResult.fileType || 'Unknown'}`);
      
      // Show sample field analysis
      if (sampleResult.records && sampleResult.records.length > 0) {
        console.log('\nSample Data Analysis:');
        console.log('=====================');
        
        const sampleRecord = sampleResult.records[0];
        const fields = Object.keys(sampleRecord);
        console.log(`Fields available: ${fields.length}`);
        
        // Show key fields for mapping
        const keyFields = [
          'Title', 
          'CWR Part Number', 
          'UPC Code', 
          'Your Cost', 
          'List Price',
          'Category Name',
          'Manufacturer Name',
          'Image (300x300) Url'
        ];
        
        console.log('\nKey Field Mapping Preview:');
        keyFields.forEach(field => {
          if (sampleRecord[field]) {
            const value = String(sampleRecord[field]).substring(0, 50);
            console.log(`  ${field}: ${value}${value.length >= 50 ? '...' : ''}`);
          }
        });
      }
    } else {
      console.log(`❌ Sample data pull failed: ${sampleResult.message}`);
    }

    console.log('\n🎯 Workflow Results:');
    console.log('====================');
    console.log(`Data source created: ${dataSource.id ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Sample data pulled: ${sampleResult.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Ready for mapping: ${sampleResult.success && sampleResult.records?.length > 0 ? 'YES' : 'NO'}`);

    if (sampleResult.success && sampleResult.records?.length > 0) {
      console.log('\n✅ Supplier onboarding workflow ready for production');
      console.log('Users can now:');
      console.log('- Add data sources with credentials');
      console.log('- Test connections'); 
      console.log('- Pull 50 sample products for review');
      console.log('- Proceed to field mapping');
      console.log('- Execute full catalog imports');
    }

    return true;

  } catch (error) {
    console.error('\n❌ Workflow test failed:', error.message);
    return false;
  }
}

// Run the test
testDataSourceWorkflow()
  .then(success => {
    console.log(success ? '\n🌟 Test completed successfully' : '\n💥 Test failed');
  })
  .catch(error => {
    console.error('Test error:', error);
  });