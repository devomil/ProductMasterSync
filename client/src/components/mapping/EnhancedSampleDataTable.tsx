import { useState, useMemo } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Info } from 'lucide-react';

interface EnhancedSampleDataTableProps {
  sampleData: any[];
  maxRows?: number;
  maxHeight?: string;
  showInstructions?: boolean;
  highlightedColumn?: string | null;
  selectedColumn?: string | null;
}

// Helper function to detect data type
const detectDataType = (value: any): string => {
  if (value === null || value === undefined || value === '') {
    return 'null';
  }
  
  if (typeof value === 'number') {
    return 'number';
  }
  
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  
  // Check for ISO date format
  if (typeof value === 'string') {
    // Date detection - ISO date format check
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}Z?)?$/.test(value)) {
      return 'date';
    }
    
    // Numeric strings
    if (!isNaN(Number(value)) && value.trim() !== '') {
      return 'number';
    }
    
    // Boolean strings
    if (['true', 'false', 'yes', 'no'].includes(value.toLowerCase())) {
      return 'boolean';
    }
  }
  
  return 'string';
};

// Helper function to get color based on data type
const getTypeColor = (type: string): string => {
  switch (type) {
    case 'number':
      return 'bg-blue-50 text-blue-700';
    case 'string':
      return 'bg-green-50 text-green-700';
    case 'boolean':
      return 'bg-purple-50 text-purple-700';
    case 'date':
      return 'bg-amber-50 text-amber-700';
    case 'null':
      return 'bg-gray-50 text-gray-500';
    default:
      return 'bg-slate-50 text-slate-700';
  }
};

// Helper function to format value for display
const formatValue = (value: any): string => {
  if (value === null || value === undefined) {
    return '(empty)';
  }
  
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  }
  
  return String(value);
};

export default function EnhancedSampleDataTable({
  sampleData,
  maxRows = 10,
  maxHeight = '400px',
  showInstructions = true,
  highlightedColumn = null,
  selectedColumn = null
}: EnhancedSampleDataTableProps) {
  const [showTypeLabels, setShowTypeLabels] = useState(true);
  
  // Early return if no data
  if (!sampleData || sampleData.length === 0) {
    return (
      <div className="text-center p-6 bg-slate-50 rounded-md">
        <p className="text-slate-600">No sample data available</p>
        <p className="text-sm text-slate-400 mt-1">
          Upload a sample file to view data
        </p>
      </div>
    );
  }
  
  // Get headers once
  const headers = Object.keys(sampleData[0]);
  
  // Determine column types using all rows (more accurate)
  const columnTypes = useMemo(() => {
    return headers.reduce((acc, header) => {
      // Examine values across all rows to determine most likely type
      const types = sampleData.map(row => detectDataType(row[header]));
      
      // Get most common type
      const typeCounts: Record<string, number> = {};
      let maxCount = 0;
      let dominantType = 'string'; // Default
      
      types.forEach(type => {
        if (!typeCounts[type]) typeCounts[type] = 0;
        typeCounts[type]++;
        
        if (typeCounts[type] > maxCount) {
          maxCount = typeCounts[type];
          dominantType = type;
        }
      });
      
      acc[header] = dominantType;
      return acc;
    }, {} as Record<string, string>);
  }, [sampleData, headers]);
  
  // Limit rows for performance
  const limitedData = sampleData.slice(0, maxRows);
  
  return (
    <div className="space-y-2">
      {showInstructions && (
        <div className="flex items-center text-xs text-slate-500 mb-2">
          <Info className="h-3 w-3 mr-1" />
          <span>Data types are auto-detected and color-coded for easier mapping</span>
        </div>
      )}
      
      <div className="border rounded-md overflow-hidden">
        <div style={{ maxHeight, overflowY: 'auto' }} className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 sticky top-0">
              <TableRow>
                {headers.map(header => (
                  <TableHead 
                    key={header} 
                    className={`
                      relative whitespace-nowrap
                      ${header === highlightedColumn ? 'bg-blue-100' : ''}
                      ${header === selectedColumn ? 'bg-blue-200' : ''}
                    `}
                  >
                    <div className="flex flex-col">
                      <span>{header}</span>
                      {showTypeLabels && (
                        <Badge 
                          variant="outline" 
                          className={`text-[10px] font-normal mt-1 py-0 px-1 ${getTypeColor(columnTypes[header])}`}
                        >
                          {columnTypes[header]}
                        </Badge>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {limitedData.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {headers.map(header => {
                    const value = row[header];
                    const type = detectDataType(value);
                    const displayValue = formatValue(value);
                    
                    return (
                      <TableCell 
                        key={`${rowIndex}-${header}`}
                        className={`
                          whitespace-nowrap 
                          ${type === 'null' ? 'text-gray-400 italic' : ''}
                          ${header === highlightedColumn ? 'bg-blue-100' : ''}
                          ${header === selectedColumn ? 'bg-blue-200' : ''}
                        `}
                      >
                        {displayValue}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      
      {sampleData.length > maxRows && (
        <div className="text-xs text-center text-slate-500">
          Showing {maxRows} of {sampleData.length} rows
        </div>
      )}
    </div>
  );
}