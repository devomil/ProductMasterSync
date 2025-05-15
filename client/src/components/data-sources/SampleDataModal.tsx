import React from 'react';
import { toast } from "@/hooks/use-toast";

// Imported from parent component
export interface RemotePathItem {
  id: string; // used for UI manipulation
  label: string;
  path: string;
  lastPulled?: string; // ISO timestamp of last successful pull
  lastPullStatus?: 'success' | 'error'; // Status of the last pull attempt
}

interface SampleDataModalProps {
  sampleData: {
    success: boolean;
    message: string;
    data?: any[];
    filename?: string;
    fileType?: string;
    remote_path?: string;
    total_records?: number;
  };
  selectedFilePath: RemotePathItem | null;
  rawResponseData: string;
  onClose: () => void;
  onSaveTimestamp: (pathId: string) => void;
}

const SampleDataModal: React.FC<SampleDataModalProps> = ({
  sampleData,
  selectedFilePath,
  rawResponseData,
  onClose,
  onSaveTimestamp,
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[90%] max-w-6xl max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            Sample Data from {sampleData.filename || selectedFilePath?.label}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <div className="flex gap-2 items-center">
            <span className="font-semibold">Status:</span>
            {sampleData.success ? (
              <span className="text-green-600 bg-green-100 px-2 py-1 rounded-full text-sm">
                Success
              </span>
            ) : (
              <span className="text-red-600 bg-red-100 px-2 py-1 rounded-full text-sm">
                Error
              </span>
            )}
          </div>
          
          <div className="mt-2"><span className="font-semibold">Message:</span> {sampleData.message}</div>
          {sampleData.total_records && (
            <div className="mt-2"><span className="font-semibold">Total Records:</span> {sampleData.total_records}</div>
          )}
          {sampleData.fileType && (
            <div className="mt-2"><span className="font-semibold">File Type:</span> {sampleData.fileType}</div>
          )}
        </div>

        {sampleData.data && sampleData.data.length > 0 && (
          <div className="border rounded overflow-auto max-h-[60vh]">
            <table className="w-full">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  {Object.keys(sampleData.data[0]).map((header, idx) => (
                    <th key={idx} className="px-4 py-2 text-left border-b">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sampleData.data.slice(0, 20).map((row, rowIdx) => (
                  <tr key={rowIdx} className="border-b hover:bg-gray-50">
                    {Object.values(row).map((value, colIdx) => (
                      <td key={colIdx} className="px-4 py-2 truncate max-w-[200px]">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rawResponseData && (
          <div className="mt-4">
            <h3 className="text-lg font-medium mb-2">Raw Response Data</h3>
            <div className="bg-gray-100 p-3 rounded overflow-auto max-h-[200px] text-sm font-mono">
              {rawResponseData}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-between">
          {/* Left side buttons */}
          <div className="flex gap-2">
            {sampleData.success && selectedFilePath && (
              <button
                onClick={() => {
                  toast({
                    title: "Create Mapping Template",
                    description: "Redirecting to create a mapping template using this sample data"
                  });
                  // Navigate to the mapping templates page with query params to pre-populate data
                  window.location.href = `/mapping-templates?create=true&path=${encodeURIComponent(selectedFilePath.path)}&label=${encodeURIComponent(selectedFilePath.label)}&source=${sampleData.fileType || "csv"}`;
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create Mapping Template
              </button>
            )}
          </div>
          
          {/* Right side buttons */}
          <div className="flex gap-2">
            {sampleData.success && selectedFilePath && (
              <button
                onClick={() => selectedFilePath && onSaveTimestamp(selectedFilePath.id)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Save Timestamp & Close
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SampleDataModal;