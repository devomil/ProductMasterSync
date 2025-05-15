import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useQueryClient } from '@tanstack/react-query';

// Types
export interface RemotePathSchedule {
  path: string;
  label: string;
  frequency: string;
  hour?: number;
  minute?: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  customCron?: string;
  scheduleId?: number;
}

interface DataSource {
  id: number;
  name: string;
  type: string;
  config: any;
}

interface SchedulerConfigDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  dataSource: DataSource | null;
}

export const SchedulerConfigDialog: React.FC<SchedulerConfigDialogProps> = ({
  isOpen,
  onOpenChange,
  dataSource
}) => {
  const [remotePaths, setRemotePaths] = useState<RemotePathSchedule[]>([]);
  const [selectedPathIndex, setSelectedPathIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const queryClient = useQueryClient();

  // Initialize remote paths from data source config
  useEffect(() => {
    if (dataSource && dataSource.config && 
        dataSource.type === 'sftp' && 
        dataSource.config.remote_paths) {
      
      // Get schedules for this data source
      const fetchSchedules = async () => {
        try {
          const response = await apiRequest<any[]>(`/api/schedules?dataSourceId=${dataSource.id}`);
          
          // Map remote paths to include schedule info
          const pathsWithSchedules = dataSource.config.remote_paths.map((path: any) => {
            // Find schedule for this path if it exists
            const schedule = response.find(s => s.remotePath === path.path);
            
            return {
              path: path.path,
              label: path.label || path.path,
              frequency: schedule?.frequency || 'daily',
              hour: schedule?.hour || 0,
              minute: schedule?.minute || 0,
              dayOfWeek: schedule?.dayOfWeek,
              dayOfMonth: schedule?.dayOfMonth,
              customCron: schedule?.customCron,
              scheduleId: schedule?.id
            };
          });
          
          setRemotePaths(pathsWithSchedules);
        } catch (error) {
          console.error('Error fetching schedules:', error);
          
          // Fallback to paths without schedules
          setRemotePaths(dataSource.config.remote_paths.map((path: any) => ({
            path: path.path,
            label: path.label || path.path,
            frequency: 'daily',
            hour: 0,
            minute: 0
          })));
        }
      };
      
      fetchSchedules();
    }
  }, [dataSource]);

  // Handle schedule changes
  const handleScheduleChange = (field: string, value: any) => {
    const updatedPaths = [...remotePaths];
    updatedPaths[selectedPathIndex] = {
      ...updatedPaths[selectedPathIndex],
      [field]: value
    };
    setRemotePaths(updatedPaths);
  };

  // Save schedules for all paths
  const saveSchedules = async () => {
    if (!dataSource) return;
    
    setIsLoading(true);
    
    try {
      // Save each path's schedule
      const promises = remotePaths.map(async (pathSchedule) => {
        const scheduleData = {
          dataSourceId: dataSource.id,
          remotePath: pathSchedule.path,
          pathLabel: pathSchedule.label,
          frequency: pathSchedule.frequency,
          hour: pathSchedule.hour,
          minute: pathSchedule.minute,
          dayOfWeek: pathSchedule.frequency === 'weekly' ? pathSchedule.dayOfWeek : null,
          dayOfMonth: pathSchedule.frequency === 'monthly' ? pathSchedule.dayOfMonth : null,
          customCron: pathSchedule.frequency === 'custom' ? pathSchedule.customCron : null
        };
        
        if (pathSchedule.scheduleId) {
          // Update existing schedule
          return apiRequest(`/api/schedules/${pathSchedule.scheduleId}`, {
            method: 'PATCH',
            body: JSON.stringify(scheduleData)
          });
        } else {
          // Create new schedule
          return apiRequest('/api/schedules', {
            method: 'POST',
            body: JSON.stringify(scheduleData)
          });
        }
      });
      
      await Promise.all(promises);
      
      // Invalidate schedules query
      queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
      
      toast({
        title: "Schedules Saved",
        description: "Pull schedules have been successfully saved"
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving schedules:', error);
      toast({
        variant: "destructive",
        title: "Error Saving Schedules",
        description: "There was an error saving the schedules. Please try again."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedPath = remotePaths[selectedPathIndex] || null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Pull Schedules</DialogTitle>
        </DialogHeader>
        
        {dataSource && dataSource.type === 'sftp' && remotePaths.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <Label className="w-32">Data Source:</Label>
              <div className="font-medium">{dataSource.name}</div>
            </div>
            
            <Tabs defaultValue="paths" className="w-full">
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="paths">Remote Paths</TabsTrigger>
                <TabsTrigger value="preview">Schedule Preview</TabsTrigger>
              </TabsList>
              
              <TabsContent value="paths" className="space-y-4 pt-4">
                <div className="flex space-x-4">
                  <div className="w-1/3 border rounded-md p-2">
                    <Label className="mb-2 block">Remote Paths</Label>
                    <div className="space-y-1 max-h-[300px] overflow-y-auto">
                      {remotePaths.map((path, index) => (
                        <Button
                          key={index}
                          variant={selectedPathIndex === index ? "default" : "outline"}
                          className="w-full justify-start"
                          onClick={() => setSelectedPathIndex(index)}
                        >
                          {path.label || path.path}
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="w-2/3 border rounded-md p-4">
                    {selectedPath && (
                      <div className="space-y-4">
                        <div>
                          <Label className="font-medium block mb-1">
                            Configure Schedule for: {selectedPath.label}
                          </Label>
                          <div className="text-sm text-gray-500">
                            Path: {selectedPath.path}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="frequency">Frequency</Label>
                            <Select
                              value={selectedPath.frequency}
                              onValueChange={(value) => handleScheduleChange('frequency', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select frequency" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="once">Once</SelectItem>
                                <SelectItem value="hourly">Hourly</SelectItem>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="custom">Custom (CRON)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        {/* Time settings */}
                        {(['daily', 'weekly', 'monthly'].includes(selectedPath.frequency)) && (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="hour">Hour (0-23)</Label>
                              <Input
                                id="hour"
                                type="number"
                                min={0}
                                max={23}
                                value={selectedPath.hour || 0}
                                onChange={(e) => handleScheduleChange('hour', parseInt(e.target.value))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="minute">Minute (0-59)</Label>
                              <Input
                                id="minute"
                                type="number"
                                min={0}
                                max={59}
                                value={selectedPath.minute || 0}
                                onChange={(e) => handleScheduleChange('minute', parseInt(e.target.value))}
                              />
                            </div>
                          </div>
                        )}
                        
                        {/* Weekly settings */}
                        {selectedPath.frequency === 'weekly' && (
                          <div className="space-y-2">
                            <Label htmlFor="dayOfWeek">Day of Week</Label>
                            <Select
                              value={String(selectedPath.dayOfWeek || 0)}
                              onValueChange={(value) => handleScheduleChange('dayOfWeek', parseInt(value))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select day of week" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">Sunday</SelectItem>
                                <SelectItem value="1">Monday</SelectItem>
                                <SelectItem value="2">Tuesday</SelectItem>
                                <SelectItem value="3">Wednesday</SelectItem>
                                <SelectItem value="4">Thursday</SelectItem>
                                <SelectItem value="5">Friday</SelectItem>
                                <SelectItem value="6">Saturday</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        
                        {/* Monthly settings */}
                        {selectedPath.frequency === 'monthly' && (
                          <div className="space-y-2">
                            <Label htmlFor="dayOfMonth">Day of Month (1-31)</Label>
                            <Input
                              id="dayOfMonth"
                              type="number"
                              min={1}
                              max={31}
                              value={selectedPath.dayOfMonth || 1}
                              onChange={(e) => handleScheduleChange('dayOfMonth', parseInt(e.target.value))}
                            />
                          </div>
                        )}
                        
                        {/* Custom CRON settings */}
                        {selectedPath.frequency === 'custom' && (
                          <div className="space-y-2">
                            <Label htmlFor="customCron">Custom CRON Expression</Label>
                            <Input
                              id="customCron"
                              value={selectedPath.customCron || ''}
                              onChange={(e) => handleScheduleChange('customCron', e.target.value)}
                              placeholder="* * * * *"
                            />
                            <div className="text-xs text-gray-500">
                              Format: minute hour day-of-month month day-of-week
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="preview" className="space-y-4 pt-4">
                <div className="border rounded-md p-4">
                  <h3 className="font-medium mb-4">Schedule Preview</h3>
                  <div className="space-y-4">
                    {remotePaths.map((path, index) => (
                      <div key={index} className="border-b pb-2 last:border-b-0">
                        <div className="font-medium">{path.label || path.path}</div>
                        <div className="text-sm text-gray-500">{path.path}</div>
                        <div className="text-sm mt-1">
                          <span className="font-medium">Frequency:</span> {path.frequency}
                          {path.frequency === 'daily' && (
                            <span> at {path.hour}:{path.minute.toString().padStart(2, '0')}</span>
                          )}
                          {path.frequency === 'weekly' && (
                            <span> on {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][path.dayOfWeek || 0]} at {path.hour}:{path.minute.toString().padStart(2, '0')}</span>
                          )}
                          {path.frequency === 'monthly' && (
                            <span> on day {path.dayOfMonth} at {path.hour}:{path.minute.toString().padStart(2, '0')}</span>
                          )}
                          {path.frequency === 'custom' && (
                            <span> with CRON expression: {path.customCron}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="py-4 text-center">
            No remote paths configured for this data source. Please add remote paths first.
          </div>
        )}
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={saveSchedules}
            disabled={isLoading || remotePaths.length === 0}
          >
            {isLoading ? 'Saving...' : 'Save Schedules'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SchedulerConfigDialog;