import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface EnhancedSampleDataTableProps {
  sampleData: any[];
  maxHeight?: string;
  maxRows?: number;
  showInstructions?: boolean;
}

const EnhancedSampleDataTable: React.FC<EnhancedSampleDataTableProps> = ({ 
  sampleData,
  maxHeight = '400px',
  maxRows = 10,
  showInstructions = true
}) => {
  if (!sampleData || sampleData.length === 0) {
    return null;
  }

  const headers = Object.keys(sampleData[0]);
  const displayRows = sampleData.slice(0, maxRows);

  // Helper to get value type to colorize cells
  const getCellTypeClass = (value: any) => {
    if (value === null || value === undefined || value === '') {
      return 'text-gray-400 italic';
    }
    if (typeof value === 'number') {
      return 'text-blue-700';
    }
    if (typeof value === 'boolean') {
      return 'text-purple-700 font-medium';
    }
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}|^\d{2}\/\d{2}\/\d{4}/)) {
      return 'text-green-700';
    }
    return '';
  };

  return (
    <>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-md font-medium">Sample Data Preview</h3>
        <div className="text-sm text-muted-foreground">
          Showing {Math.min(sampleData.length, maxRows)} of {sampleData.length} rows
        </div>
      </div>
      
      <div className="border rounded-md overflow-auto mb-6" style={{ maxHeight }}>
        <Table className="min-w-full table-fixed">
          <TableHeader className="sticky top-0 bg-slate-50 z-10">
            <TableRow>
              {headers.map((header) => (
                <TableHead 
                  key={header} 
                  className="font-bold text-black bg-slate-100 whitespace-nowrap px-4 py-3 min-w-[150px]"
                >
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map((row, index) => (
              <TableRow key={index} className={index % 2 === 0 ? "bg-white" : "bg-slate-50 hover:bg-gray-100"}>
                {headers.map((header, i) => {
                  const cellValue = row[header];
                  const typeClass = getCellTypeClass(cellValue);
                  
                  return (
                    <TableCell 
                      key={`${index}-${i}`} 
                      className={`px-4 py-3 border-b whitespace-nowrap overflow-hidden text-ellipsis ${typeClass}`}
                      title={cellValue !== undefined && cellValue !== null ? String(cellValue) : ''}
                    >
                      {cellValue !== undefined && cellValue !== null ? String(cellValue) : '—'}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {showInstructions && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-4">
          <h4 className="font-medium text-amber-800 mb-2 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Field Mapping Instructions
          </h4>
          <p className="text-sm text-amber-700">
            Map each source field (from your data) to a target field (in your system). 
            Use the dropdown selectors below to create these mappings.
          </p>
        </div>
      )}
    </>
  );
};

export default EnhancedSampleDataTable;