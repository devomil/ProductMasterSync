import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import type { DataSource } from '@shared/schema';
import { RemotePathItem } from '@/components/data-sources/SampleDataModal';

export interface SampleDataResult {
  success: boolean;
  message: string;
  data?: any[];
  filename?: string;
  fileType?: string;
  remote_path?: string;
  total_records?: number;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
}

export function useDataSourceActions() {
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isPullingSampleData, setIsPullingSampleData] = useState(false);
  const [sampleData, setSampleData] = useState<SampleDataResult | null>(null);
  const [showSampleDataModal, setShowSampleDataModal] = useState(false);
  const [rawResponseData, setRawResponseData] = useState("");
  const [selectedFilePath, setSelectedFilePath] = useState<RemotePathItem | null>(null);
  const [dataSourceToDelete, setDataSourceToDelete] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Function to handle test connection for an existing data source
  const handleTestConnectionForDataSource = async (dataSource: DataSource) => {
    try {
      setIsTestingConnection(true);
      
      // Extract credentials from data source
      let credentials = dataSource.config;
      if (typeof credentials === 'string') {
        try {
          credentials = JSON.parse(credentials);
        } catch (e) {
          credentials = { data: credentials };
        }
      }
      
      // Make the API call to test the connection
      const response = await fetch('/api/connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: dataSource.type,
          credentials
        }),
        credentials: 'include'
      }).then(res => res.json());
      
      // Display the result
      if (response.success) {
        toast({
          title: "Connection Successful",
          description: response.message || "Connection test passed successfully"
        });
      } else {
        toast({
          variant: "destructive",
          title: "Connection Failed",
          description: response.message || "Unable to establish connection"
        });
      }
    } catch (error) {
      console.error("Error testing connection:", error);
      toast({
        variant: "destructive",
        title: "Connection Test Error",
        description: error instanceof Error ? error.message : "An unknown error occurred"
      });
    } finally {
      setIsTestingConnection(false);
    }
  };
  
  // Function to handle pull sample data for an existing data source
  const handlePullSampleDataForDataSource = async (dataSource: DataSource) => {
    try {
      setIsPullingSampleData(true);
      setSampleData(null);
      setShowSampleDataModal(false);
      
      // Extract credentials from data source
      let credentials = dataSource.config;
      if (typeof credentials === 'string') {
        try {
          credentials = JSON.parse(credentials);
        } catch (e) {
          credentials = { data: credentials };
        }
      }
      
      // Show loading toast
      const loadingToastId = toast({
        title: "Pulling Sample Data",
        description: "Retrieving data from source, please wait...",
      });
      
      // Make the API call to pull sample data
      // For SFTP, make sure we're sending the correct path
      let requestBody = {
        type: dataSource.type,
        credentials,
        supplier_id: dataSource.supplierId || 1,
        limit: 10
      };
      
      // Add remote_path specifically for SFTP connections if available
      if (dataSource.type === 'sftp') {
        // If we have a path from the remote_paths array, use it
        if (credentials.remote_paths && credentials.remote_paths.length > 0) {
          requestBody = {
            ...requestBody,
            remote_path: credentials.remote_paths[0].path || '/eco8/out/catalog.csv',
            specific_path: credentials.remote_paths[0].path || '/eco8/out/catalog.csv'
          };
        } else {
          // Otherwise use a default path
          requestBody = {
            ...requestBody,
            remote_path: '/eco8/out/catalog.csv',
            specific_path: '/eco8/out/catalog.csv'
          };
        }
      }
      
      const response = await fetch('/api/connections/sample-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        credentials: 'include'
      });
      
      // Get the raw response text for debugging
      const responseText = await response.text();
      setRawResponseData(responseText);
      
      try {
        // Try to parse the response as JSON
        const result = JSON.parse(responseText);
        
        // Process the result
        setSampleData({
          success: result.success || false,
          message: result.message || 'No response message',
          data: result.records || result.data || [],
          filename: result.filename || 'Unknown',
          fileType: result.fileType || 'Unknown',
          total_records: result.total_records || 
            (result.records ? result.records.length : 
             (result.data ? result.data.length : 0))
        });
        
        // Show success or error message
        if (result.success) {
          toast({
            title: "Sample Data Retrieved",
            description: `Retrieved ${result.total_records || result.records?.length || 0} records successfully`
          });
          
          // Set selected file path and show the modal
          setSelectedFilePath(result.filename || 'Unknown');
          setShowSampleDataModal(true);
        } else {
          toast({
            variant: "destructive",
            title: "Failed to Retrieve Sample Data",
            description: result.message || "Unknown error occurred"
          });
        }
      } catch (parseError) {
        console.error("Error parsing response:", parseError);
        
        // If we couldn't parse the response, show it as a failure
        setSampleData({
          success: false,
          message: "Failed to parse server response",
          data: [],
          filename: 'Error'
        });
        
        toast({
          variant: "destructive",
          title: "Response Parse Error",
          description: "The server returned an invalid response format"
        });
      }
    } catch (error) {
      console.error("Sample data pull error:", error);
      setSampleData({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
        data: []
      });
      
      toast({
        variant: "destructive",
        title: "Sample Data Error",
        description: error instanceof Error ? error.message : "Unknown error occurred"
      });
    } finally {
      setIsPullingSampleData(false);
    }
  };
  
  // Function to handle delete data source action
  const handleDeleteDataSource = (id: number) => {
    setDataSourceToDelete(id);
    setShowDeleteConfirm(true);
  };
  
  // Function to configure scheduler for a data source
  const handleConfigureScheduler = (dataSource: DataSource) => {
    toast({
      title: "Scheduler Configuration",
      description: "Scheduler configuration feature coming soon!"
    });
  };

  // Function to handle delete confirmation
  const handleConfirmDelete = async (dataSources: DataSource[], setDataSources: Function) => {
    if (!dataSourceToDelete) return;
    
    try {
      setIsDeleting(true);
      
      // Call API to delete data source
      await fetch(`/api/datasources/${dataSourceToDelete}`, {
        method: 'DELETE'
      });
      
      // Remove from local state
      if (Array.isArray(dataSources)) {
        setDataSources(dataSources.filter(ds => ds.id !== dataSourceToDelete));
      }
      
      toast({
        title: "Data Source Deleted",
        description: "The data source has been successfully deleted."
      });
      
      setShowDeleteConfirm(false);
      setDataSourceToDelete(null);
    } catch (error) {
      console.error("Error deleting data source:", error);
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: "There was an error deleting the data source."
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    // States
    isTestingConnection,
    isPullingSampleData,
    sampleData,
    showSampleDataModal,
    rawResponseData,
    selectedFilePath,
    dataSourceToDelete,
    showDeleteConfirm,
    isDeleting,
    
    // Setters
    setIsTestingConnection,
    setIsPullingSampleData,
    setSampleData,
    setShowSampleDataModal,
    setRawResponseData,
    setSelectedFilePath,
    setDataSourceToDelete,
    setShowDeleteConfirm,
    setIsDeleting,
    
    // Actions
    handleTestConnectionForDataSource,
    handlePullSampleDataForDataSource,
    handleDeleteDataSource,
    handleConfigureScheduler,
    handleConfirmDelete
  };
}