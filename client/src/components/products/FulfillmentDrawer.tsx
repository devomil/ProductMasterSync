import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Truck, Package2, Building, Plus, Minus, AlertTriangle } from 'lucide-react';

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { useProductFulfillment, ProductFulfillment, WarehouseLocation } from '@/hooks/useProductFulfillment';

// Schema for fulfillment form
const fulfillmentSchema = z.object({
  internal_stock: z.object({
    enabled: z.boolean(),
    warehouses: z.array(
      z.object({
        location: z.string().min(1, 'Location name is required'),
        stock: z.coerce.number().int().min(0, 'Stock cannot be negative'),
      })
    ),
  }),
  dropship: z.object({
    enabled: z.boolean(),
    supplier_id: z.string().nullable(),
    stock: z.coerce.number().int().min(0, 'Stock cannot be negative'),
    lead_time_days: z.coerce.number().int().min(1, 'Lead time must be at least 1 day'),
  }),
  bulk_discount_available: z.boolean(),
  preferred_source: z.enum(['internal', 'dropship', 'auto']),
});

interface FulfillmentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string | null;
  productName: string;
}

export function FulfillmentDrawer({ isOpen, onClose, productId, productName }: FulfillmentDrawerProps) {
  const { toast } = useToast();
  const {
    fulfillment,
    suppliers,
    stockData,
    isLoading,
    isUpdating,
    error,
    updateFulfillment,
  } = useProductFulfillment(productId);
  
  // Setup form
  const form = useForm<ProductFulfillment>({
    resolver: zodResolver(fulfillmentSchema),
    defaultValues: {
      internal_stock: {
        enabled: true,
        warehouses: [],
      },
      dropship: {
        enabled: false,
        supplier_id: null,
        stock: 0,
        lead_time_days: 1,
      },
      bulk_discount_available: false,
      preferred_source: 'auto',
    },
  });
  
  // Reset form when fulfillment data changes
  useEffect(() => {
    if (fulfillment) {
      form.reset(fulfillment);
    }
  }, [fulfillment, form]);
  
  // Add a new warehouse for internal stock
  const addWarehouse = () => {
    const currentWarehouses = form.getValues('internal_stock.warehouses') || [];
    form.setValue('internal_stock.warehouses', [
      ...currentWarehouses,
      { location: '', stock: 0 },
    ]);
  };
  
  // Remove a warehouse
  const removeWarehouse = (index: number) => {
    const currentWarehouses = form.getValues('internal_stock.warehouses') || [];
    form.setValue(
      'internal_stock.warehouses',
      currentWarehouses.filter((_, i) => i !== index)
    );
  };
  
  // Handle form submission
  const onSubmit = (data: ProductFulfillment) => {
    updateFulfillment(data, {
      onSuccess: () => {
        toast({
          title: 'Fulfillment options updated',
          description: 'Product fulfillment settings have been saved successfully.',
        });
        onClose();
      },
      onError: (err) => {
        toast({
          title: 'Error updating fulfillment',
          description: err.message || 'An error occurred while saving fulfillment settings.',
          variant: 'destructive',
        });
      },
    });
  };
  
  if (!productId) return null;
  
  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="h-[85vh]">
        <DrawerHeader>
          <DrawerTitle className="text-xl flex items-center">
            <Truck className="mr-2 h-5 w-5" />
            Manage Fulfillment Options
          </DrawerTitle>
          <DrawerDescription>
            Configure fulfillment settings for <span className="font-medium">{productName}</span>
          </DrawerDescription>
        </DrawerHeader>
        
        <div className="px-4 py-2 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Failed to load fulfillment data. Please try again.
              </AlertDescription>
            </Alert>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Stock Overview */}
                {stockData && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-md">Stock Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="flex flex-col items-center">
                          <span className="text-sm text-muted-foreground">Warehouse</span>
                          <span className="text-2xl font-bold">{stockData.warehouse_stock}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-sm text-muted-foreground">Dropship</span>
                          <span className="text-2xl font-bold">{stockData.supplier_stock}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-sm text-muted-foreground">Total</span>
                          <span className="text-2xl font-bold">{stockData.total_stock}</span>
                          {stockData.total_stock < 100 && (
                            <Badge variant="outline" className="mt-1 text-amber-700 bg-amber-50 border-amber-200">
                              Low Stock
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* Preferred Source Selection */}
                <div className="space-y-2">
                  <FormField
                    control={form.control}
                    name="preferred_source"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preferred Fulfillment Source</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select preferred source" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="internal">Internal Warehouse</SelectItem>
                            <SelectItem value="dropship">Supplier Dropship</SelectItem>
                            <SelectItem value="auto">Auto (Determine Automatically)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          System will prioritize this source when fulfilling orders
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="bulk_discount_available"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Bulk Discount Available</FormLabel>
                          <FormDescription>
                            Enable discount pricing for bulk orders
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                
                <Separator />
                
                {/* Internal Stock Section */}
                <div className="space-y-4">
                  <div className="flex items-center">
                    <Building className="mr-2 h-5 w-5" />
                    <h3 className="text-lg font-medium">Internal Warehouse Stock</h3>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="internal_stock.enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Enable Internal Stock</FormLabel>
                          <FormDescription>
                            Fulfill orders from your own warehouses
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  {form.watch('internal_stock.enabled') && (
                    <div className="space-y-4 pl-2">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-medium">Warehouse Locations</h4>
                        <Button 
                          onClick={addWarehouse} 
                          size="sm" 
                          variant="outline"
                          type="button"
                        >
                          <Plus className="h-4 w-4 mr-1" /> Add Location
                        </Button>
                      </div>
                      
                      {form.watch('internal_stock.warehouses')?.length === 0 ? (
                        <div className="text-sm text-muted-foreground italic text-center py-4">
                          No warehouse locations added yet
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {form.watch('internal_stock.warehouses')?.map((_, index) => (
                            <div key={index} className="flex items-end gap-3 rounded-md border p-3">
                              <FormField
                                control={form.control}
                                name={`internal_stock.warehouses.${index}.location`}
                                render={({ field }) => (
                                  <FormItem className="flex-1">
                                    <FormLabel className="text-xs">Location Name</FormLabel>
                                    <FormControl>
                                      <Input {...field} placeholder="Warehouse name" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              
                              <FormField
                                control={form.control}
                                name={`internal_stock.warehouses.${index}.stock`}
                                render={({ field }) => (
                                  <FormItem className="w-24">
                                    <FormLabel className="text-xs">Stock</FormLabel>
                                    <FormControl>
                                      <Input {...field} type="number" min="0" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              
                              <Button
                                size="icon"
                                variant="ghost"
                                type="button"
                                onClick={() => removeWarehouse(index)}
                                className="mb-[2px]"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <Separator />
                
                {/* Dropship Section */}
                <div className="space-y-4">
                  <div className="flex items-center">
                    <Truck className="mr-2 h-5 w-5" />
                    <h3 className="text-lg font-medium">Supplier Dropship</h3>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="dropship.enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Enable Dropshipping</FormLabel>
                          <FormDescription>
                            Allow suppliers to ship directly to customers
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  {form.watch('dropship.enabled') && (
                    <div className="space-y-4 pl-2">
                      <FormField
                        control={form.control}
                        name="dropship.supplier_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dropship Supplier</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value || undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select supplier" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {suppliers.map(supplier => (
                                  <SelectItem key={supplier.id} value={supplier.id}>
                                    {supplier.name} ({supplier.code})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="dropship.stock"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Available Stock</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" min="0" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="dropship.lead_time_days"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Lead Time (Days)</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" min="1" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </Form>
          )}
        </div>
        
        <DrawerFooter>
          <Button 
            onClick={form.handleSubmit(onSubmit)}
            disabled={isLoading || isUpdating}
            className="w-full"
          >
            {isUpdating ? (
              <>
                <span className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-current rounded-full inline-block"></span>
                Saving...
              </>
            ) : 'Save Fulfillment Settings'}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline" className="w-full">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}