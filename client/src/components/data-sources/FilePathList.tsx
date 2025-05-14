import React from 'react';
import { format } from 'date-fns';
import { RemotePathItem } from './SampleDataModal';

interface FilePathListProps {
  paths: RemotePathItem[];
  onSelectPath: (path: RemotePathItem) => void;
  onDeletePath: (id: string) => void;
  onAddPath: () => void;
  isPullingSampleData: boolean;
}

const FilePathList: React.FC<FilePathListProps> = ({
  paths,
  onSelectPath,
  onDeletePath,
  onAddPath,
  isPullingSampleData,
}) => {
  return (
    <div className="space-y-2 my-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium">Remote Paths</h3>
        <button 
          onClick={onAddPath} 
          className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-1 rounded"
        >
          Add Path
        </button>
      </div>
      
      <div className="space-y-2">
        {paths.map((path) => (
          <div 
            key={path.id} 
            className="border rounded p-3 bg-gray-50 hover:bg-gray-100 transition-colors relative"
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium">{path.label}</div>
                <div className="text-sm text-gray-600">{path.path}</div>
                
                {path.lastPulled && (
                  <div className="text-xs mt-1 flex items-center gap-1">
                    <span>Last pulled: </span>
                    <span className={`px-1.5 py-0.5 rounded ${
                      path.lastPullStatus === 'success' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {format(new Date(path.lastPulled), 'MMM d, yyyy HH:mm:ss')}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => onSelectPath(path)}
                  disabled={isPullingSampleData}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded flex items-center gap-1 disabled:bg-gray-400"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Pull Data
                </button>
                
                <button
                  onClick={() => onDeletePath(path.id)}
                  className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {paths.length === 0 && (
          <div className="text-sm text-gray-500 italic p-2 text-center border rounded bg-gray-50">
            No remote paths configured. Add a path to start pulling data.
          </div>
        )}
      </div>
    </div>
  );
};

export default FilePathList;