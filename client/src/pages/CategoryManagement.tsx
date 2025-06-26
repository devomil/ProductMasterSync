import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  FolderTree, 
  Package,
  Search,
  ChevronRight,
  Grid3X3,
  Plus
} from "lucide-react";

interface Category {
  id: number;
  name: string;
  code: string;
  parentId?: number;
  level: number;
  path?: string;
  productCount?: number;
  children?: Category[];
}

export default function CategoryManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<'hierarchy' | 'grid'>('hierarchy');

  // Fetch categories
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['/api/categories'],
  }) as { data: Category[], isLoading: boolean };

  // Build hierarchical category structure
  const buildCategoryTree = (categories: Category[]): Category[] => {
    const categoryMap = new Map<number, Category>();
    const rootCategories: Category[] = [];

    // Create a map of all categories
    categories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    // Build the tree structure
    categories.forEach(cat => {
      const category = categoryMap.get(cat.id)!;
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        const parent = categoryMap.get(cat.parentId)!;
        parent.children!.push(category);
      } else {
        rootCategories.push(category);
      }
    });

    return rootCategories;
  };

  const categoryTree = buildCategoryTree(categories);

  // Filter categories based on search
  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get total product count
  const totalProducts = categories.reduce((sum, cat) => sum + (cat.productCount || 0), 0);

  // Render a single category in hierarchy view
  const renderCategoryHierarchy = (category: Category, depth = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const paddingLeft = depth * 24;

    return (
      <div key={category.id} className="category-item">
        <div 
          className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
          style={{ paddingLeft: `${paddingLeft + 12}px` }}
        >
          <div className="flex items-center space-x-3">
            {hasChildren ? (
              <FolderTree className="h-4 w-4 text-blue-500" />
            ) : (
              <Package className="h-4 w-4 text-gray-400" />
            )}
            <div>
              <h3 className="font-medium text-gray-900">{category.name}</h3>
              <p className="text-sm text-gray-500">
                {category.productCount || 0} products
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">
              {category.code}
            </Badge>
            {hasChildren && (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </div>
        
        {hasChildren && (
          <div className="ml-4">
            {category.children!.map(child => 
              renderCategoryHierarchy(child, depth + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  // Render category in grid view
  const renderCategoryGrid = (category: Category) => (
    <Card key={category.id} className="category-card hover:shadow-lg transition-shadow cursor-pointer">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {category.level === 0 ? (
              <FolderTree className="h-5 w-5 text-blue-500" />
            ) : (
              <Package className="h-5 w-5 text-green-500" />
            )}
            <CardTitle className="text-lg">{category.name}</CardTitle>
          </div>
          <Badge variant={category.level === 0 ? "default" : "secondary"}>
            Level {category.level}
          </Badge>
        </div>
        <CardDescription className="text-sm">
          {category.path || category.name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <Package className="h-4 w-4 inline mr-1" />
            {category.productCount || 0} products
          </div>
          <Badge variant="outline" className="text-xs">
            {category.code}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading categories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-gray-600 mt-1">
            Manage your product categories and organization structure
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Categories</p>
                <p className="text-2xl font-bold">{categories.length}</p>
              </div>
              <FolderTree className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Parent Categories</p>
                <p className="text-2xl font-bold">
                  {categories.filter(c => c.level === 0).length}
                </p>
              </div>
              <FolderTree className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Subcategories</p>
                <p className="text-2xl font-bold">
                  {categories.filter(c => c.level > 0).length}
                </p>
              </div>
              <Package className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Products</p>
                <p className="text-2xl font-bold">{totalProducts}</p>
              </div>
              <Grid3X3 className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === 'hierarchy' ? 'default' : 'outline'}
            onClick={() => setViewMode('hierarchy')}
            size="sm"
          >
            <FolderTree className="h-4 w-4 mr-2" />
            Hierarchy
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            onClick={() => setViewMode('grid')}
            size="sm"
          >
            <Grid3X3 className="h-4 w-4 mr-2" />
            Grid
          </Button>
        </div>
      </div>

      {/* Category Display */}
      {searchTerm ? (
        // Search Results
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
            <CardDescription>
              Found {filteredCategories.length} categories matching "{searchTerm}"
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredCategories.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No categories found matching your search.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCategories.map(category => (
                  <div key={category.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Package className="h-4 w-4 text-gray-400" />
                      <div>
                        <h3 className="font-medium">{category.name}</h3>
                        <p className="text-sm text-gray-500">{category.path}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{category.productCount || 0} products</Badge>
                      <Badge variant="secondary">{category.code}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'hierarchy' ? (
        // Hierarchy View
        <Card>
          <CardHeader>
            <CardTitle>Category Hierarchy</CardTitle>
            <CardDescription>
              Organized view of your category structure
            </CardDescription>
          </CardHeader>
          <CardContent>
            {categoryTree.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No categories found. Start by creating your first category.
              </div>
            ) : (
              <div className="space-y-1">
                {categoryTree.map(category => renderCategoryHierarchy(category))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        // Grid View
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {categories.map(category => renderCategoryGrid(category))}
        </div>
      )}
    </div>
  );
}