import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  Edit, 
  Trash2, 
  FolderTree, 
  Settings,
  ArrowRight,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Search
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Category {
  id: number;
  name: string;
  code: string;
  parentId?: number;
  level: number;
  path?: string;
  attributes?: any;
  productCount?: number;
  children?: Category[];
}

interface SupplierCategoryMapping {
  id: number;
  supplierId: number;
  supplierName: string;
  supplierCategoryName: string;
  masterCategoryId: number;
  masterCategoryName: string;
  confidence: number;
  isApproved: boolean;
  productCount: number;
}

export default function CategoryManagement() {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState({
    name: "",
    code: "",
    parentId: null as number | null
  });
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['/api/categories'],
  }) as { data: Category[], isLoading: boolean };

  // Fetch supplier category mappings
  const { data: mappings = [], isLoading: mappingsLoading } = useQuery({
    queryKey: ['/api/categories/mappings'],
  }) as { data: SupplierCategoryMapping[], isLoading: boolean };

  // Fetch unmapped supplier categories
  const { data: unmappedCategories = [] } = useQuery({
    queryKey: ['/api/categories/unmapped'],
  }) as { data: any[] };

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (categoryData: any) => {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryData)
      });
      if (!response.ok) throw new Error('Failed to create category');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setCreateDialogOpen(false);
      setNewCategory({ name: "", code: "", parentId: null });
      toast({ title: "Category created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create category", variant: "destructive" });
    }
  });

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update category');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setEditDialogOpen(false);
      toast({ title: "Category updated successfully" });
    }
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete category');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: "Category deleted successfully" });
    }
  });

  // Create mapping mutation
  const createMappingMutation = useMutation({
    mutationFn: async (mappingData: any) => {
      const response = await fetch('/api/categories/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mappingData)
      });
      if (!response.ok) throw new Error('Failed to create mapping');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories/mappings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/categories/unmapped'] });
      toast({ title: "Category mapping created successfully" });
    }
  });

  // Build hierarchical category tree
  const buildCategoryTree = (cats: Category[]): Category[] => {
    const categoryMap = new Map<number, Category>();
    const roots: Category[] = [];

    // Create map of all categories
    cats.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    // Build tree structure
    cats.forEach(cat => {
      const category = categoryMap.get(cat.id)!;
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        const parent = categoryMap.get(cat.parentId)!;
        parent.children!.push(category);
      } else {
        roots.push(category);
      }
    });

    return roots;
  };

  const categoryTree = buildCategoryTree(categories);

  // Filter categories based on search
  const filteredCategories = categories.filter(cat => 
    cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Render category tree
  const renderCategoryTree = (cats: Category[], level = 0) => {
    return cats.map(category => (
      <div key={category.id} className={`ml-${level * 4}`}>
        <div className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded border-l-2 border-transparent hover:border-blue-500">
          <div className="flex items-center gap-2">
            <FolderTree className="h-4 w-4 text-gray-500" />
            <span className="font-medium">{category.name}</span>
            <Badge variant="outline" className="text-xs">{category.code}</Badge>
            {category.productCount && (
              <Badge variant="secondary" className="text-xs">
                {category.productCount} products
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedCategory(category);
                setEditDialogOpen(true);
              }}
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteCategoryMutation.mutate(category.id)}
              disabled={category.productCount && category.productCount > 0}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {category.children && category.children.length > 0 && (
          <div className="ml-4">
            {renderCategoryTree(category.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  const handleCreateCategory = () => {
    createCategoryMutation.mutate(newCategory);
  };

  const handleUpdateCategory = () => {
    if (selectedCategory) {
      updateCategoryMutation.mutate(selectedCategory);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Category Management</h1>
          <p className="text-gray-600 mt-1">
            Manage product categories and supplier category mappings
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Category</DialogTitle>
                <DialogDescription>
                  Add a new category to organize your products
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Category Name</Label>
                  <Input
                    id="name"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                    placeholder="e.g., Marine Electronics"
                  />
                </div>
                <div>
                  <Label htmlFor="code">Category Code</Label>
                  <Input
                    id="code"
                    value={newCategory.code}
                    onChange={(e) => setNewCategory({...newCategory, code: e.target.value})}
                    placeholder="e.g., MAR_ELEC"
                  />
                </div>
                <div>
                  <Label htmlFor="parent">Parent Category</Label>
                  <Select
                    value={newCategory.parentId?.toString() || ""}
                    onValueChange={(value) => setNewCategory({
                      ...newCategory, 
                      parentId: value ? parseInt(value) : null
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent category (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No Parent (Root Category)</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  onClick={handleCreateCategory}
                  disabled={createCategoryMutation.isPending}
                >
                  Create Category
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Button variant="outline" onClick={() => setMappingDialogOpen(true)}>
            <MapPin className="h-4 w-4 mr-2" />
            Manage Mappings
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Tree */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderTree className="h-5 w-5" />
              Master Categories
            </CardTitle>
            <CardDescription>
              Hierarchical category structure for your product catalog
            </CardDescription>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </CardHeader>
          <CardContent>
            {categoriesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-8 bg-gray-200 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {searchTerm ? (
                  filteredCategories.map(category => (
                    <div key={category.id} className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <FolderTree className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">{category.name}</span>
                        <Badge variant="outline" className="text-xs">{category.code}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedCategory(category);
                            setEditDialogOpen(true);
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  renderCategoryTree(categoryTree)
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Supplier Category Mappings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Supplier Mappings
            </CardTitle>
            <CardDescription>
              How supplier categories map to master categories
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mappingsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {mappings.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No category mappings found</p>
                    <p className="text-sm">Set up mappings to organize supplier categories</p>
                  </div>
                ) : (
                  mappings.map(mapping => (
                    <div key={mapping.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{mapping.supplierName}</Badge>
                          {mapping.isApproved ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {mapping.productCount} products
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600">{mapping.supplierCategoryName}</span>
                        <ArrowRight className="h-3 w-3 text-gray-400" />
                        <span className="font-medium">{mapping.masterCategoryName}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          Confidence: {mapping.confidence}%
                        </span>
                        {!mapping.isApproved && (
                          <Button size="sm" variant="outline">
                            Review
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Unmapped Categories Alert */}
      {unmappedCategories.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="h-5 w-5" />
              Unmapped Supplier Categories
            </CardTitle>
            <CardDescription className="text-orange-700">
              {unmappedCategories.length} supplier categories need mapping to master categories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {unmappedCategories.slice(0, 6).map((cat, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                  <div>
                    <span className="font-medium text-sm">{cat.categoryName}</span>
                    <div className="text-xs text-gray-500">
                      {cat.supplierName} • {cat.productCount} products
                    </div>
                  </div>
                  <Button size="sm" variant="outline">
                    Map
                  </Button>
                </div>
              ))}
            </div>
            {unmappedCategories.length > 6 && (
              <div className="mt-3 text-center">
                <Button variant="outline" onClick={() => setMappingDialogOpen(true)}>
                  View All {unmappedCategories.length} Unmapped Categories
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Category Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Update category details
            </DialogDescription>
          </DialogHeader>
          {selectedCategory && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Category Name</Label>
                <Input
                  id="edit-name"
                  value={selectedCategory.name}
                  onChange={(e) => setSelectedCategory({
                    ...selectedCategory, 
                    name: e.target.value
                  })}
                />
              </div>
              <div>
                <Label htmlFor="edit-code">Category Code</Label>
                <Input
                  id="edit-code"
                  value={selectedCategory.code}
                  onChange={(e) => setSelectedCategory({
                    ...selectedCategory, 
                    code: e.target.value
                  })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleUpdateCategory}>
              Update Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}