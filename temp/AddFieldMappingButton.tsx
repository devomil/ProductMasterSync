// Simple button to add new field mapping
import React from 'react';
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface AddFieldMappingButtonProps {
  onAddMapping: () => void;
}

export function AddFieldMappingButton({ onAddMapping }: AddFieldMappingButtonProps) {
  return (
    <Button 
      variant="outline" 
      className="w-full mt-2 text-sm"
      onClick={() => {
        console.log("Add field mapping button clicked");
        if (typeof onAddMapping === 'function') {
          onAddMapping();
        } else {
          console.error("onAddMapping is not a function");
        }
      }}
    >
      <Plus className="h-4 w-4 mr-1" /> Add Field Mapping
    </Button>
  );
}