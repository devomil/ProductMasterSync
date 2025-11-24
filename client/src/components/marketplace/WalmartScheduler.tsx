import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export function WalmartScheduler() {
  const [frequency, setFrequency] = useState('daily');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSaveSchedule = async () => {
    try {
      setIsSaving(true);
      await apiRequest('POST', '/api/marketplace/walmart/schedule', { 
        frequency 
      });
      
      toast({
        title: 'Schedule Saved',
        description: `Walmart sync will run ${frequency}`,
      });
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync Schedule</CardTitle>
        <CardDescription>
          Automate regular sync with Walmart marketplace
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="frequency">Sync Frequency</Label>
          <Select value={frequency} onValueChange={setFrequency}>
            <SelectTrigger id="frequency" data-testid="select-frequency">
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hourly">Every Hour</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="manual">Manual Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Button 
          onClick={handleSaveSchedule}
          disabled={isSaving}
          className="w-full"
          data-testid="button-save-schedule"
        >
          <Clock className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Schedule'}
        </Button>
      </CardContent>
    </Card>
  );
}
