import { toast } from "@/hooks/use-toast";
import { RemotePathItem } from "./SampleDataModal";

interface PullSampleDataParams {
  selectedFile: RemotePathItem;
  credentials: any;
  suppressToast?: boolean;
}

interface PullSampleDataResult {
  success: boolean;
  message: string;
  data?: any[];
  rawResponse: string;
  filename?: string;
  fileType?: string;
  remote_path?: string;
  total_records?: number;
}

/**
 * Pull sample data for a specific file with enhanced error logging
 */
export const pullSampleDataForFile = async (
  params: PullSampleDataParams
): Promise<PullSampleDataResult> => {
  const { selectedFile, credentials, suppressToast } = params;
  
  // Show initial toast unless suppressed
  if (!suppressToast) {
    toast({
      title: "Pull Sample Data Started",
      description: `Started pulling sample data from ${selectedFile.label}. This may take a moment...`,
    });
  }
  
  try {
    // Create a copy of credentials with just the selected file path
    const requestCredentials = {
      ...credentials,
      remote_paths: [selectedFile]
    };
    
    // Make the request
    const response = await fetch('/api/connections/sample-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'sftp',
        credentials: requestCredentials,
        supplier_id: 1, // Hardcoded for now
        limit: 10, // Only pull 10 records for sample
        specific_path: selectedFile.path,
      }),
      credentials: 'include',
    });
    
    // Get the full response text for raw display
    const responseText = await response.text();
    let result: any;
    
    try {
      // Try to parse as JSON
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('Error parsing response as JSON:', e);
      // Return non-JSON response with error details
      return {
        success: false,
        message: 'Failed to parse server response as JSON',
        rawResponse: responseText,
        filename: selectedFile.label,
        remote_path: selectedFile.path,
      };
    }
    
    // Process successful response
    if (result.success) {
      if (!suppressToast) {
        toast({
          title: "Sample Data Retrieved",
          description: `Successfully retrieved ${result.records?.length || 0} records from ${selectedFile.label}`,
        });
      }
      
      return {
        success: true,
        message: result.message || 'Successfully retrieved sample data',
        data: result.records || [],
        rawResponse: responseText,
        filename: selectedFile.label,
        fileType: result.fileType,
        remote_path: selectedFile.path,
        total_records: result.total_records || result.records?.length || 0,
      };
    } else {
      // Process error response
      if (!suppressToast) {
        toast({
          variant: "destructive",
          title: "Error Retrieving Sample Data",
          description: result.message || 'An unknown error occurred',
        });
      }
      
      return {
        success: false,
        message: result.message || 'Failed to retrieve sample data',
        rawResponse: responseText,
        filename: selectedFile.label,
        remote_path: selectedFile.path,
      };
    }
  } catch (error) {
    console.error('Error in sample data pull:', error);
    
    if (!suppressToast) {
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
    
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      rawResponse: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      filename: selectedFile.label,
      remote_path: selectedFile.path,
    };
  }
};

/**
 * Attempts to retry a failed pull operation with exponential backoff
 */
export const retryPullWithBackoff = async (
  params: PullSampleDataParams,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<PullSampleDataResult> => {
  let lastError: PullSampleDataResult = {
    success: false,
    message: 'Not attempted',
    rawResponse: '',
  };
  
  // Always show initial retry toast
  toast({
    title: "Retrying Data Pull",
    description: `Attempting to retry data pull from ${params.selectedFile.label}...`,
  });
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Only show toast on the last attempt
      const result = await pullSampleDataForFile({
        ...params,
        suppressToast: attempt < maxRetries - 1
      });
      
      if (result.success) {
        // Success! Return the result.
        toast({
          title: "Retry Successful",
          description: `Successfully retrieved data after ${attempt + 1} attempt(s)`,
        });
        return result;
      }
      
      // Save this error for potential return
      lastError = result;
      
      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Retry attempt ${attempt + 1} failed. Waiting ${delay}ms before next attempt...`);
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (error) {
      console.error(`Retry attempt ${attempt + 1} threw exception:`, error);
      lastError = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error in retry',
        rawResponse: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        filename: params.selectedFile.label,
        remote_path: params.selectedFile.path,
      };
    }
  }
  
  // If we've exhausted all retries, return the last error
  toast({
    variant: "destructive",
    title: "Retry Failed",
    description: `Failed to retrieve data after ${maxRetries} attempts.`,
  });
  
  return lastError;
};