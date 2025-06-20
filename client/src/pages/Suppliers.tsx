import { useState } from "react";
import { 
  Building2, 
  Plus, 
  Search, 
  Filter, 
  RefreshCcw,
  ArrowUpDown,
  MoreHorizontal,
  Edit,
  Trash2,
  Mail,
  Phone,
  Eye,
  Settings,
  Download,
  TestTube,
  Play
} from "lucide-react";
import { useSuppliers } from "@/hooks/useSuppliers";
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
import { SupplierForm } from "@/components/suppliers/SupplierForm";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Supplier } from "@shared/schema";

const Suppliers = () => {
  const { suppliers, isLoading, refetch } = useSuppliers();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | undefined>(undefined);
  const [testPullResults, setTestPullResults] = useState<any>(null);
  const [isTestPullOpen, setIsTestPullOpen] = useState(false);
  const [testingSupplier, setTestingSupplier] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Delete supplier mutation
  const deleteMutation = useMutation({
    mutationFn: async (supplierId: number) => {
      const response = await fetch(`/api/suppliers/${supplierId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete supplier");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({
        title: "Supplier deleted",
        description: "The supplier has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete supplier: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleDeleteSupplier = (supplierId: number) => {
    if (window.confirm("Are you sure you want to delete this supplier?")) {
      deleteMutation.mutate(supplierId);
    }
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsEditDialogOpen(true);
  };

  // Test pull mutation
  const testPullMutation = useMutation({
    mutationFn: async (supplierId: number) => {
      const response = await apiRequest(`/api/suppliers/${supplierId}/test-pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10 })
      });
      return response;
    },
    onSuccess: (data, supplierId) => {
      setTestPullResults(data);
      setIsTestPullOpen(true);
      setTestingSupplier(null);
      toast({
        title: "Test Pull Complete",
        description: data.success ? `Retrieved ${data.sample_data?.length || 0} sample records` : "Test pull failed",
        variant: data.success ? "default" : "destructive"
      });
    },
    onError: (error) => {
      setTestingSupplier(null);
      toast({
        title: "Test Pull Failed",
        description: `Failed to test data pull: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const handleTestPull = (supplierId: number) => {
    setTestingSupplier(supplierId);
    testPullMutation.mutate(supplierId);
  };

  const handleViewDetails = (supplier: Supplier) => {
    // Navigate to supplier details page or open modal
    window.location.href = `/suppliers/${supplier.id}/details`;
  };

  const filteredSuppliers = suppliers.filter(supplier => 
    supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    supplier.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="pb-5 border-b border-neutral-200 sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Suppliers</h1>
        <div className="mt-3 sm:mt-0 sm:ml-4">
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Supplier
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
            <Input 
              type="search" 
              placeholder="Search suppliers by name or code"
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
                  <TableHead>Code</TableHead>
                  <TableHead>Contact Name</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredSuppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-neutral-500">
                      {searchQuery ? "No suppliers matching your search" : "No suppliers available"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">{supplier.name}</TableCell>
                      <TableCell>{supplier.code}</TableCell>
                      <TableCell>{supplier.contactName || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col space-y-1">
                          {supplier.contactEmail && (
                            <div className="flex items-center text-sm">
                              <Mail className="h-3 w-3 mr-1 text-neutral-400" />
                              <span>{supplier.contactEmail}</span>
                            </div>
                          )}
                          {supplier.contactPhone && (
                            <div className="flex items-center text-sm">
                              <Phone className="h-3 w-3 mr-1 text-neutral-400" />
                              <span>{supplier.contactPhone}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={supplier.active ? "success" : "secondary"}>
                          {supplier.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditSupplier(supplier)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Building2 className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => handleDeleteSupplier(supplier.id)}
                            >
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

      {/* Create Supplier Form */}
      <SupplierForm
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={() => {
          setIsCreateDialogOpen(false);
          refetch();
        }}
      />

      {/* Edit Supplier Form */}
      <SupplierForm
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={() => {
          setIsEditDialogOpen(false);
          setSelectedSupplier(undefined);
          refetch();
        }}
        supplier={selectedSupplier}
      />

      {/* Test Pull Results Dialog */}
      {isTestPullOpen && testPullResults && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                Test Pull Results - {testPullResults.success ? 'Success' : 'Failed'}
              </h2>
              <Button 
                variant="ghost" 
                onClick={() => setIsTestPullOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded">
                <p className="font-medium">Message:</p>
                <p className="text-sm text-gray-600">{testPullResults.message}</p>
              </div>
              
              {testPullResults.sample_data && testPullResults.sample_data.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Sample Data ({testPullResults.sample_data.length} records):</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {Object.keys(testPullResults.sample_data[0] || {}).slice(0, 6).map((key) => (
                            <th key={key} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {testPullResults.sample_data.slice(0, 5).map((row: any, index: number) => (
                          <tr key={index} className="border-b">
                            {Object.keys(row).slice(0, 6).map((key) => (
                              <td key={key} className="px-3 py-2 text-sm text-gray-900 border-r">
                                {String(row[key]).substring(0, 50)}
                                {String(row[key]).length > 50 ? '...' : ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {testPullResults.error_details && (
                <div className="p-3 bg-red-50 rounded">
                  <p className="font-medium text-red-800">Error Details:</p>
                  <pre className="text-sm text-red-600 mt-1 whitespace-pre-wrap">
                    {JSON.stringify(testPullResults.error_details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Suppliers;