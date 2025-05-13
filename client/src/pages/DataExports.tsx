import { useState } from "react";
import { 
  Download, 
  Plus, 
  Search, 
  Filter, 
  RefreshCcw,
  Clock,
  FileType,
  ArrowUpDown,
  MoreHorizontal,
  Eye,
  FileText,
  Trash2,
  ShieldCheck,
  Settings,
} from "lucide-react";
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
import { formatDistanceToNow } from "date-fns";

// Mock data for exports (would normally come from a hook)
const mockExports = [
  {
    id: 1,
    name: "Weekly Product Catalog",
    type: "file",
    status: "success",
    format: "excel",
    filter: { categoryId: 1 },
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000),
    recordCount: 2348,
    destination: "/exports/product_catalog_20230512.xlsx",
  },
  {
    id: 2,
    name: "Marketplace Product Feed",
    type: "api",
    status: "pending",
    format: "json",
    filter: { status: "active" },
    createdAt: new Date(Date.now() - 5 * 60 * 1000),
    recordCount: 0,
    destination: "https://marketplace.example.com/api/products",
  },
  {
    id: 3,
    name: "Monthly Inventory Report",
    type: "file",
    status: "processing",
    format: "csv",
    filter: {},
    createdAt: new Date(Date.now() - 30 * 60 * 1000),
    recordCount: 5689,
    destination: "/exports/inventory_report.csv",
  },
];

const DataExports = () => {
  const [searchQuery, setSearchQuery] = useState("");
  
  // Filter exports based on search query
  const filteredExports = mockExports.filter(exportItem => 
    exportItem.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exportItem.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exportItem.format?.toLowerCase().includes(searchQuery.toLowerCase())
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

  const getFormatBadge = (format?: string) => {
    if (!format) return null;
    
    switch (format.toLowerCase()) {
      case "excel":
        return <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200">Excel</Badge>;
      case "csv":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200">CSV</Badge>;
      case "json":
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200">JSON</Badge>;
      default:
        return <Badge variant="outline">{format}</Badge>;
    }
  };

  const getTimeText = (date?: Date) => {
    if (!date) return "N/A";
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  return (
    <>
      <div className="pb-5 border-b border-neutral-200 sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Data Exports</h1>
        <div className="mt-3 sm:mt-0 sm:ml-4">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Export
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
            <Input 
              type="search" 
              placeholder="Search exports by name or format"
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
                      Name
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-6 text-neutral-500">
                      {searchQuery ? "No exports matching your search" : "No exports available"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredExports.map((exportItem) => (
                    <TableRow key={exportItem.id}>
                      <TableCell className="font-medium">{exportItem.name}</TableCell>
                      <TableCell className="capitalize">
                        <div className="flex items-center">
                          {exportItem.type === "file" ? (
                            <FileText className="h-4 w-4 mr-1 text-neutral-500" />
                          ) : (
                            <Settings className="h-4 w-4 mr-1 text-neutral-500" />
                          )}
                          {exportItem.type}
                        </div>
                      </TableCell>
                      <TableCell>{getFormatBadge(exportItem.format)}</TableCell>
                      <TableCell>{getStatusBadge(exportItem.status)}</TableCell>
                      <TableCell>
                        {exportItem.recordCount > 0 ? exportItem.recordCount.toLocaleString() : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Clock className="h-3 w-3 mr-1 text-neutral-400" />
                          {getTimeText(exportItem.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {exportItem.completedAt ? (
                          getTimeText(exportItem.completedAt)
                        ) : (
                          exportItem.status === 'processing' ? (
                            <div className="w-24 bg-neutral-200 rounded-full h-2.5">
                              <div 
                                className="bg-primary h-2.5 rounded-full" 
                                style={{ width: '60%' }}
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
                            {exportItem.status === 'success' && (
                              <DropdownMenuItem>
                                <Download className="mr-2 h-4 w-4" />
                                Download
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
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
    </>
  );
};

export default DataExports;