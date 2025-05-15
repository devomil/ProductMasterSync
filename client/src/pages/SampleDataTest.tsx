import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EnhancedSampleDataTable from "@/components/mapping/EnhancedSampleDataTable";

// Sample data for testing
const testData = [
  {
    sku: "ABC123",
    product_name: "Test Product 1",
    price: 19.99,
    cost: 9.99,
    quantity: 100,
    category: "Electronics",
    manufacturer: "Test Company",
    created_at: "2023-01-15",
    status: "active",
    is_featured: true,
    upc: "123456789012"
  },
  {
    sku: "DEF456",
    product_name: "Test Product 2",
    price: 29.99,
    cost: 15.50,
    quantity: 50,
    category: "Home Goods",
    manufacturer: "Another Company",
    created_at: "2023-02-20",
    status: "active",
    is_featured: false,
    upc: "234567890123"
  },
  {
    sku: "GHI789",
    product_name: "Test Product 3",
    price: 9.99,
    cost: 5.00,
    quantity: 0,
    category: "Electronics",
    manufacturer: "Test Company",
    created_at: "2023-03-10",
    status: "inactive",
    is_featured: false,
    upc: null
  },
  {
    sku: "JKL012",
    product_name: "Test Product 4",
    price: 49.99,
    cost: 22.75,
    quantity: 25,
    category: "Office Supplies",
    manufacturer: "Office Co",
    created_at: "2023-04-05",
    status: "active",
    is_featured: true,
    upc: "345678901234"
  },
  {
    sku: "MNO345",
    product_name: "Test Product 5",
    price: 15.99,
    cost: 7.25,
    quantity: 75,
    category: "Electronics",
    manufacturer: "Electronics Inc",
    created_at: "2023-05-12",
    status: "active",
    is_featured: false,
    upc: "456789012345"
  }
];

export default function SampleDataTest() {
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [showTable, setShowTable] = useState(false);

  const loadSampleData = () => {
    setSampleData(testData);
    setShowTable(true);
  };

  return (
    <div className="p-8">
      <Card>
        <CardHeader>
          <CardTitle>Sample Data Table Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <Button onClick={loadSampleData}>
              Load Sample Data
            </Button>
          </div>

          {showTable && (
            <EnhancedSampleDataTable 
              sampleData={sampleData} 
              maxHeight="500px" 
              maxRows={10} 
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}