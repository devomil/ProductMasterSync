import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Edit, 
  Trash2, 
  Plus, 
  Search, 
  FileText, 
  MapPin, 
  CheckCircle,
  Clock,
  Filter
} from 'lucide-react';

interface MappingTemplate {
  id: number;
  name: string;
  sourceType: string;
  mappings: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  dataSourceId?: number;
  fieldMappingsCount?: number;
}

interface FieldMapping {
  sourceField: string;
  targetField: string;
  category: string;
}

export default function MappingTemplates() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [editingTemplate, setEditingTemplate] = useState<MappingTemplate | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editedMappings, setEditedMappings] = useState<FieldMapping[]>([]);

  // Fetch mapping templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['/api/mapping-templates'],
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/mapping-templates/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete template');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mapping-templates'] });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/mapping-templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update template');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mapping-templates'] });
      setIsEditDialogOpen(false);
      setEditingTemplate(null);
    },
  });

  // Filter templates
  const filteredTemplates = (templates as MappingTemplate[]).filter((template: MappingTemplate) => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.sourceType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || template.sourceType === filterType;
    return matchesSearch && matchesFilter;
  });

  // Get unique source types for filter
  const sourceTypes = Array.from(new Set((templates as MappingTemplate[]).map((t: MappingTemplate) => t.sourceType)));

  const handleEdit = (template: MappingTemplate) => {
    setEditingTemplate(template);
    // Convert mappings object to array format
    // Note: mappings are stored as {targetField: sourceField} in the database
    const mappingsArray = Object.entries(template.mappings || {}).map(([targetField, sourceField]) => ({
      sourceField,
      targetField,
      category: getCategoryForField(targetField)
    }));
    setEditedMappings(mappingsArray);
    setIsEditDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this mapping template?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSave = () => {
    if (!editingTemplate) return;
    
    // Convert array back to object format
    // Note: We store mappings as {targetField: sourceField} in the database
    const mappingsObject = editedMappings.reduce((acc, mapping) => {
      acc[mapping.targetField] = mapping.sourceField;
      return acc;
    }, {} as Record<string, string>);

    updateMutation.mutate({
      id: editingTemplate.id,
      data: {
        name: editingTemplate.name,
        mappings: mappingsObject
      }
    });
  };

  const getCategoryForField = (fieldName: string): string => {
    // Basic categorization logic
    if (['sku', 'usin', 'upc', 'mpn'].includes(fieldName)) return 'identification';
    if (['name', 'description', 'category'].includes(fieldName)) return 'information';
    if (['price', 'cost', 'map_price'].includes(fieldName)) return 'pricing';
    if (['weight', 'dimensions'].includes(fieldName)) return 'shipping';
    if (['primary_image', 'image_url'].includes(fieldName)) return 'media';
    return 'other';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mapping Templates</h1>
          <p className="text-gray-600 mt-2">
            Manage your field mapping templates for data source imports
          </p>
        </div>
        <Button onClick={() => window.location.href = '/data-sources'}>
          <Plus className="h-4 w-4 mr-2" />
          Create New Template
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search templates by name or source type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {sourceTypes.map((type: string) => (
              <SelectItem key={type} value={type}>
                {type.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No Mapping Templates Found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || filterType !== 'all' 
                ? 'No templates match your search criteria.' 
                : 'Create your first mapping template by setting up a data source.'}
            </p>
            <Button onClick={() => window.location.href = '/data-sources'}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template: MappingTemplate) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <Badge variant="secondary" className="mt-2">
                      {template.sourceType.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(template)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(template.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span>{Object.keys(template.mappings || {}).length} field mappings</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>Updated {formatDate(template.updatedAt)}</span>
                  </div>
                  {template.dataSourceId && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span>Active Data Source</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Mapping Template: {editingTemplate?.name}</DialogTitle>
          </DialogHeader>
          
          {editingTemplate && (
            <div className="space-y-6">
              <Alert>
                <AlertDescription>
                  Editing field mappings will affect future data imports using this template.
                  Changes won't affect previously imported data.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Field Mappings ({editedMappings.length})</h3>
                
                <div className="grid gap-4">
                  {editedMappings.map((mapping, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                      <div className="flex-1">
                        <label className="text-sm font-medium text-gray-700">Source Field</label>
                        <Input
                          value={mapping.sourceField}
                          onChange={(e) => {
                            const updated = [...editedMappings];
                            updated[index].sourceField = e.target.value;
                            setEditedMappings(updated);
                          }}
                          className="mt-1"
                          placeholder="CSV column name"
                        />
                      </div>
                      <div className="text-gray-400">→</div>
                      <div className="flex-1">
                        <label className="text-sm font-medium text-gray-700">Target Field</label>
                        <Input
                          value={mapping.targetField}
                          onChange={(e) => {
                            const updated = [...editedMappings];
                            updated[index].targetField = e.target.value;
                            setEditedMappings(updated);
                          }}
                          className="mt-1"
                          placeholder="Database field name"
                          readOnly
                          title="Target field is read-only. Use the full editor to change target fields."
                        />
                      </div>
                      <Badge variant="outline">
                        {mapping.category}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const updated = editedMappings.filter((_, i) => i !== index);
                          setEditedMappings(updated);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  onClick={() => {
                    setEditedMappings([...editedMappings, {
                      sourceField: '',
                      targetField: '',
                      category: 'other'
                    }]);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Field Mapping
                </Button>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}