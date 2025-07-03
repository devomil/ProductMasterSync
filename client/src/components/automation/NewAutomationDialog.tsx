import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Clock, Folder, Settings } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface FilePathConfig {
  id: string;
  label: string;
  filePath: string;
  fileType: 'catalog' | 'inventory' | 'pricing' | 'images' | 'specifications';
  isEnabled: boolean;
  frequency: 'daily' | 'hourly' | 'weekly' | 'monthly';
  timesPerDay: number;
  startTime: string;
  endTime: string;
  dependsOn?: string; // ID of another file config
  processingOrder: number;
}

interface NewAutomationDialogProps {
  open: boolean;
  onClose: () => void;
  suppliers: any[];
  onSubmit: (data: any) => void;
}

export function NewAutomationDialog({ open, onClose, suppliers, onSubmit }: NewAutomationDialogProps) {
  const [automationName, setAutomationName] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [filePaths, setFilePaths] = useState<FilePathConfig[]>([
    {
      id: '1',
      label: 'Main Catalog',
      filePath: '/eco8/out/catalog.csv',
      fileType: 'catalog',
      isEnabled: true,
      frequency: 'daily',
      timesPerDay: 1,
      startTime: '02:00',
      endTime: '22:00',
      processingOrder: 1
    },
    {
      id: '2',
      label: 'Inventory Updates',
      filePath: '/eco8/out/inventory.csv',
      fileType: 'inventory',
      isEnabled: true,
      frequency: 'hourly',
      timesPerDay: 12,
      startTime: '06:00',
      endTime: '22:00',
      dependsOn: '1',
      processingOrder: 2
    }
  ]);

  const addFilePath = () => {
    const newId = (filePaths.length + 1).toString();
    setFilePaths([...filePaths, {
      id: newId,
      label: '',
      filePath: '',
      fileType: 'catalog',
      isEnabled: true,
      frequency: 'daily',
      timesPerDay: 1,
      startTime: '06:00',
      endTime: '22:00',
      processingOrder: filePaths.length + 1
    }]);
  };

  const removeFilePath = (id: string) => {
    setFilePaths(filePaths.filter(fp => fp.id !== id));
  };

  const updateFilePath = (id: string, updates: Partial<FilePathConfig>) => {
    setFilePaths(filePaths.map(fp => fp.id === id ? { ...fp, ...updates } : fp));
  };

  const handleSubmit = () => {
    const data = {
      name: automationName,
      supplierId: parseInt(selectedSupplier),
      isActive,
      filePaths: filePaths.map(fp => ({
        label: fp.label,
        filePath: fp.filePath,
        fileType: fp.fileType,
        isEnabled: fp.isEnabled,
        frequency: fp.frequency,
        timesPerDay: fp.timesPerDay,
        startTime: fp.startTime,
        endTime: fp.endTime,
        dependsOnFileType: filePaths.find(dep => dep.id === fp.dependsOn)?.fileType,
        processingOrder: fp.processingOrder
      }))
    };
    onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Create New Automation Schedule
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Automation Name</Label>
                  <Input
                    id="name"
                    value={automationName}
                    onChange={(e) => setAutomationName(e.target.value)}
                    placeholder="e.g., CWR Distribution Automation"
                  />
                </div>
                <div>
                  <Label htmlFor="supplier">Supplier</Label>
                  <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id.toString()}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="active">Enable automation</Label>
              </div>
            </CardContent>
          </Card>

          {/* File Path Configurations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Folder className="h-5 w-5" />
                  File Path Schedules
                </span>
                <Button onClick={addFilePath} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add File Path
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {filePaths.map((filePath, index) => (
                <Card key={filePath.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={filePath.isEnabled}
                          onCheckedChange={(checked) => updateFilePath(filePath.id, { isEnabled: checked })}
                        />
                        <span className="font-medium">File Path {index + 1}</span>
                      </div>
                      <Button
                        onClick={() => removeFilePath(filePath.id)}
                        size="sm"
                        variant="destructive"
                        disabled={filePaths.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label>Label</Label>
                        <Input
                          value={filePath.label}
                          onChange={(e) => updateFilePath(filePath.id, { label: e.target.value })}
                          placeholder="e.g., Main Catalog"
                        />
                      </div>
                      <div>
                        <Label>File Path</Label>
                        <Input
                          value={filePath.filePath}
                          onChange={(e) => updateFilePath(filePath.id, { filePath: e.target.value })}
                          placeholder="e.g., /eco8/out/catalog.csv"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label>File Type</Label>
                        <Select
                          value={filePath.fileType}
                          onValueChange={(value) => updateFilePath(filePath.id, { fileType: value as any })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="catalog">Catalog</SelectItem>
                            <SelectItem value="inventory">Inventory</SelectItem>
                            <SelectItem value="pricing">Pricing</SelectItem>
                            <SelectItem value="images">Images</SelectItem>
                            <SelectItem value="specifications">Specifications</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Frequency</Label>
                        <Select
                          value={filePath.frequency}
                          onValueChange={(value) => updateFilePath(filePath.id, { frequency: value as any })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hourly">Hourly</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Separator className="my-4" />

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Times per Day
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          max="24"
                          value={filePath.timesPerDay}
                          onChange={(e) => updateFilePath(filePath.id, { timesPerDay: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                      <div>
                        <Label>Start Time</Label>
                        <Input
                          type="time"
                          value={filePath.startTime}
                          onChange={(e) => updateFilePath(filePath.id, { startTime: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>End Time</Label>
                        <Input
                          type="time"
                          value={filePath.endTime}
                          onChange={(e) => updateFilePath(filePath.id, { endTime: e.target.value })}
                        />
                      </div>
                    </div>

                    {filePath.frequency === 'hourly' && (
                      <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-700">
                        This file will run {filePath.timesPerDay} times between {filePath.startTime} and {filePath.endTime}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!automationName || !selectedSupplier || filePaths.length === 0}
            >
              Create Automation
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}