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
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ShippingTemplate | null>(null);
  const [calculatorData, setCalculatorData] = useState({
    cost: 0,
    weight: 0,
    isOversized: false,
    isHazmat: false
  });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers", selectedSupplierId, "shipping-templates"] });
      setEditingTemplate(null);
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

  const form = useForm<ShippingTemplateFormData>({
    resolver: zodResolver(shippingTemplateSchema),
    defaultValues: {
      name: "",
      method: "cost_based",
      description: "",
      isDefault: false,
      oversizedSurcharge: 0,
      hazmatSurcharge: 0,
    },
  });

  const onSubmit = (data: ShippingTemplateFormData) => {
    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createTemplateMutation.mutate(data);
    }
  };

  const handleCalculate = () => {
    if (selectedSupplierId) {
      calculateShippingMutation.mutate(calculatorData);
    }
  };

  const formatMethodName = (method: string) => {
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
                              onClick={() => setEditingTemplate(template)}
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