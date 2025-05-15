import React from 'react';

interface EnhancedSampleDataTableProps {
  sampleData: any[];
  maxRows?: number;
  maxHeight?: string;
  showInstructions?: boolean;
  highlightedColumn?: string | null;
  selectedColumn?: string | null;
}

export default function EnhancedSampleDataTable({
  sampleData,
  maxRows = 20,
  maxHeight = '500px',
  showInstructions = false,
  highlightedColumn = null,
  selectedColumn = null
}: EnhancedSampleDataTableProps) {
  // Handle empty data case
  if (!sampleData || sampleData.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No sample data available. Please upload a file or pull from a data source.
      </div>
    );
  }

  // Get all unique column headers
  const headers = Object.keys(sampleData[0]);
  
  // Limit number of rows displayed
  const displayData = sampleData.slice(0, maxRows);

  return (
    <div style={{ maxHeight }} className="overflow-auto">
      {showInstructions && (
        <div className="bg-blue-50 p-2 text-xs text-blue-700 border-b border-blue-200">
          Click on column headers to select fields for mapping
        </div>
      )}
      
      <table className="w-full text-sm border-collapse">
        <thead className="bg-slate-50 sticky top-0 z-10">
          <tr>
            <th className="p-2 border-b text-left font-medium text-slate-500 w-12">Row</th>
            {headers.map((header, index) => (
              <th 
                key={index} 
                className={`
                  p-2 border-b text-left font-medium whitespace-nowrap
                  ${highlightedColumn === header ? 'bg-blue-100' : ''}
                  ${selectedColumn === header ? 'bg-blue-200' : ''}
                `}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayData.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
              <td className="p-2 border-b text-slate-500 text-center">{rowIndex + 1}</td>
              {headers.map((header, colIndex) => (
                <td 
                  key={colIndex} 
                  className={`
                    p-2 border-b font-mono text-xs truncate max-w-xs
                    ${highlightedColumn === header ? 'bg-blue-50' : ''}
                    ${selectedColumn === header ? 'bg-blue-100' : ''}
                  `}
                  title={String(row[header] || "")}
                >
                  {row[header] === null || row[header] === undefined 
                    ? <span className="text-slate-400 italic">null</span>
                    : String(row[header])
                  }
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      
      {sampleData.length > maxRows && (
        <div className="p-2 bg-slate-50 text-xs text-center text-slate-500 border-t">
          Showing {maxRows} of {sampleData.length} rows
        </div>
      )}
    </div>
  );
}