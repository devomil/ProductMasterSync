import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Download, Tag, FolderPlus, Clock } from "lucide-react";
import ImportModal from "@/components/imports/ImportModal";

const QuickActions = () => {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  return (
    <>
      <Card>
        <div className="px-4 py-5 sm:px-6 border-b border-neutral-200">
          <h3 className="text-lg leading-6 font-medium text-neutral-900">Quick Actions</h3>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">Common tasks and operations</p>
        </div>
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Button 
                className="w-full"
                onClick={() => setIsImportModalOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                New Data Import
              </Button>
            </div>
            <div>
              <Button variant="outline" className="w-full">
                <Upload className="mr-2 h-4 w-4 text-neutral-500" />
                Upload File
              </Button>
            </div>
            <div>
              <Button variant="outline" className="w-full">
                <Download className="mr-2 h-4 w-4 text-neutral-500" />
                Export Data
              </Button>
            </div>
            <div>
              <Button variant="outline" className="w-full">
                <Tag className="mr-2 h-4 w-4 text-neutral-500" />
                Create Attribute
              </Button>
            </div>
            <div>
              <Button variant="outline" className="w-full">
                <FolderPlus className="mr-2 h-4 w-4 text-neutral-500" />
                Add Category
              </Button>
            </div>
          </div>
          
          <div className="mt-6">
            <h4 className="text-sm font-medium text-neutral-900">Scheduled Tasks</h4>
            <ul className="mt-3 divide-y divide-neutral-200">
              <li className="py-3 flex justify-between items-center">
                <div className="flex items-center">
                  <Clock className="text-neutral-400 mr-2 h-4 w-4" />
                  <span className="text-sm text-neutral-900">Daily Supplier API Sync</span>
                </div>
                <span className="text-sm text-neutral-500">11:00 PM</span>
              </li>
              <li className="py-3 flex justify-between items-center">
                <div className="flex items-center">
                  <Clock className="text-neutral-400 mr-2 h-4 w-4" />
                  <span className="text-sm text-neutral-900">Weekly Data Quality Report</span>
                </div>
                <span className="text-sm text-neutral-500">Mon, 9:00 AM</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="px-4 py-4 sm:px-6 bg-neutral-50 rounded-b-lg">
          <a href="#" className="text-sm font-medium text-primary hover:text-primary-dark">
            Manage scheduled tasks <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </Card>

      <ImportModal open={isImportModalOpen} onOpenChange={setIsImportModalOpen} />
    </>
  );
};

export default QuickActions;
