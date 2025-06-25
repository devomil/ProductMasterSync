import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Plus, Search, Building, Mail, Phone, Eye, Edit, Trash2, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SupplierForm } from "@/components/suppliers/SupplierForm";

export default function SuppliersSimple() {
  const [searchTerm, setSearchTerm] = useState("");

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const { toast } = useToast();

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ["/api/suppliers"],
  });

  const { data: statistics } = useQuery({
    queryKey: ["/api/statistics"],
  });

  // Edit supplier functionality
  const editSupplierMutation = useMutation({
    mutationFn: async (supplierData: any) => {
      const response = await fetch(`/api/suppliers/${supplierData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(supplierData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      setIsEditDialogOpen(false);
      setSelectedSupplier(null);
      toast({
        title: "Supplier Updated",
        description: "Supplier information has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update supplier",
        variant: "destructive",
      });
    },
  });

  const handleViewDetails = (supplierId: number) => {
    const supplier = (suppliers && Array.isArray(suppliers)) ? suppliers.find((s: any) => s.id === supplierId) : null;
    if (supplier) {
      setSelectedSupplier(supplier);
      toast({
        title: "Supplier Details",
        description: `Viewing details for ${supplier.name}`,
      });
    }
  };

  const handleDeleteSupplier = (supplierId: number) => {
    if (window.confirm("Are you sure you want to delete this supplier?")) {
      toast({
        title: "Delete Supplier",
        description: "Supplier deletion functionality will be implemented.",
      });
    }
  };

  const filteredSuppliers = (suppliers && Array.isArray(suppliers)) ? suppliers.filter((supplier: any) => 
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.contact_email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Supplier Management</h1>
          <p className="text-gray-600 mt-1">Manage your supplier relationships and data sources</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Supplier
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Search suppliers by name, contact, or location..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-6">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                    <div className="h-3 bg-gray-200 rounded w-4/6"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !suppliers || suppliers.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No suppliers found</h3>
              <p className="text-gray-600 mb-4">
                Start building your supplier network by adding your first supplier.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Supplier
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredSuppliers.map((supplier: any) => (
              <Card key={supplier.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <Building className="h-5 w-5 mr-2 text-blue-600" />
                    {supplier.name}
                  </CardTitle>
                  <div className="space-y-1 text-sm text-gray-600">
                    {supplier.contact_email && (
                      <div className="flex items-center">
                        <Mail className="h-3 w-3 mr-1" />
                        {supplier.contact_email}
                      </div>
                    )}
                    {supplier.contact_phone && (
                      <div className="flex items-center">
                        <Phone className="h-3 w-3 mr-1" />
                        {supplier.contact_phone}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Status:</span> 
                      <span className={`ml-1 px-2 py-1 rounded-full text-xs ${
                        supplier.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {supplier.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {supplier.code && (
                      <div><span className="font-medium">Code:</span> {supplier.code}</div>
                    )}
                    {supplier.contact_name && (
                      <div><span className="font-medium">Contact:</span> {supplier.contact_name}</div>
                    )}
                    <div className="pt-2 flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 gap-1"
                        onClick={() => handleViewDetails(supplier.id)}
                      >
                        <Eye className="h-3 w-3" />
                        View Details
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" className="flex-1 gap-1">
                            <Building className="h-3 w-3" />
                            Manage
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedSupplier(supplier);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Supplier
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
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Supplier Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <Button variant="outline" className="justify-start" onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Onboard New Supplier
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => window.location.href = '/suppliers-advanced'}>
                <Building className="h-4 w-4 mr-2" />
                Advanced Management
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => window.location.href = '/data-sources'}>
                <Search className="h-4 w-4 mr-2" />
                Data Sources
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Supplier Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Active Suppliers:</span>
                <span className="font-medium">{(statistics as any)?.activeSuppliers || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Pending Approval:</span>
                <span className="font-medium">{(statistics as any)?.pendingApprovals || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Products:</span>
                <span className="font-medium">{(statistics as any)?.totalProducts || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">This Month:</span>
                <span className="font-medium">{(statistics as any)?.successfulImports30d || 0} imports</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Supplier Dialog */}
      <SupplierForm
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
      />

      {/* Edit Supplier Dialog */}
      <SupplierForm
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setSelectedSupplier(null);
        }}
        supplier={selectedSupplier}
      />
    </div>
  );
}