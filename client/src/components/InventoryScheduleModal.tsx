import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Database, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InventoryScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierName: string;
}

export default function InventoryScheduleModal({ 
  isOpen, 
  onClose, 
  supplierName 
}: InventoryScheduleModalProps) {
  const [frequency, setFrequency] = useState<string>('daily');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleScheduleUpdate = async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/inventory/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          supplierName,
          frequency,
          enabled: true
        }),
      });

      if (response.ok) {
        toast({
          title: "Inventory Schedule Updated",
          description: `${supplierName} inventory will now sync ${frequency}`,
        });
        onClose();
      } else {
        throw new Error('Failed to update schedule');
      }
    } catch (error) {
      toast({
        title: "Schedule Update Failed",
        description: "Unable to configure inventory sync schedule",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const frequencyOptions = [
    { value: 'hourly', label: 'Every Hour', description: 'Real-time inventory tracking' },
    { value: 'daily', label: 'Daily', description: 'Once per day at 6:00 AM EST' },
    { value: 'weekly', label: 'Weekly', description: 'Every Monday at 6:00 AM EST' },
    { value: 'manual', label: 'Manual Only', description: 'Pull inventory data on demand' }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Configure Inventory Sync
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="h-4 w-4" />
                Data Source
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <span className="font-medium">{supplierName}</span>
                <Badge variant="outline" className="text-green-600 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                SFTP: datafeed.cwrmarine.com/eco8/out/inventory.csv
              </p>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <label className="text-sm font-medium">Sync Frequency</label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger>
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                {frequencyOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col">
                      <span>{option.label}</span>
                      <span className="text-xs text-gray-500">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-1">What gets synced:</h4>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Warehouse stock levels across all locations</li>
              <li>• Updated pricing and cost information</li>
              <li>• Product availability status</li>
              <li>• Lead time and shipping data</li>
            </ul>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleScheduleUpdate} 
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? 'Scheduling...' : 'Schedule Sync'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}