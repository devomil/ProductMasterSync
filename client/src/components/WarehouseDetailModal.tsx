import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Package, Clock, TruckIcon, DollarSign, Truck, Shield, Tag, FileText } from "lucide-react";

interface WarehouseLocation {
  code: string;
  name: string;
  location: string;
  quantity: number;
  cost: number;
}

interface WarehouseDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorName: string;
  sku: string;
  productId?: string;
}

export default function WarehouseDetailModal({ 
  isOpen, 
  onClose, 
  vendorName, 
  sku 
}: WarehouseDetailModalProps) {
  const { data: inventoryData, isLoading } = useQuery({
    queryKey: [`/api/inventory/${sku}`],
    enabled: isOpen && !!sku,
  }) as { data: any, isLoading: boolean };

  const getStatusColor = (quantity: number) => {
    if (quantity > 10) return "bg-green-100 text-green-800";
    if (quantity > 0) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getStatusText = (quantity: number) => {
    if (quantity > 10) return "In Stock";
    if (quantity > 0) return "Low Stock";
    return "Out of Stock";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {vendorName} Warehouse Locations
          </DialogTitle>
          <DialogDescription>
            Real-time inventory data for SKU: <span className="font-mono">{sku}</span>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3">Loading real-time inventory data...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {inventoryData?.warehouses?.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-gray-600">
                    <Clock className="h-4 w-4 inline mr-1" />
                    Last updated: {new Date(inventoryData.lastUpdated).toLocaleString()}
                  </div>
                  <Badge variant="outline" className="text-blue-600">
                    {inventoryData.source}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {inventoryData.warehouses.map((warehouse: WarehouseLocation, index: number) => (
                    <Card key={index} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-blue-600" />
                            {warehouse.name}
                          </div>
                          <Badge 
                            className={getStatusColor(warehouse.quantity)}
                            variant="outline"
                          >
                            {getStatusText(warehouse.quantity)}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Location:</span>
                            <span className="font-medium">{warehouse.location}</span>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Warehouse Code:</span>
                            <span className="font-mono text-sm">{warehouse.code}</span>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Available Quantity:</span>
                            <span className="font-bold text-lg">
                              {warehouse.quantity}
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Cost:</span>
                            <span className="font-semibold text-green-600">
                              ${warehouse.cost.toFixed(2)}
                            </span>
                          </div>
                          
                          {warehouse.quantity > 0 && (
                            <div className="pt-2 border-t">
                              <Button 
                                size="sm" 
                                className="w-full"
                                onClick={() => {
                                  console.log(`Order from ${warehouse.name} - Qty: ${warehouse.quantity}`);
                                }}
                              >
                                <TruckIcon className="h-4 w-4 mr-2" />
                                Request from this warehouse
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">
                    Inventory Update Schedule
                  </h4>
                  <p className="text-sm text-blue-700">
                    CWR inventory data is automatically synchronized every 2 hours from 
                    the live feed at <span className="font-mono">/eco8/out/inventory.csv</span>. 
                    Data shown reflects real-time availability from authorized supplier systems.
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">No warehouse data available for this product</p>
                <p className="text-sm text-gray-500 mt-1">
                  This may be a new product or inventory sync is in progress
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}