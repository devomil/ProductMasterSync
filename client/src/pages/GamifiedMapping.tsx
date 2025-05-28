import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GamifiedMappingWorkflow } from "@/components/mapping/GamifiedMappingWorkflow";
import { 
  ArrowLeft, 
  CheckCircle2, 
  Database, 
  FileText,
  Zap,
  Users
} from "lucide-react";

export default function GamifiedMapping() {
  const [, setLocation] = useLocation();
  const [dataSource, setDataSource] = useState<any>(null);
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get data source ID from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const dataSourceId = urlParams.get('dataSourceId');
    
    if (!dataSourceId) {
      setError('No data source specified');
      setIsLoading(false);
      return;
    }

    loadDataSourceAndSample(dataSourceId);
  }, []);

  const loadDataSourceAndSample = async (dataSourceId: string) => {
    try {
      // Load data source details
      const dsResponse = await fetch(`/api/datasources/${dataSourceId}`);
      if (!dsResponse.ok) throw new Error('Failed to load data source');
      const dsData = await dsResponse.json();
      setDataSource(dsData);

      // Load sample data from previous test pull
      const sampleResponse = await fetch(`/api/datasources/${dataSourceId}/sample-data`);
      if (!sampleResponse.ok) throw new Error('No sample data available');
      const sampleResult = await sampleResponse.json();
      
      if (!sampleResult.success || !sampleResult.data || sampleResult.data.length === 0) {
        throw new Error('No sample data available. Please run a test pull first.');
      }

      setSampleData(sampleResult.data);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setIsLoading(false);
    }
  };

  const handleMappingComplete = (result: any) => {
    // Navigate to import success page or back to data sources
    setLocation('/data-sources?import=success');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your data source...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Alert className="border-red-200 bg-red-50 mb-6">
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
        
        <div className="text-center">
          <Button 
            onClick={() => setLocation('/data-sources')}
            variant="outline"
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Data Sources
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button 
            onClick={() => setLocation('/data-sources')}
            variant="ghost" 
            className="gap-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Data Sources
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Gamified Data Integration</h1>
          <p className="text-gray-600 mt-2">
            Transform your mapping process into an engaging, confidence-building experience
          </p>
        </div>
      </div>

      {/* Data Source Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Data Source: {dataSource?.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <div>
                <div className="font-medium">Connection Verified</div>
                <div className="text-sm text-gray-500">Data source is accessible</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-blue-500" />
              <div>
                <div className="font-medium">{sampleData.length} Sample Records</div>
                <div className="text-sm text-gray-500">Ready for mapping analysis</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-purple-500" />
              <div>
                <div className="font-medium">Smart Mapping Ready</div>
                <div className="text-sm text-gray-500">AI-powered field detection</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Benefits Section */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Why Use Gamified Mapping?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Badge variant="secondary" className="mt-1">1</Badge>
                <div>
                  <div className="font-medium">Build Confidence</div>
                  <div className="text-sm text-gray-600">Test with sample data before full import</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="secondary" className="mt-1">2</Badge>
                <div>
                  <div className="font-medium">Catch Issues Early</div>
                  <div className="text-sm text-gray-600">Identify mapping problems before processing thousands of records</div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Badge variant="secondary" className="mt-1">3</Badge>
                <div>
                  <div className="font-medium">Earn Achievements</div>
                  <div className="text-sm text-gray-600">Get rewarded for quality mapping and data validation</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="secondary" className="mt-1">4</Badge>
                <div>
                  <div className="font-medium">Visual Progress</div>
                  <div className="text-sm text-gray-600">See each step of the mapping process with clear feedback</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gamified Workflow */}
      <GamifiedMappingWorkflow
        dataSourceId={dataSource?.id}
        sampleData={sampleData}
        onComplete={handleMappingComplete}
      />
    </div>
  );
}