import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Edit, Plus, Code, List, X, Check } from "lucide-react";
import type { MappingTemplate } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function MappingTemplates() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MappingTemplate | null>(null);
  
  const { data: mappingTemplates = [], isLoading, error } = useQuery({
    queryKey: ['/api/mapping-templates'],
    refetchOnWindowFocus: false
  });
  
  const { data: dataSources = [] } = useQuery({
    queryKey: ['/api/data-sources'],
    refetchOnWindowFocus: false
  });
  
  const handleCreateTemplate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const sourceType = formData.get('sourceType') as string;
    const mappingsJson = formData.get('mappings') as string;
    const transformationsJson = formData.get('transformations') as string || "[]";
    const validationRulesJson = formData.get('validationRules') as string || "[]";
    
    let mappings, transformations, validationRules;
    
    try {
      mappings = JSON.parse(mappingsJson);
      transformations = JSON.parse(transformationsJson);
      validationRules = JSON.parse(validationRulesJson);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Invalid JSON",
        description: "Please check your JSON formatting"
      });
      return;
    }
    
    try {
      const mappingTemplate = await apiRequest('/api/mapping-templates', 'POST', { 
        name, 
        description, 
        sourceType, 
        mappings,
        transformations,
        validationRules
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/mapping-templates'] });
      
      setIsCreateDialogOpen(false);
      
      toast({
        title: "Mapping Template Created",
        description: `${name} was successfully created`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to create mapping template: ${(error as Error).message}`
      });
    }
  };
  
  const handleEditTemplate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!selectedTemplate) return;
    
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const mappingsJson = formData.get('mappings') as string;
    const transformationsJson = formData.get('transformations') as string || "[]";
    const validationRulesJson = formData.get('validationRules') as string || "[]";
    
    let mappings, transformations, validationRules;
    
    try {
      mappings = JSON.parse(mappingsJson);
      transformations = JSON.parse(transformationsJson);
      validationRules = JSON.parse(validationRulesJson);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Invalid JSON",
        description: "Please check your JSON formatting"
      });
      return;
    }
    
    try {
      const mappingTemplate = await apiRequest(`/api/mapping-templates/${selectedTemplate.id}`, 'PUT', { 
        name, 
        description, 
        mappings,
        transformations,
        validationRules
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/mapping-templates'] });
      
      setIsEditDialogOpen(false);
      setSelectedTemplate(null);
      
      toast({
        title: "Mapping Template Updated",
        description: `${name} was successfully updated`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to update mapping template: ${(error as Error).message}`
      });
    }
  };
  
  const handleDeleteTemplate = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this mapping template? This action cannot be undone.")) {
      return;
    }
    
    try {
      await apiRequest(`/api/mapping-templates/${id}`, 'DELETE');
      
      queryClient.invalidateQueries({ queryKey: ['/api/mapping-templates'] });
      
      toast({
        title: "Mapping Template Deleted",
        description: "The mapping template was successfully deleted"
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to delete mapping template: ${(error as Error).message}`
      });
    }
  };
  
  const handleEditClick = (template: MappingTemplate) => {
    setSelectedTemplate(template);
    setIsEditDialogOpen(true);
  };
  
  const getSourceTypeName = (type: string) => {
    switch (type) {
      case "csv": return "CSV File";
      case "excel": return "Excel File";
      case "json": return "JSON File";
      case "xml": return "XML File";
      case "api": return "API Integration";
      case "sftp": return "SFTP Connection";
      case "ftp": return "FTP Connection";
      case "edi_x12": return "EDI X12";
      case "edifact": return "EDIFACT";
      case "manual": return "Manual Upload";
      default: return type.toUpperCase();
    }
  };
  
  if (isLoading) {
    return <div className="flex justify-center items-center h-full">Loading mapping templates...</div>;
  }
  
  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load mapping templates: {(error as Error).message}</AlertDescription>
      </Alert>
    );
  }
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Mapping Templates</h1>
          <p className="text-gray-500">Define how to map external data sources to your product schema</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>
      
      <div className="space-y-4">
        {mappingTemplates.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-gray-500">
              No mapping templates found. Click "Create Template" to create one.
            </CardContent>
          </Card>
        ) : (
          mappingTemplates.map((template: MappingTemplate) => (
            <Card key={template.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center">
                      <FileText className="h-4 w-4 mr-2" />
                      {template.name}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {template.description}
                    </CardDescription>
                  </div>
                  <div className="flex items-center">
                    <Badge className="mr-2">
                      {getSourceTypeName(template.sourceType)}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => handleEditClick(template)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Field Mappings</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Source Field</TableHead>
                          <TableHead>Destination Field</TableHead>
                          <TableHead className="w-[100px]">Required</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {template.mappings.slice(0, 5).map((mapping: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono">{mapping.sourceField}</TableCell>
                            <TableCell>{mapping.destinationField}</TableCell>
                            <TableCell>
                              {mapping.required ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <X className="h-4 w-4 text-gray-300" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        {template.mappings.length > 5 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-gray-500">
                              +{template.mappings.length - 5} more fields
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {template.transformations && template.transformations.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Transformations</h4>
                      <div className="flex flex-wrap gap-2">
                        {template.transformations.map((transform: any, i: number) => (
                          <Badge key={i} variant="outline" className="flex items-center">
                            <Code className="h-3 w-3 mr-1" />
                            {transform.type}: {transform.sourceField}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {template.validationRules && template.validationRules.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Validation Rules</h4>
                      <div className="flex flex-wrap gap-2">
                        {template.validationRules.map((rule: any, i: number) => (
                          <Badge key={i} variant="outline" className="flex items-center">
                            <List className="h-3 w-3 mr-1" />
                            {rule.field}: {rule.type}
                            {rule.severity && (
                              <span className={rule.severity === 'error' ? 'text-red-500 ml-1' : 'text-yellow-500 ml-1'}>
                                ({rule.severity})
                              </span>
                            )}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      
      {/* Create Mapping Template Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create Mapping Template</DialogTitle>
            <DialogDescription>
              Define how external data should map to your product schema.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleCreateTemplate}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" name="name" className="col-span-3" required />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">Description</Label>
                <Input id="description" name="description" className="col-span-3" />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="sourceType" className="text-right">Source Type</Label>
                <Select name="sourceType" required defaultValue="csv">
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select source type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV File</SelectItem>
                    <SelectItem value="excel">Excel File</SelectItem>
                    <SelectItem value="json">JSON File</SelectItem>
                    <SelectItem value="xml">XML File</SelectItem>
                    <SelectItem value="api">API Integration</SelectItem>
                    <SelectItem value="sftp">SFTP Connection</SelectItem>
                    <SelectItem value="ftp">FTP Connection</SelectItem>
                    <SelectItem value="edi_x12">EDI X12</SelectItem>
                    <SelectItem value="edifact">EDIFACT</SelectItem>
                    <SelectItem value="manual">Manual Upload</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="mappings" className="text-right align-top mt-2">
                  Field Mappings
                  <p className="text-xs text-gray-500 font-normal mt-1">Required</p>
                </Label>
                <Textarea 
                  id="mappings" 
                  name="mappings" 
                  className="col-span-3 font-mono" 
                  rows={6}
                  placeholder={`[
  { "sourceField": "SKU", "destinationField": "sku", "required": true },
  { "sourceField": "PRODUCT_NAME", "destinationField": "name", "required": true },
  { "sourceField": "DESCRIPTION", "destinationField": "description" }
]`}
                  required 
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="transformations" className="text-right align-top mt-2">
                  Transformations
                  <p className="text-xs text-gray-500 font-normal mt-1">Optional</p>
                </Label>
                <Textarea 
                  id="transformations" 
                  name="transformations" 
                  className="col-span-3 font-mono" 
                  rows={4}
                  placeholder={`[
  { "type": "trim", "sourceField": "PRODUCT_NAME" },
  { "type": "numberFormat", "sourceField": "PRICE", "parameters": { "decimalPlaces": 2 } }
]`}
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="validationRules" className="text-right align-top mt-2">
                  Validation Rules
                  <p className="text-xs text-gray-500 font-normal mt-1">Optional</p>
                </Label>
                <Textarea 
                  id="validationRules" 
                  name="validationRules" 
                  className="col-span-3 font-mono" 
                  rows={4}
                  placeholder={`[
  { "field": "SKU", "type": "required", "errorMessage": "SKU is required", "severity": "error" },
  { "field": "PRICE", "type": "number", "errorMessage": "Price must be a number", "severity": "error" }
]`}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Template</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Edit Mapping Template Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Mapping Template</DialogTitle>
            <DialogDescription>
              Update mapping configuration.
            </DialogDescription>
          </DialogHeader>
          
          {selectedTemplate && (
            <form onSubmit={handleEditTemplate}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-name" className="text-right">Name</Label>
                  <Input 
                    id="edit-name" 
                    name="name" 
                    className="col-span-3" 
                    defaultValue={selectedTemplate.name}
                    required 
                  />
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-description" className="text-right">Description</Label>
                  <Input 
                    id="edit-description" 
                    name="description" 
                    className="col-span-3" 
                    defaultValue={selectedTemplate.description || ''}
                  />
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-sourceType" className="text-right">Source Type</Label>
                  <Input 
                    id="edit-sourceType" 
                    className="col-span-3" 
                    value={getSourceTypeName(selectedTemplate.sourceType)}
                    disabled
                  />
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-mappings" className="text-right align-top mt-2">
                    Field Mappings
                  </Label>
                  <Textarea 
                    id="edit-mappings" 
                    name="mappings" 
                    className="col-span-3 font-mono" 
                    rows={6}
                    defaultValue={JSON.stringify(selectedTemplate.mappings, null, 2)}
                    required 
                  />
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-transformations" className="text-right align-top mt-2">
                    Transformations
                  </Label>
                  <Textarea 
                    id="edit-transformations" 
                    name="transformations" 
                    className="col-span-3 font-mono" 
                    rows={4}
                    defaultValue={JSON.stringify(selectedTemplate.transformations || [], null, 2)}
                  />
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-validationRules" className="text-right align-top mt-2">
                    Validation Rules
                  </Label>
                  <Textarea 
                    id="edit-validationRules" 
                    name="validationRules" 
                    className="col-span-3 font-mono" 
                    rows={4}
                    defaultValue={JSON.stringify(selectedTemplate.validationRules || [], null, 2)}
                  />
                </div>
              </div>
              
              <DialogFooter className="flex justify-between">
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={() => handleDeleteTemplate(selectedTemplate.id)}
                >
                  Delete
                </Button>
                
                <div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsEditDialogOpen(false);
                      setSelectedTemplate(null);
                    }}
                    className="mr-2"
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Update</Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}