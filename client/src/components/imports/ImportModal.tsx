import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import { useSuppliers } from "@/hooks/useSuppliers";
import FileUploader from "./FileUploader";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ImportModal = ({ open, onOpenChange }: ImportModalProps) => {
  const { suppliers, isLoading: suppliersLoading } = useSuppliers();
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [importType, setImportType] = useState("file");
  const [mappingTemplate, setMappingTemplate] = useState("Standard Product Catalog");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal is opened/closed
  useEffect(() => {
    if (!open) {
      setSelectedSupplier("");
      setImportType("file");
      setMappingTemplate("Standard Product Catalog");
      setFile(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!selectedSupplier) {
      toast({
        title: "Missing information",
        description: "Please select a supplier.",
        variant: "destructive",
      });
      return;
    }

    if (importType === "file" && !file) {
      toast({
        title: "Missing file",
        description: "Please upload a file to import.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("supplierId", selectedSupplier);
      formData.append("mappingTemplate", mappingTemplate);
      
      if (file) {
        formData.append("file", file);
      }

      const response = await fetch("/api/imports", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/imports'] });
      
      toast({
        title: "Import started",
        description: "Your import has been queued for processing.",
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description: "There was an error starting the import. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Product Data</DialogTitle>
          <DialogDescription>
            Select a data source and file format to begin the import process.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="supplier">Supplier</Label>
            <Select
              value={selectedSupplier}
              onValueChange={setSelectedSupplier}
              disabled={suppliersLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliersLoading ? (
                  <SelectItem value="loading">Loading suppliers...</SelectItem>
                ) : (
                  suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id.toString()}>
                      {supplier.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="import-type">Import Type</Label>
            <Select value={importType} onValueChange={setImportType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="file">File Upload (CSV, Excel, etc.)</SelectItem>
                <SelectItem value="api">API Connection</SelectItem>
                <SelectItem value="ftp">FTP/SFTP</SelectItem>
                <SelectItem value="edi-ansi">EDI (ANSI X12)</SelectItem>
                <SelectItem value="edi-edifact">EDI (EDIFACT)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {importType === "file" && (
            <div className="space-y-2">
              <Label>File Upload</Label>
              <FileUploader 
                onFileSelect={setFile} 
                selectedFile={file}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="mapping-template">Data Mapping Template</Label>
            <Select value={mappingTemplate} onValueChange={setMappingTemplate}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Standard Product Catalog">Standard Product Catalog</SelectItem>
                <SelectItem value="Price & Inventory Update">Price & Inventory Update</SelectItem>
                <SelectItem value="Product Specifications Only">Product Specifications Only</SelectItem>
                <SelectItem value="Marketing Content">Marketing Content</SelectItem>
                <SelectItem value="Custom Mapping">Custom Mapping...</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Starting Import..." : "Start Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportModal;
