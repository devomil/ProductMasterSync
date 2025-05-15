import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RemotePathItem } from './SampleDataModal';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface RemotePathSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (path: RemotePathItem) => void;
  paths: RemotePathItem[];
  isLoading?: boolean;
}

const RemotePathSelector: React.FC<RemotePathSelectorProps> = ({
  open,
  onClose,
  onSelect,
  paths,
  isLoading = false
}) => {
  const [selectedPathId, setSelectedPathId] = useState<string | null>(paths.length > 0 ? paths[0].id : null);

  const handleSelect = () => {
    const selected = paths.find(p => p.id === selectedPathId);
    if (selected) {
      onSelect(selected);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Select Remote Path</DialogTitle>
          <DialogDescription>
            Choose which file you would like to pull sample data from
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <RadioGroup 
            value={selectedPathId || ''} 
            onValueChange={setSelectedPathId}
            className="space-y-3"
          >
            {paths.map((path) => (
              <div 
                key={path.id} 
                className="flex items-center space-x-2 border p-3 rounded-md hover:bg-slate-50 cursor-pointer"
                onClick={() => setSelectedPathId(path.id)}
              >
                <RadioGroupItem value={path.id} id={path.id} />
                <Label htmlFor={path.id} className="flex-grow cursor-pointer">
                  <div className="font-medium">{path.label}</div>
                  <div className="text-sm text-gray-500">{path.path}</div>
                  {path.lastPulled && (
                    <div className="text-xs text-gray-400 mt-1">
                      Last pulled: {new Date(path.lastPulled).toLocaleString()}
                      {path.lastPullStatus && (
                        <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                          path.lastPullStatus === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {path.lastPullStatus}
                        </span>
                      )}
                    </div>
                  )}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSelect} 
            disabled={!selectedPathId || isLoading}
          >
            {isLoading ? "Loading..." : "Pull Sample Data"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RemotePathSelector;