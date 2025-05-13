import { ChangeEvent, useState, useRef } from "react";
import { Upload, File, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileUploaderProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
}

const FileUploader = ({ onFileSelect, selectedFile }: FileUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  const removeFile = () => {
    onFileSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div>
      {!selectedFile ? (
        <div
          className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 ${
            isDragging ? "border-primary border-dashed bg-primary/5" : "border-neutral-300 border-dashed"
          } rounded-md`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="space-y-1 text-center">
            <Upload className="mx-auto h-12 w-12 text-neutral-400" />
            <div className="flex text-sm text-neutral-600">
              <label
                htmlFor="file-upload"
                className="relative cursor-pointer bg-white rounded-md font-medium text-primary hover:text-primary-dark focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary"
              >
                <span>Upload a file</span>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  className="sr-only"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  accept=".csv,.xlsx,.xls,.json,.xml"
                />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs text-neutral-500">
              CSV, Excel, XML, or JSON up to 10MB
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-1 flex items-center justify-between bg-neutral-50 p-3 border border-neutral-200 rounded-md">
          <div className="flex items-center">
            <File className="h-6 w-6 text-neutral-500 mr-2" />
            <span className="text-sm font-medium text-neutral-900 truncate max-w-[200px]">
              {selectedFile.name}
            </span>
            <span className="ml-2 text-xs text-neutral-500">
              ({(selectedFile.size / 1024).toFixed(1)} KB)
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={removeFile}
            className="text-neutral-500 hover:text-neutral-700"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default FileUploader;
