import { useState } from "react";
import { 
  Upload, 
  Plus, 
  Search, 
  Filter, 
  RefreshCcw,
  Building2,
  Package2,
  AlertTriangle,
  Clock,
  ArrowUpDown,
  MoreHorizontal,
  Eye,
  FileText,
  Trash2,
} from "lucide-react";
import { useImports } from "@/hooks/useImports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow, format } from "date-fns";
import ImportModal from "@/components/imports/ImportModal";

const DataImports = () => {
  const { imports, isLoading } = useImports();
  const [searchQuery, setSearchQuery] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);

  // Filter imports based on search query
  const filteredImports = imports.filter(importItem => 
    importItem.filename?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (importItem.type && importItem.type.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge variant="success">Success</Badge>;
      case "processing":
        return <Badge variant="warning">Processing</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const getSupplierName = (supplierId?: number) => {
    if (!supplierId) return "N/A";
    const supplierMap: Record<number, string> = {
      1: "ABC Trading Co.",
      2: "XYZ Supplies Inc.",
      3: "Global Supplies Ltd.",
      4: "West Coast Distributors",
      5: "Eastern Merchandise Group"
    };
    return supplierMap[supplierId] || `Supplier ID: ${supplierId}`;
  };

  const getTimeText = (date?: Date) => {
    if (!date) return "N/A";
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  return (
    <>
      <div className="pb-5 border-b border-neutral-200 sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Data Imports</h1>
        <div className="mt-3 sm:mt-0 sm:ml-4">
          <Button onClick={() => setShowImportModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Import
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
            <Input 
              type="search" 
              placeholder="Search imports by name or type"
              className="pl-9" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
            <Button variant="outline" size="sm">
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-md">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">
                    <div className="flex items-center">
                      Filename
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredImports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-6 text-neutral-500">
                      {searchQuery ? "No imports matching your search" : "No imports available"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredImports.map((importItem) => (
                    <TableRow key={importItem.id}>
                      <TableCell className="font-medium">{importItem.filename || "API Import"}</TableCell>
                      <TableCell>{getSupplierName(importItem.supplierId)}</TableCell>
                      <TableCell className="capitalize">{importItem.type}</TableCell>
                      <TableCell>{getStatusBadge(importItem.status)}</TableCell>
                      <TableCell>
                        {importItem.recordCount > 0 ? (
                          <div className="flex items-center space-x-1">
                            <span>{importItem.recordCount}</span>
                            {importItem.errorCount > 0 && (
                              <span className="text-red-500 flex items-center">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                {importItem.errorCount}
                              </span>
                            )}
                          </div>
                        ) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Clock className="h-3 w-3 mr-1 text-neutral-400" />
                          {getTimeText(importItem.createdAt ? new Date(importItem.createdAt) : undefined)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {importItem.completedAt ? (
                          getTimeText(new Date(importItem.completedAt))
                        ) : (
                          importItem.status === 'processing' ? (
                            <div className="w-24 bg-neutral-200 rounded-full h-2.5">
                              <div 
                                className="bg-primary h-2.5 rounded-full" 
                                style={{ 
                                  width: `${Math.round((importItem.processedCount / (importItem.recordCount || 1)) * 100)}%` 
                                }}
                              ></div>
                            </div>
                          ) : 'Pending'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <FileText className="mr-2 h-4 w-4" />
                              View Log
                            </DropdownMenuItem>
                            {importItem.status !== 'processing' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-600">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <ImportModal open={showImportModal} onOpenChange={setShowImportModal} />
    </>
  );
};

export default DataImports;
