import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Bot } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

const settingsSchema = z.object({
  fulfillmentMethods: z.array(z.enum(['fbm', 'fba', 'dropship', 'warehouse'])).min(1, "Select at least one fulfillment method"),
  dropshipMinMargin: z.number().min(0).max(100),
  warehouseMinMargin: z.number().min(0).max(100),
  fbmMinMargin: z.number().min(0).max(100),
  fbaMinMargin: z.number().min(0).max(100),
  minConfidence: z.number().min(0).max(100),
  riskLevelFilter: z.string(),
  maxSalesRank: z.number().nullable(),
  requireCanList: z.boolean(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function AISetup() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['/api/purchasing/settings'],
  });

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      fulfillmentMethods: ['fbm'],
      dropshipMinMargin: 15,
      warehouseMinMargin: 25,
      fbmMinMargin: 15,
      fbaMinMargin: 20,
      minConfidence: 50,
      riskLevelFilter: 'all',
      maxSalesRank: null,
      requireCanList: true,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        fulfillmentMethods: settings.fulfillmentMethods || ['fbm'],
        dropshipMinMargin: settings.dropshipMinMargin || 15,
        warehouseMinMargin: settings.warehouseMinMargin || 25,
        fbmMinMargin: settings.fbmMinMargin || 15,
        fbaMinMargin: settings.fbaMinMargin || 20,
        minConfidence: settings.minConfidence || 50,
        riskLevelFilter: settings.riskLevelFilter || 'all',
        maxSalesRank: settings.maxSalesRank,
        requireCanList: settings.requireCanList ?? true,
      });
    }
  }, [settings, form]);

  const updateSettingsMutation = useMutation({
    mutationFn: (data: SettingsFormData) => 
      apiRequest('/api/purchasing/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/purchasing/settings'] });
      toast({
        title: "Settings Updated",
        description: "Your AI preferences have been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SettingsFormData) => {
    updateSettingsMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen" data-testid="loading-spinner">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Bot className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold" data-testid="text-page-title">AI Setup & Preferences</h1>
        </div>
        <p className="text-muted-foreground">
          Configure how the Purchasing AI analyzes products and recommends opportunities
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Fulfillment Method */}
          <Card>
            <CardHeader>
              <CardTitle>Fulfillment Methods</CardTitle>
              <CardDescription>
                Select one or more fulfillment strategies to include in your analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="fulfillmentMethods"
                render={() => (
                  <FormItem>
                    <FormLabel className="text-base">Select Fulfillment Methods</FormLabel>
                    <FormDescription className="mb-4">
                      Choose which fulfillment methods to analyze. You can select multiple options.
                    </FormDescription>
                    <div className="space-y-3">
                      <FormField
                        control={form.control}
                        name="fulfillmentMethods"
                        render={({ field }) => (
                          <FormItem className="flex items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes('fbm')}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  if (checked) {
                                    field.onChange([...current, 'fbm']);
                                  } else {
                                    field.onChange(current.filter((v) => v !== 'fbm'));
                                  }
                                }}
                                data-testid="checkbox-fbm"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="font-medium">
                                FBM (Fulfilled by Merchant)
                              </FormLabel>
                              <FormDescription>
                                You ship products yourself. Only Amazon referral fee (~15%) applies.
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="fulfillmentMethods"
                        render={({ field }) => (
                          <FormItem className="flex items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes('fba')}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  if (checked) {
                                    field.onChange([...current, 'fba']);
                                  } else {
                                    field.onChange(current.filter((v) => v !== 'fba'));
                                  }
                                }}
                                data-testid="checkbox-fba"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="font-medium">
                                FBA (Fulfilled by Amazon)
                              </FormLabel>
                              <FormDescription>
                                Amazon handles storage & shipping. Referral fee + FBA fulfillment fee (~$3-8) apply.
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="fulfillmentMethods"
                        render={({ field }) => (
                          <FormItem className="flex items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes('dropship')}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  if (checked) {
                                    field.onChange([...current, 'dropship']);
                                  } else {
                                    field.onChange(current.filter((v) => v !== 'dropship'));
                                  }
                                }}
                                data-testid="checkbox-dropship"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="font-medium">
                                Dropship
                              </FormLabel>
                              <FormDescription>
                                Supplier ships directly to customer. Lower margin requirements.
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="fulfillmentMethods"
                        render={({ field }) => (
                          <FormItem className="flex items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes('warehouse')}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  if (checked) {
                                    field.onChange([...current, 'warehouse']);
                                  } else {
                                    field.onChange(current.filter((v) => v !== 'warehouse'));
                                  }
                                }}
                                data-testid="checkbox-warehouse"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="font-medium">
                                Purchase for Stock (Warehouse)
                              </FormLabel>
                              <FormDescription>
                                Buy products in bulk to stock in your warehouse. Higher margin requirements.
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Margin Thresholds */}
          <Card>
            <CardHeader>
              <CardTitle>Margin Thresholds</CardTitle>
              <CardDescription>
                Set minimum profit margins for purchase recommendations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fbmMinMargin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>FBM Min Margin (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-fbm-margin"
                        />
                      </FormControl>
                      <FormDescription>
                        Minimum margin for FBM products
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fbaMinMargin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>FBA Min Margin (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-fba-margin"
                        />
                      </FormControl>
                      <FormDescription>
                        Minimum margin for FBA products
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dropshipMinMargin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dropship Min Margin (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-dropship-margin"
                        />
                      </FormControl>
                      <FormDescription>
                        Minimum margin for dropship
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="warehouseMinMargin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Warehouse Min Margin (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-warehouse-margin"
                        />
                      </FormControl>
                      <FormDescription>
                        Minimum margin for warehouse stock
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Analysis Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Analysis Filters</CardTitle>
              <CardDescription>
                Configure how the AI filters and evaluates products
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="minConfidence"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Confidence Score (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        data-testid="input-min-confidence"
                      />
                    </FormControl>
                    <FormDescription>
                      Only show opportunities with confidence above this threshold
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxSalesRank"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Sales Rank (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="e.g., 50000"
                        data-testid="input-max-sales-rank"
                      />
                    </FormControl>
                    <FormDescription>
                      Only recommend products with sales rank below this number (lower rank = more sales)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="requireCanList"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Require Listing Permission</FormLabel>
                      <FormDescription>
                        Only recommend products we can list on Amazon without restrictions
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-require-can-list"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateSettingsMutation.isPending}
              className="w-full sm:w-auto"
              data-testid="button-save-settings"
            >
              {updateSettingsMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
