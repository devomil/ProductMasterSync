import { useState } from 'react';
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FullscreenButton } from "@/components/ui/fullscreen-button";
import MappingFieldInterface from "@/components/mapping/MappingFieldInterface";

interface FieldMapping {
  sourceField: string;
  targetField: string;
}

interface FullscreenMappingProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  sampleData: any[];
  sampleHeaders: string[];
  fieldMappings: FieldMapping[];
  updateFieldMapping: (index: number, field: 'sourceField' | 'targetField', value: string) => void;
  addMappingRow: () => void;
  removeMappingRow: (index: number) => void;
  targetFields: { id: string; name: string; required?: boolean }[];
  saveMapping: () => Promise<void>;
}

export default function FullscreenMapping({
  isOpen,
  onOpenChange,
  title = "Field Mapping",
  description = "Map source fields to your internal schema fields",
  sampleData,
  sampleHeaders,
  fieldMappings,
  updateFieldMapping,
  addMappingRow,
  removeMappingRow,
  targetFields,
  saveMapping
}: FullscreenMappingProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  // Fullscreen handler
  const handleFullScreenToggle = (fullscreenState: boolean) => {
    setIsFullScreen(fullscreenState);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "max-w-4xl overflow-y-auto", 
          isFullScreen 
            ? "fixed inset-0 left-0 right-0 top-0 bottom-0 w-full h-full z-50 rounded-none max-h-none" 
            : "max-h-[90vh]"
        )}
        style={isFullScreen ? {transform: 'none', margin: 0} : {}}
      >
        <DialogHeader className="flex flex-row items-start justify-between">
          <div>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {description}
            </DialogDescription>
          </div>
          <FullscreenButton onToggle={handleFullScreenToggle} className="mt-1" />
        </DialogHeader>
        
        {sampleData && sampleData.length > 0 && (
          <MappingFieldInterface
            sampleData={sampleData}
            sampleHeaders={sampleHeaders}
            fieldMappings={fieldMappings}
            updateFieldMapping={updateFieldMapping}
            addMappingRow={addMappingRow}
            removeMappingRow={removeMappingRow}
            targetFields={targetFields}
            saveMapping={saveMapping}
            externalFullScreen={isFullScreen}
            onFullScreenChange={handleFullScreenToggle}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}