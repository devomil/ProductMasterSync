import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, ChevronDown, ChevronUp, Trash, Save, Maximize, Minimize } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EnhancedSampleDataTable from "@/components/mapping/EnhancedSampleDataTable";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface FieldMapping {
  sourceField: string;
  targetField: string;
}

interface MappingFieldInterfaceProps {
  sampleData: any[];
  sampleHeaders: string[];
  fieldMappings: FieldMapping[];
  updateFieldMapping: (index: number, field: 'sourceField' | 'targetField', value: string) => void;
  addMappingRow: () => void;
  removeMappingRow: (index: number) => void;
  targetFields: { id: string; name: string; required?: boolean }[];
  saveMapping: () => Promise<void>;
  externalFullScreen?: boolean;
  onFullScreenChange?: (state: boolean) => void;
}

export default function MappingFieldInterface({
  sampleData,
  sampleHeaders,
  fieldMappings,
  updateFieldMapping,
  addMappingRow,
  removeMappingRow,
  targetFields,
  saveMapping,
  externalFullScreen,
  onFullScreenChange
}: MappingFieldInterfaceProps) {
  const [showAllRows, setShowAllRows] = useState(false);
  const [expandedPanel, setExpandedPanel] = useState<'sample' | 'mapping' | 'both'>('both');
  const [isSaving, setIsSaving] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Get required fields from target fields
  const requiredFields = targetFields.filter(field => field.required).map(field => field.id);
  
  // Check if all required fields are mapped
  const areRequiredFieldsMapped = requiredFields.every(fieldId => 
    fieldMappings.some(mapping => mapping.targetField === fieldId)
  );

  // Handle save with validation
  const handleSave = async () => {
    if (!areRequiredFieldsMapped) {
      toast({
        variant: "destructive",
        title: "Missing Required Fields",
        description: "Please map all required fields before saving."
      });
      return;
    }

    try {
      setIsSaving(true);
      await saveMapping();
      toast({
        title: "✅ Mapping template saved",
        description: "Your mapping template is ready for ingestion."
      });
    } catch (error) {
      console.error("Error saving mapping:", error);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle toggling full screen mode
  const toggleFullScreen = () => {
    const newState = !isFullScreen;
    setIsFullScreen(newState);
    
    // Update external state if provided
    if (onFullScreenChange) {
      onFullScreenChange(newState);
    }
    
    // When entering full-screen, make sure both panels are expanded
    if (newState) {
      setExpandedPanel('both');
    }
  };
  
  // Sync with external fullscreen state if provided
  useEffect(() => {
    if (externalFullScreen !== undefined && isFullScreen !== externalFullScreen) {
      setIsFullScreen(externalFullScreen);
      
      // When entering full-screen, make sure both panels are expanded
      if (externalFullScreen) {
        setExpandedPanel('both');
      }
    }
  }, [externalFullScreen]);
  
  // Add/remove event listener for ESC key to exit full screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
        
        // Update external state if provided
        if (onFullScreenChange) {
          onFullScreenChange(false);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);

  return (
    <div className={`
      space-y-6 
      ${isFullScreen ? 'fixed inset-0 bg-white dark:bg-slate-900 p-6 z-[9999] overflow-auto flex flex-col h-full w-full' : ''}
    `}>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Field Mappings</h3>
        <div className="flex gap-2">
          <Button 
            variant={isFullScreen ? "default" : "outline"}
            onClick={toggleFullScreen}
            title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
            className={isFullScreen ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            {isFullScreen ? 
              <><Minimize className="h-4 w-4 mr-2" /> Exit Fullscreen</> : 
              <><Maximize className="h-4 w-4 mr-2" /> Fullscreen</>
            }
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isSaving || !areRequiredFieldsMapped}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Mapping"}
          </Button>
        </div>
      </div>

      {/* Sample Data Panel */}
      <Collapsible 
        open={expandedPanel === 'sample' || expandedPanel === 'both'} 
        onOpenChange={() => setExpandedPanel(expandedPanel === 'sample' ? 'both' : (expandedPanel === 'both' ? 'mapping' : 'sample'))}
        className={`border rounded-md ${isFullScreen ? 'border-2 border-green-200' : ''}`}
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors">
          <div className="font-medium flex items-center">
            <span>Sample Data Preview</span>
            {sampleData.length > 0 && (
              <Badge variant="outline" className="ml-2 bg-blue-50">
                {sampleData.length} rows
              </Badge>
            )}
          </div>
          {expandedPanel === 'sample' || expandedPanel === 'both' 
            ? <ChevronUp className="h-4 w-4" /> 
            : <ChevronDown className="h-4 w-4" />
          }
        </CollapsibleTrigger>
        <CollapsibleContent className="p-4">
          {sampleData && sampleData.length > 0 ? (
            <>
              <EnhancedSampleDataTable 
                sampleData={sampleData} 
                maxHeight={isFullScreen ? "35vh" : "300px"}
                maxRows={showAllRows || isFullScreen ? sampleData.length : 5} 
                showInstructions={false}
              />
              <div className="flex justify-center mt-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowAllRows(!showAllRows)}
                >
                  {showAllRows ? "Show Less" : `Show All (${sampleData.length} rows)`}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              No sample data available. Please upload a sample file.
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Field Mapping Panel */}
      <Collapsible 
        open={expandedPanel === 'mapping' || expandedPanel === 'both'} 
        onOpenChange={() => setExpandedPanel(expandedPanel === 'mapping' ? 'both' : (expandedPanel === 'both' ? 'sample' : 'mapping'))}
        className={`border rounded-md ${isFullScreen ? 'border-2 border-blue-200' : ''}`}
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors">
          <div className="font-medium flex items-center">
            <span>Field Mappings</span>
            <Badge variant="outline" className="ml-2 bg-blue-50">
              {fieldMappings.filter(m => m.sourceField && m.targetField).length} mapped
            </Badge>
          </div>
          {expandedPanel === 'mapping' || expandedPanel === 'both' 
            ? <ChevronUp className="h-4 w-4" /> 
            : <ChevronDown className="h-4 w-4" />
          }
        </CollapsibleTrigger>
        <CollapsibleContent className="p-4">
          <div className={`space-y-3 overflow-y-auto pr-2 ${isFullScreen ? 'max-h-[38vh]' : 'max-h-[400px]'}`}>
            {fieldMappings.map((mapping, index) => (
              <div key={index} className={`flex items-center space-x-2 p-2 rounded-md hover:bg-slate-50 ${isFullScreen ? 'border border-slate-200' : ''}`}>
                <div className="flex-1">
                  <Select 
                    value={mapping.sourceField}
                    onValueChange={(value) => updateFieldMapping(index, 'sourceField', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Source Field" />
                    </SelectTrigger>
                    <SelectContent>
                      {sampleHeaders.length > 0 ? (
                        sampleHeaders.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no_headers">
                          Upload a sample file first
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                <span className="text-muted-foreground">→</span>
                
                <div className="flex-1">
                  <Select 
                    value={mapping.targetField}
                    onValueChange={(value) => updateFieldMapping(index, 'targetField', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Target Field" />
                    </SelectTrigger>
                    <SelectContent>
                      {targetFields.map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          {field.name}{field.required ? " *" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMappingRow(index)}
                  disabled={fieldMappings.length <= 1}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          
          <div className="mt-4 flex items-center justify-between">
            <Button variant="outline" onClick={addMappingRow}>
              <Plus className="h-4 w-4 mr-2" /> Add Mapping
            </Button>
            
            <div className="text-sm text-muted-foreground">
              {!areRequiredFieldsMapped && (
                <span className="text-red-500">Missing required fields *</span>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
      
      {/* Info Panel */}
      <div className={`bg-amber-50 border border-amber-200 rounded-md p-4 ${isFullScreen ? 'mt-auto' : ''}`}>
        <h4 className="font-medium text-amber-800 mb-2">Mapping Instructions</h4>
        <ul className="text-sm text-amber-700 list-disc pl-5 space-y-1">
          <li>Map source fields from your data to target fields in your system</li>
          <li>Fields marked with an asterisk (*) are required</li>
          <li>Your mapping will be saved and used for future ingestions</li>
          <li>Sample data is limited to {sampleData.length} rows for preview purposes</li>
          {isFullScreen && (
            <li className="mt-2 text-blue-700 font-medium">Press ESC key or click the minimize button to exit full-screen mode</li>
          )}
        </ul>
      </div>
    </div>
  );
}