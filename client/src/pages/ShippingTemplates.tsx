import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Edit2, Trash2, Calculator, DollarSign, Package, Settings } from "lucide-react";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Shipping template form schema
const shippingTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  method: z.enum(["cost_based", "weight_based", "combined", "flat_rate", "free"]),
  description: z.string().optional(),
  isDefault: z.boolean().default(false),
  flatRate: z.number().optional(),
  freeShippingThreshold: z.number().optional(),
  oversizedSurcharge: z.number().default(0),
  hazmatSurcharge: z.number().default(0),
  costRules: z.array(z.object({
    minCost: z.number().min(0),
    maxCost: z.number().min(0),
    shippingCost: z.number().min(0)
  })).optional().default([]),
  weightRules: z.array(z.object({
    minWeight: z.number().min(0),
    maxWeight: z.number().min(0),
    shippingCost: z.number().min(0)
  })).optional().default([]),
});

type ShippingTemplateFormData = z.infer<typeof shippingTemplateSchema>;

interface ShippingTemplate {
  id: number;
  name: string;
  supplierId: number;
  method: string;
  isDefault: boolean;
  description?: string;
  costRules: Array<{ minCost: number; maxCost: number; shippingCost: number }>;
  weightRules: Array<{ minWeight: number; maxWeight: number; shippingCost: number }>;
  combinedRules: Array<{ minCost?: number; maxCost?: number; minWeight?: number; maxWeight?: number; shippingCost: number | string }>;
  flatRate?: number;
  freeShippingThreshold?: number;
  oversizedSurcharge: number;
  hazmatSurcharge: number;
  createdAt: string;
  updatedAt: string;
}

interface Supplier {
  id: number;
  name: string;
  status: string;
}

