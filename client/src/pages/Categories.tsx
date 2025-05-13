import { useState } from "react";
import { 
  FolderPlus, 
  Plus, 
  Search, 
  Filter, 
  FolderTree,
  Edit,
  Trash2,
  MoreHorizontal,
  ChevronRight,
  FolderOpen,
  ArrowUpDown
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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { Category } from "@shared/schema";

// Component to display the category tree
const CategoryTree = () => {
  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  const getCategoryChildren = (parentId: number | null) => {
    return categories.filter(cat => 
      parentId === null ? cat.parentId === undefined || cat.parentId === null : cat.parentId === parentId
    );
  };

  // Root level categories
  const rootCategories = getCategoryChildren(null);

  const renderCategoryNode = (category: Category) => {
    const children = getCategoryChildren(category.id);
    const hasChildren = children.length > 0;

    return (
      <div key={category.id} className="mb-2">
        <div className="flex items-center">
          <div className="mr-2">
            {hasChildren ? (
              <FolderOpen className="h-4 w-4 text-amber-500" />
            ) : (
              <FolderTree className="h-4 w-4 text-neutral-400" />
            )}
          </div>
          <span className="text-sm font-medium">{category.name}</span>
          {category.code && (
            <span className="ml-2 text-xs text-neutral-500">({category.code})</span>
          )}
        </div>
        {hasChildren && (
          <div className="pl-6 mt-2 border-l border-neutral-200">
            {children.map(child => renderCategoryNode(child))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-6 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-2">
      {rootCategories.length === 0 ? (
        <div className="text-center py-6 text-neutral-500">
          No categories available
        </div>
      ) : (
        rootCategories.map(category => renderCategoryNode(category))
      )}
    </div>
  );
};

// Component to display the category attributes
const CategoryAttributes = ({ selectedCategory }: { selectedCategory?: Category }) => {
  if (!selectedCategory || !selectedCategory.attributes) {
    return (
      <div className="text-center py-6 text-neutral-500">
        Select a category to view attributes
      </div>
    );
  }

  const attributes = selectedCategory.attributes as Record<string, any>;
  const attributeKeys = Object.keys(attributes);

  if (attributeKeys.length === 0) {
    return (
      <div className="text-center py-6 text-neutral-500">
        No attributes defined for this category
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {attributeKeys.map(key => (
        <div key={key} className="flex justify-between border-b pb-2">
          <div className="font-medium text-sm">{key}</div>
          <div className="text-sm text-neutral-600">{attributes[key]?.type || 'Text'}</div>
        </div>
      ))}
    </div>
  );
};

// Main Categories component
const Categories = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("list");
  const [selectedCategory, setSelectedCategory] = useState<Category | undefined>(undefined);

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  const filteredCategories = categories.filter(category => 
    category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (category.code && category.code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <>
      <div className="pb-5 border-b border-neutral-200 sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Categories</h1>
        <div className="mt-3 sm:mt-0 sm:ml-4">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <Tabs defaultValue="list" onValueChange={setSelectedTab}>
          <div className="flex justify-between items-center">
            <TabsList>
              <TabsTrigger value="list">List View</TabsTrigger>
              <TabsTrigger value="tree">Tree View</TabsTrigger>
            </TabsList>

            <div className="flex space-x-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
                <Input 
                  type="search" 
                  placeholder="Search categories"
                  className="pl-9 w-64" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Filter
              </Button>
            </div>
          </div>

          <TabsContent value="list" className="mt-6">
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
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
                      <TableHead>Level</TableHead>
                      <TableHead>Path</TableHead>
                      <TableHead>Attributes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, index) => (
                        <TableRow key={index}>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : filteredCategories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-neutral-500">
                          {searchQuery ? "No categories matching your search" : "No categories available"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCategories.map((category) => (
                        <TableRow key={category.id}>
                          <TableCell className="font-medium">{category.name}</TableCell>
                          <TableCell>{category.code}</TableCell>
                          <TableCell>{category.level}</TableCell>
                          <TableCell>{category.path}</TableCell>
                          <TableCell>
                            {category.attributes && Object.keys(category.attributes as Record<string, any>).length > 0 ? (
                              <Badge variant="secondary">
                                {Object.keys(category.attributes as Record<string, any>).length} attributes
                              </Badge>
                            ) : (
                              <span className="text-neutral-400 text-sm">None</span>
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
                                <DropdownMenuItem onClick={() => setSelectedCategory(category)}>
                                  <FolderOpen className="mr-2 h-4 w-4" />
                                  View Attributes
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Category
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <FolderPlus className="mr-2 h-4 w-4" />
                                  Add Subcategory
                                </DropdownMenuItem>
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
          </TabsContent>

          <TabsContent value="tree" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Category Hierarchy</CardTitle>
                  <CardDescription>
                    Hierarchical view of your category structure
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CategoryTree />
                </CardContent>
              </Card>

              <Card className="col-span-1 md:col-span-2">
                <CardHeader>
                  <CardTitle>Category Attributes</CardTitle>
                  <CardDescription>
                    Attributes defined for the selected category
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CategoryAttributes selectedCategory={selectedCategory} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default Categories;
