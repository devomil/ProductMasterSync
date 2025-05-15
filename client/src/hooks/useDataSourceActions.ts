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
  const [showPathSelector, setShowPathSelector] = useState(false);
  const [rawResponseData, setRawResponseData] = useState("");
  const [selectedFilePath, setSelectedFilePath] = useState<RemotePathItem | null>(null);
  const [dataSourceToDelete, setDataSourceToDelete] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentDataSource, setCurrentDataSource] = useState<DataSource | null>(null);

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
      // Save current data source for future reference
      setCurrentDataSource(dataSource);
      
      // Extract credentials from data source
      let credentials = dataSource.config;
      if (typeof credentials === 'string') {
        try {
          credentials = JSON.parse(credentials);
        } catch (e) {
          credentials = { data: credentials };
        }
      }
      
      // For SFTP sources with multiple paths, show the path selector
      if (dataSource.type === 'sftp' && credentials.remote_paths && credentials.remote_paths.length > 0) {
        // Convert remote_paths to RemotePathItem[] format
        const pathsForSelection: RemotePathItem[] = credentials.remote_paths.map((path: any, index: number) => ({
          id: `path-${index}`,
          label: path.label || `Path ${index + 1}`,
          path: path.path,
          lastPulled: path.lastPulled,
          lastPullStatus: path.lastPullStatus
        }));
        
        // If there are paths, show the selector
        if (pathsForSelection.length > 0) {
          setSelectedFilePath(null);
          setSampleData(null);
          setShowPathSelector(true);
          return;
        }
      }
      
      // For other types or no paths, proceed with default behavior
      processPullSampleDataForPath(dataSource);
    } catch (error) {
      console.error("Error preparing sample data pull:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "An unknown error occurred"
      });
    }
  };
  
  // Function to process the sample data pull for a selected path
  const processPullSampleDataForPath = async (dataSource: DataSource, selectedPath?: RemotePathItem) => {
    // Declare progressTimeout at the top level of the function so it's accessible in try/catch/finally
    let progressTimeout: NodeJS.Timeout | undefined;
    
    try {
      setIsPullingSampleData(true);
      setSampleData(null);
      setShowSampleDataModal(false);
      setShowPathSelector(false);
      
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
        description: "Retrieving data from source, please wait... (This may take up to 30 seconds for large files)",
        duration: 30000,
      });
      
      // Set up a timeout to show progress update for long-running requests
      progressTimeout = setTimeout(() => {
        toast({
          title: "Still Processing...",
          description: "The file is large and still being processed. Please continue to wait...",
          duration: 15000,
        });
      }, 15000); // Show after 15 seconds
      
      // Make the API call to pull sample data
      // For SFTP, make sure we're sending the correct path
      let requestBody = {
        type: dataSource.type,
        credentials,
        supplier_id: dataSource.supplierId || 1,
        limit: 50
      };
      
      // Add remote_path specifically for SFTP connections if available
      if (dataSource.type === 'sftp') {
        // If a specific path was selected, use it
        if (selectedPath) {
          requestBody = {
            ...requestBody,
            remote_path: selectedPath.path,
            specific_path: selectedPath.path
          };
          
          // Save the selected path for display
          setSelectedFilePath(selectedPath);
        } 
        // Otherwise use the first path in the config or a default
        else if (credentials.remote_paths && credentials.remote_paths.length > 0) {
          requestBody = {
            ...requestBody,
            remote_path: credentials.remote_paths[0].path || '/eco8/out/catalog.csv',
            specific_path: credentials.remote_paths[0].path || '/eco8/out/catalog.csv'
          };
          
          // Create a RemotePathItem from the first path
          setSelectedFilePath({
            id: 'path-0',
            label: credentials.remote_paths[0].label || 'Path 1',
            path: credentials.remote_paths[0].path
          });
        } else {
          // Otherwise use a default path
          requestBody = {
            ...requestBody,
            remote_path: '/eco8/out/catalog.csv',
            specific_path: '/eco8/out/catalog.csv'
          };
          
          setSelectedFilePath({
            id: 'default-path',
            label: 'Default Path',
            path: '/eco8/out/catalog.csv'
          });
        }
      }
      
      console.log('Sending sample data request:', requestBody);
      
      const response = await fetch('/api/connections/sample-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        credentials: 'include'
      });
      
      // Clear the progress timeout since we got a response
      if (progressTimeout) clearTimeout(progressTimeout);
      
      // Get the raw response text for debugging
      const responseText = await response.text();
      setRawResponseData(responseText);
      
      // Log the raw response for debugging
      console.log('Raw response:', responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''));
      
      try {
        // Try to parse the response as JSON
        const result = JSON.parse(responseText);
        
        // Process the result
        setSampleData({
          success: result.success || false,
          message: result.message || 'No response message',
          data: result.records || result.data || [],
          filename: result.filename || (selectedPath ? selectedPath.label : 'Unknown'),
          fileType: result.fileType || 'Unknown',
          remote_path: result.remote_path || (selectedPath ? selectedPath.path : '/'),
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
          
          // Make sure we're showing the modal
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
        
        // Still show the modal with the error information
        setSelectedFilePath({
          id: 'error',
          label: 'Parse Error',
          path: '/'
        });
        setShowSampleDataModal(true);
      }
    } catch (error) {
      // Clear the progress timeout if still active
      if (progressTimeout) clearTimeout(progressTimeout);
      
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
      
      // Still show the modal with the error information
      setSelectedFilePath({
        id: 'error',
        label: 'Error Occurred',
        path: '/'
      });
      setShowSampleDataModal(true);
    } finally {
      // Clear the progress timeout just to be sure
      if (progressTimeout) clearTimeout(progressTimeout);
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
    showPathSelector,
    rawResponseData,
    selectedFilePath,
    dataSourceToDelete,
    showDeleteConfirm,
    isDeleting,
    currentDataSource,
    
    // Setters
    setIsTestingConnection,
    setIsPullingSampleData,
    setSampleData,
    setShowSampleDataModal,
    setShowPathSelector,
    setRawResponseData,
    setSelectedFilePath,
    setDataSourceToDelete,
    setShowDeleteConfirm,
    setIsDeleting,
    setCurrentDataSource,
    
    // Actions
    handleTestConnectionForDataSource,
    handlePullSampleDataForDataSource,
    processPullSampleDataForPath,
    handleDeleteDataSource,
    handleConfigureScheduler,
    handleConfirmDelete
  };
}