export default function ShippingTemplates() {
  const { toast } = useToast();
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ShippingTemplate | null>(null);
  const [calculatorData, setCalculatorData] = useState({
    cost: 0,
    weight: 0,
    isOversized: false,
    isHazmat: false
  });
  
  // Form state for cost and weight rules
  const [costRules, setCostRules] = useState([
    { minCost: 1, maxCost: 100, shippingCost: 15.99 },
    { minCost: 101, maxCost: 500, shippingCost: 9.99 },
    { minCost: 501, maxCost: 1500, shippingCost: 0 },
    { minCost: 1501, maxCost: 3000, shippingCost: 0 }
  ]);
  
  const [weightRules, setWeightRules] = useState([
    { minWeight: 1, maxWeight: 20, shippingCost: 15.99 },
    { minWeight: 21, maxWeight: 100, shippingCost: 49.99 }
  ]);

  const [combinedRules, setCombinedRules] = useState([
    { minCost: 1, maxCost: 100, minWeight: 1, maxWeight: 20, shippingCost: 15.99 },
    { minCost: 101, maxCost: 500, minWeight: 1, maxWeight: 50, shippingCost: 9.99 }
  ]);

  // Function to open edit dialog with template data
  const openEditDialog = (template: ShippingTemplate) => {
    setEditingTemplate(template);
    
    // Populate form with existing template data
    form.reset({
      name: template.name,
      method: template.method as any,
      description: template.description || "",
      isDefault: template.isDefault,
      oversizedSurcharge: template.oversizedSurcharge,
      hazmatSurcharge: template.hazmatSurcharge,
      flatRate: template.flatRate,
    });

    // Set the rules based on template method
    if (template.method === "cost_based" && template.costRules) {
      setCostRules(template.costRules);
    } else if (template.method === "weight_based" && template.weightRules) {
      setWeightRules(template.weightRules);
    }
    
    setIsEditDialogOpen(true);
  };

  const queryClient = useQueryClient();

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  // Fetch shipping templates for selected supplier
  const { data: templates = [], isLoading } = useQuery<ShippingTemplate[]>({
    queryKey: ["/api/suppliers", selectedSupplierId, "shipping-templates"],
    enabled: !!selectedSupplierId,
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (data: ShippingTemplateFormData) => {
      const response = await fetch(`/api/suppliers/${selectedSupplierId}/shipping-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create template");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers", selectedSupplierId, "shipping-templates"] });
      setIsCreateDialogOpen(false);
    },
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ShippingTemplateFormData> }) => {
      const response = await fetch(`/api/shipping-templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update template");
      return response.json();
    },
    onSuccess: (updatedTemplate) => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers", selectedSupplierId, "shipping-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setIsEditDialogOpen(false);
      setEditingTemplate(null);
      form.reset();
      
      // Show success toast
      toast({
        title: "Template Updated Successfully",
        description: `"${updatedTemplate.name}" has been updated and will now be used for shipping calculations throughout your catalog.`,
        duration: 5000,
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update shipping template. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/shipping-templates/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete template");
      return;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers", selectedSupplierId, "shipping-templates"] });
    },
  });

  // Calculate shipping mutation
  const calculateShippingMutation = useMutation({
    mutationFn: async (data: { cost: number; weight: number; isOversized: boolean; isHazmat: boolean }) => {
      const response = await fetch(`/api/suppliers/${selectedSupplierId}/calculate-shipping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to calculate shipping");
      return response.json();
    },
  });

  // Update product shipping costs mutation
  const updateProductShippingMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/suppliers/${selectedSupplierId}/update-product-shipping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to update product shipping costs");
      return response.json();
    },
    onSuccess: (data) => {
      alert(`Successfully updated shipping costs for ${data.updatedCount} products from this supplier!`);
    }
  });

  const form = useForm<ShippingTemplateFormData>({
    resolver: zodResolver(shippingTemplateSchema),
    defaultValues: {
      name: "",
      method: "cost_based",
      description: "",
      isDefault: false,
      oversizedSurcharge: 0,
      hazmatSurcharge: 0,
      costRules: costRules,
      weightRules: weightRules,
    },
  });

  // Update rules when method changes
  const selectedMethod = form.watch("method");

  // Helper functions for managing rules
  const addCostRule = () => {
    setCostRules([...costRules, { minCost: 0, maxCost: 0, shippingCost: 0 }]);
  };

  const removeCostRule = (index: number) => {
    setCostRules(costRules.filter((_, i) => i !== index));
  };

  const updateCostRule = (index: number, field: string, value: number) => {
    const updated = [...costRules];
    updated[index] = { ...updated[index], [field]: value };
    setCostRules(updated);
    form.setValue("costRules", updated);
  };

  const addWeightRule = () => {
    setWeightRules([...weightRules, { minWeight: 0, maxWeight: 0, shippingCost: 0 }]);
  };

  const removeWeightRule = (index: number) => {
    setWeightRules(weightRules.filter((_, i) => i !== index));
  };

  const updateWeightRule = (index: number, field: string, value: number) => {
    const updated = [...weightRules];
    updated[index] = { ...updated[index], [field]: value };
    setWeightRules(updated);
    form.setValue("weightRules", updated);
  };

  const onSubmit = (data: ShippingTemplateFormData) => {
    const templateData = {
      ...data,
      supplierId: selectedSupplierId!,
      costRules: selectedMethod === "cost_based" ? costRules : [],
      weightRules: selectedMethod === "weight_based" ? weightRules : [],
      combinedRules: selectedMethod === "combined" ? combinedRules : [],
    };

    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data: templateData });
    } else {
      createTemplateMutation.mutate(templateData);
    }
  };

  const handleCalculate = () => {
    if (selectedSupplierId) {
      calculateShippingMutation.mutate(calculatorData);
    }
  };

  const formatMethodName = (method: string) => {
    if (!method) return '';
    return method.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const renderRulesDisplay = (template: ShippingTemplate) => {
    if (template.method === "cost_based" && template.costRules?.length > 0) {
      return (
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Cost-Based Rules:</h4>
          {template.costRules.map((rule, index) => (
            <div key={index} className="text-sm bg-muted p-2 rounded">
              ${rule.minCost} - ${rule.maxCost}: ${rule.shippingCost} shipping
            </div>
          ))}
        </div>
      );
    }
    
    if (template.method === "combined" && template.combinedRules?.length > 0) {
      return (
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Combined Rules:</h4>
          {template.combinedRules.map((rule, index) => (
            <div key={index} className="text-sm bg-muted p-2 rounded">
              {rule.minCost && rule.maxCost && `$${rule.minCost}-${rule.maxCost}, `}
              {rule.minWeight && rule.maxWeight && `${rule.minWeight}-${rule.maxWeight}lbs`}
              {!rule.minWeight && rule.maxWeight && `${rule.maxWeight}lbs+`}
              : {typeof rule.shippingCost === 'string' ? rule.shippingCost : `$${rule.shippingCost}`}
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Shipping Templates</h1>
          <p className="text-muted-foreground">
            Manage shipping cost calculations for each supplier
          </p>
        </div>
      </div>

      <Tabs defaultValue="templates" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="calculator" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Calculator
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-6">
          {/* Supplier Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Supplier</CardTitle>
              <CardDescription>Choose a supplier to manage their shipping templates</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedSupplierId?.toString() || ""} onValueChange={(value) => setSelectedSupplierId(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a supplier..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id.toString()}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Templates List */}
          {selectedSupplierId && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Shipping Templates</CardTitle>
                    <CardDescription>Configure shipping cost calculations</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => updateProductShippingMutation.mutate()}
                      disabled={updateProductShippingMutation.isPending}
                      variant="outline"
                    >
                      {updateProductShippingMutation.isPending ? (
                        "Updating..."
                      ) : (
                        <>
                          <Package className="w-4 h-4 mr-2" />
                          Update Product Costs
                        </>
                      )}
                    </Button>
                  </div>
                  <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Template
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                        <DialogTitle>Create Shipping Template</DialogTitle>
                        <DialogDescription>
                          Configure how shipping costs are calculated for this supplier
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                          <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Template Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., Standard Shipping" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="method"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Calculation Method</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select calculation method" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="cost_based">Cost-Based</SelectItem>
                                    <SelectItem value="weight_based">Weight-Based</SelectItem>
                                    <SelectItem value="combined">Combined (Cost + Weight)</SelectItem>
                                    <SelectItem value="flat_rate">Flat Rate</SelectItem>
                                    <SelectItem value="free">Free Shipping</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormDescription>
                                  How shipping costs should be calculated
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Cost-Based Rules */}
                          {selectedMethod === "cost_based" && (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-base font-medium">Cost Value Rules</Label>
                                <Button type="button" onClick={addCostRule} variant="outline" size="sm">
                                  <Plus className="h-4 w-4 mr-1" />
                                  Add Rule
                                </Button>
                              </div>
                              <div className="space-y-3">
                                {costRules.map((rule, index) => (
                                  <div key={index} className="grid grid-cols-3 gap-3 items-end p-3 border rounded-lg">
                                    <div>
                                      <Label className="text-sm">Min Cost ($)</Label>
                                      <Input
                                        type="number"
                                        value={rule.minCost}
                                        onChange={(e) => updateCostRule(index, "minCost", parseFloat(e.target.value) || 0)}
                                        step="0.01"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-sm">Max Cost ($)</Label>
                                      <Input
                                        type="number"
                                        value={rule.maxCost}
                                        onChange={(e) => updateCostRule(index, "maxCost", parseFloat(e.target.value) || 0)}
                                        step="0.01"
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <div className="flex-1">
                                        <Label className="text-sm">Shipping Cost ($)</Label>
                                        <Input
                                          type="number"
                                          value={rule.shippingCost}
                                          onChange={(e) => updateCostRule(index, "shippingCost", parseFloat(e.target.value) || 0)}
                                          step="0.01"
                                        />
                                      </div>
                                      <Button
                                        type="button"
                                        onClick={() => removeCostRule(index)}
                                        variant="outline"
                                        size="sm"
                                        className="mt-6"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Weight-Based Rules */}
                          {selectedMethod === "weight_based" && (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-base font-medium">Weight Rules</Label>
                                <Button type="button" onClick={addWeightRule} variant="outline" size="sm">
                                  <Plus className="h-4 w-4 mr-1" />
                                  Add Rule
                                </Button>
                              </div>
                              <div className="space-y-3">
                                {weightRules.map((rule, index) => (
                                  <div key={index} className="grid grid-cols-3 gap-3 items-end p-3 border rounded-lg">
                                    <div>
                                      <Label className="text-sm">Min Weight (lbs)</Label>
                                      <Input
                                        type="number"
                                        value={rule.minWeight}
                                        onChange={(e) => updateWeightRule(index, "minWeight", parseFloat(e.target.value) || 0)}
                                        step="0.1"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-sm">Max Weight (lbs)</Label>
                                      <Input
                                        type="number"
                                        value={rule.maxWeight}
                                        onChange={(e) => updateWeightRule(index, "maxWeight", parseFloat(e.target.value) || 0)}
                                        step="0.1"
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <div className="flex-1">
                                        <Label className="text-sm">Shipping Cost ($)</Label>
                                        <Input
                                          type="number"
                                          value={rule.shippingCost}
                                          onChange={(e) => updateWeightRule(index, "shippingCost", parseFloat(e.target.value) || 0)}
                                          step="0.01"
                                        />
                                      </div>
                                      <Button
                                        type="button"
                                        onClick={() => removeWeightRule(index)}
                                        variant="outline"
                                        size="sm"
                                        className="mt-6"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Combined Rules (Cost + Weight) */}
                          {selectedMethod === "combined" && (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-base font-medium">Combined Rules (Cost + Weight)</Label>
                                <Button type="button" onClick={() => {
                                  const newRule = { minCost: 0, maxCost: 0, minWeight: 0, maxWeight: 0, shippingCost: 0 };
                                  const updated = [...combinedRules, newRule];
                                  setCombinedRules(updated);
                                  form.setValue("combinedRules", updated);
                                }} variant="outline" size="sm">
                                  <Plus className="h-4 w-4 mr-1" />
                                  Add Combined Rule
                                </Button>
                              </div>
                              <div className="space-y-3">
                                {combinedRules.map((rule, index) => (
                                  <div key={index} className="grid grid-cols-5 gap-3 items-end p-3 border rounded-lg">
                                    <div>
                                      <Label className="text-sm">Min Cost ($)</Label>
                                      <Input
                                        type="number"
                                        value={rule.minCost}
                                        onChange={(e) => {
                                          const updated = [...combinedRules];
                                          updated[index] = { ...updated[index], minCost: parseFloat(e.target.value) || 0 };
                                          setCombinedRules(updated);
                                          form.setValue("combinedRules", updated);
                                        }}
                                        step="0.01"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-sm">Max Cost ($)</Label>
                                      <Input
                                        type="number"
                                        value={rule.maxCost}
                                        onChange={(e) => {
                                          const updated = [...combinedRules];
                                          updated[index] = { ...updated[index], maxCost: parseFloat(e.target.value) || 0 };
                                          setCombinedRules(updated);
                                          form.setValue("combinedRules", updated);
                                        }}
                                        step="0.01"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-sm">Min Weight (lbs)</Label>
                                      <Input
                                        type="number"
                                        value={rule.minWeight}
                                        onChange={(e) => {
                                          const updated = [...combinedRules];
                                          updated[index] = { ...updated[index], minWeight: parseFloat(e.target.value) || 0 };
                                          setCombinedRules(updated);
                                          form.setValue("combinedRules", updated);
                                        }}
                                        step="0.1"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-sm">Max Weight (lbs)</Label>
                                      <Input
                                        type="number"
                                        value={rule.maxWeight}
                                        onChange={(e) => {
                                          const updated = [...combinedRules];
                                          updated[index] = { ...updated[index], maxWeight: parseFloat(e.target.value) || 0 };
                                          setCombinedRules(updated);
                                          form.setValue("combinedRules", updated);
                                        }}
                                        step="0.1"
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <div className="flex-1">
                                        <Label className="text-sm">Shipping Cost ($)</Label>
                                        <Input
                                          type="number"
                                          value={rule.shippingCost}
                                          onChange={(e) => {
                                            const updated = [...combinedRules];
                                            updated[index] = { ...updated[index], shippingCost: parseFloat(e.target.value) || 0 };
                                            setCombinedRules(updated);
                                            form.setValue("combinedRules", updated);
                                          }}
                                          step="0.01"
                                        />
                                      </div>
                                      <Button
                                        type="button"
                                        onClick={() => {
                                          const updated = combinedRules.filter((_, i) => i !== index);
                                          setCombinedRules(updated);
                                          form.setValue("combinedRules", updated);
                                        }}
                                        variant="outline"
                                        size="sm"
                                        className="mt-6"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Flat Rate */}
                          {selectedMethod === "flat_rate" && (
                            <FormField
                              control={form.control}
                              name="flatRate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Flat Rate Amount ($)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder="0.00"
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

                          <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                  <Textarea placeholder="Optional description..." {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="oversizedSurcharge"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Oversized Surcharge ($)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder="0.00"
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="hazmatSurcharge"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Hazmat Surcharge ($)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder="0.00"
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name="isDefault"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">Default Template</FormLabel>
                                  <FormDescription>
                                    Use this template as the default for this supplier
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="submit" disabled={createTemplateMutation.isPending}>
                              {createTemplateMutation.isPending ? "Creating..." : "Create Template"}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>

                  {/* Edit Dialog */}
                  <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Edit Shipping Template</DialogTitle>
                        <DialogDescription>
                          Update shipping cost calculation rules for this template
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                          <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Template Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., Standard Shipping" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="method"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Calculation Method</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select calculation method" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="cost_based">Cost-Based</SelectItem>
                                    <SelectItem value="weight_based">Weight-Based</SelectItem>
                                    <SelectItem value="combined">Combined (Cost + Weight)</SelectItem>
                                    <SelectItem value="flat_rate">Flat Rate</SelectItem>
                                    <SelectItem value="free">Free Shipping</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormDescription>
                                  How shipping costs should be calculated
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Same rule sections as create dialog */}
                          {selectedMethod === "cost_based" && (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-base font-medium">Cost Value Rules</Label>
                                <Button type="button" onClick={addCostRule} variant="outline" size="sm">
                                  <Plus className="h-4 w-4 mr-1" />
                                  Add Rule
                                </Button>
                              </div>
                              <div className="space-y-3">
                                {costRules.map((rule, index) => (
                                  <div key={index} className="grid grid-cols-3 gap-3 items-end p-3 border rounded-lg">
                                    <div>
                                      <Label className="text-sm">Min Cost ($)</Label>
                                      <Input
                                        type="number"
                                        value={rule.minCost}
                                        onChange={(e) => updateCostRule(index, "minCost", parseFloat(e.target.value) || 0)}
                                        step="0.01"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-sm">Max Cost ($)</Label>
                                      <Input
                                        type="number"
                                        value={rule.maxCost}
                                        onChange={(e) => updateCostRule(index, "maxCost", parseFloat(e.target.value) || 0)}
                                        step="0.01"
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <div className="flex-1">
                                        <Label className="text-sm">Shipping Cost ($)</Label>
                                        <Input
                                          type="number"
                                          value={rule.shippingCost}
                                          onChange={(e) => updateCostRule(index, "shippingCost", parseFloat(e.target.value) || 0)}
                                          step="0.01"
                                        />
                                      </div>
                                      <Button
                                        type="button"
                                        onClick={() => removeCostRule(index)}
                                        variant="outline"
                                        size="sm"
                                        className="mt-6"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {selectedMethod === "weight_based" && (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-base font-medium">Weight Rules</Label>
                                <Button type="button" onClick={addWeightRule} variant="outline" size="sm">
                                  <Plus className="h-4 w-4 mr-1" />
                                  Add Rule
                                </Button>
                              </div>
                              <div className="space-y-3">
                                {weightRules.map((rule, index) => (
                                  <div key={index} className="grid grid-cols-3 gap-3 items-end p-3 border rounded-lg">
                                    <div>
                                      <Label className="text-sm">Min Weight (lbs)</Label>
                                      <Input
                                        type="number"
                                        value={rule.minWeight}
                                        onChange={(e) => updateWeightRule(index, "minWeight", parseFloat(e.target.value) || 0)}
                                        step="0.1"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-sm">Max Weight (lbs)</Label>
                                      <Input
                                        type="number"
                                        value={rule.maxWeight}
                                        onChange={(e) => updateWeightRule(index, "maxWeight", parseFloat(e.target.value) || 0)}
                                        step="0.1"
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <div className="flex-1">
                                        <Label className="text-sm">Shipping Cost ($)</Label>
                                        <Input
                                          type="number"
                                          value={rule.shippingCost}
                                          onChange={(e) => updateWeightRule(index, "shippingCost", parseFloat(e.target.value) || 0)}
                                          step="0.01"
                                        />
                                      </div>
                                      <Button
                                        type="button"
                                        onClick={() => removeWeightRule(index)}
                                        variant="outline"
                                        size="sm"
                                        className="mt-6"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Combined Rules (Cost + Weight) - Edit Dialog */}
                          {selectedMethod === "combined" && (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-base font-medium">Combined Rules (Cost + Weight)</Label>
                                <Button type="button" onClick={() => {
                                  const newRule = { minCost: 0, maxCost: 0, minWeight: 0, maxWeight: 0, shippingCost: 0 };
                                  const updated = [...combinedRules, newRule];
                                  setCombinedRules(updated);
                                  form.setValue("combinedRules", updated);
                                }} variant="outline" size="sm">
                                  <Plus className="h-4 w-4 mr-1" />
                                  Add Combined Rule
                                </Button>
                              </div>
                              <div className="space-y-3">
                                {combinedRules.map((rule, index) => (
                                  <div key={index} className="grid grid-cols-5 gap-3 items-end p-3 border rounded-lg">
                                    <div>
                                      <Label className="text-sm">Min Cost ($)</Label>
                                      <Input
                                        type="number"
                                        value={rule.minCost}
                                        onChange={(e) => {
                                          const updated = [...combinedRules];
                                          updated[index] = { ...updated[index], minCost: parseFloat(e.target.value) || 0 };
                                          setCombinedRules(updated);
                                          form.setValue("combinedRules", updated);
                                        }}
                                        step="0.01"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-sm">Max Cost ($)</Label>
                                      <Input
                                        type="number"
                                        value={rule.maxCost}
                                        onChange={(e) => {
                                          const updated = [...combinedRules];
                                          updated[index] = { ...updated[index], maxCost: parseFloat(e.target.value) || 0 };
                                          setCombinedRules(updated);
                                          form.setValue("combinedRules", updated);
                                        }}
                                        step="0.01"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-sm">Min Weight (lbs)</Label>
                                      <Input
                                        type="number"
                                        value={rule.minWeight}
                                        onChange={(e) => {
                                          const updated = [...combinedRules];
                                          updated[index] = { ...updated[index], minWeight: parseFloat(e.target.value) || 0 };
                                          setCombinedRules(updated);
                                          form.setValue("combinedRules", updated);
                                        }}
                                        step="0.1"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-sm">Max Weight (lbs)</Label>
                                      <Input
                                        type="number"
                                        value={rule.maxWeight}
                                        onChange={(e) => {
                                          const updated = [...combinedRules];
                                          updated[index] = { ...updated[index], maxWeight: parseFloat(e.target.value) || 0 };
                                          setCombinedRules(updated);
                                          form.setValue("combinedRules", updated);
                                        }}
                                        step="0.1"
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <div className="flex-1">
                                        <Label className="text-sm">Shipping Cost ($)</Label>
                                        <Input
                                          type="number"
                                          value={rule.shippingCost}
                                          onChange={(e) => {
                                            const updated = [...combinedRules];
                                            updated[index] = { ...updated[index], shippingCost: parseFloat(e.target.value) || 0 };
                                            setCombinedRules(updated);
                                            form.setValue("combinedRules", updated);
                                          }}
                                          step="0.01"
                                        />
                                      </div>
                                      <Button
                                        type="button"
                                        onClick={() => {
                                          const updated = combinedRules.filter((_, i) => i !== index);
                                          setCombinedRules(updated);
                                          form.setValue("combinedRules", updated);
                                        }}
                                        variant="outline"
                                        size="sm"
                                        className="mt-6"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {selectedMethod === "flat_rate" && (
                            <FormField
                              control={form.control}
                              name="flatRate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Flat Rate Amount ($)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder="0.00"
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

                          <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                  <Textarea placeholder="Optional description..." {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="oversizedSurcharge"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Oversized Surcharge ($)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder="0.00"
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="hazmatSurcharge"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Hazmat Surcharge ($)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder="0.00"
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name="isDefault"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">Default Template</FormLabel>
                                  <FormDescription>
                                    Use this template as the default for this supplier
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="submit" disabled={updateTemplateMutation.isPending}>
                              {updateTemplateMutation.isPending ? "Updating..." : "Update Template"}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading templates...</div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No shipping templates found. Create one to get started.
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {templates.map((template) => (
                      <Card key={template.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{template.name}</h3>
                              {template.isDefault && (
                                <Badge variant="secondary">Default</Badge>
                              )}
                              <Badge variant="outline">{formatMethodName(template.method)}</Badge>
                            </div>
                            {template.description && (
                              <p className="text-sm text-muted-foreground">{template.description}</p>
                            )}
                            {renderRulesDisplay(template)}
                            {(template.oversizedSurcharge > 0 || template.hazmatSurcharge > 0) && (
                              <div className="text-sm space-y-1">
                                {template.oversizedSurcharge > 0 && (
                                  <div>Oversized surcharge: ${template.oversizedSurcharge}</div>
                                )}
                                {template.hazmatSurcharge > 0 && (
                                  <div>Hazmat surcharge: ${template.hazmatSurcharge}</div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(template)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteTemplateMutation.mutate(template.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="calculator" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Shipping Cost Calculator
              </CardTitle>
              <CardDescription>
                Test shipping cost calculations for the selected supplier
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedSupplierId ? (
                <div className="text-center py-8 text-muted-foreground">
                  Please select a supplier first to use the calculator
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="cost">Product Cost ($)</Label>
                      <Input
                        id="cost"
                        type="number"
                        step="0.01"
                        value={calculatorData.cost}
                        onChange={(e) => setCalculatorData(prev => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="weight">Weight (lbs)</Label>
                      <Input
                        id="weight"
                        type="number"
                        step="0.1"
                        value={calculatorData.weight}
                        onChange={(e) => setCalculatorData(prev => ({ ...prev, weight: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="oversized"
                        checked={calculatorData.isOversized}
                        onChange={(e) => setCalculatorData(prev => ({ ...prev, isOversized: e.target.checked }))}
                      />
                      <Label htmlFor="oversized">Oversized Item</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="hazmat"
                        checked={calculatorData.isHazmat}
                        onChange={(e) => setCalculatorData(prev => ({ ...prev, isHazmat: e.target.checked }))}
                      />
                      <Label htmlFor="hazmat">Hazmat Item</Label>
                    </div>
                    <Button onClick={handleCalculate} disabled={calculateShippingMutation.isPending}>
                      <DollarSign className="h-4 w-4 mr-2" />
                      {calculateShippingMutation.isPending ? "Calculating..." : "Calculate Shipping"}
                    </Button>
                  </div>

                  {calculateShippingMutation.data && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Shipping Calculation Result</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-2xl font-bold text-green-600">
                          {typeof calculateShippingMutation.data.shippingCost === 'string' 
                            ? calculateShippingMutation.data.shippingCost 
                            : `$${calculateShippingMutation.data.shippingCost}`}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Method: {formatMethodName(calculateShippingMutation.data.method)}
                        </div>
                        {calculateShippingMutation.data.breakdown && (
                          <div className="space-y-2 pt-2 border-t">
                            <h4 className="font-medium">Breakdown:</h4>
                            <div className="text-sm space-y-1">
                              <div>Base cost: ${calculateShippingMutation.data.breakdown.baseCost}</div>
                              {calculateShippingMutation.data.breakdown.weightSurcharge > 0 && (
                                <div>Weight surcharge: ${calculateShippingMutation.data.breakdown.weightSurcharge}</div>
                              )}
                              {calculateShippingMutation.data.breakdown.oversizedSurcharge > 0 && (
                                <div>Oversized surcharge: ${calculateShippingMutation.data.breakdown.oversizedSurcharge}</div>
                              )}
                              {calculateShippingMutation.data.breakdown.hazmatSurcharge > 0 && (
                                <div>Hazmat surcharge: ${calculateShippingMutation.data.breakdown.hazmatSurcharge}</div>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}