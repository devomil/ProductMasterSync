import { useState } from "react";
import { Link } from "wouter";
import { Clock, Building2, Package2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useImports } from "@/hooks/useImports";
import { formatDistanceToNow } from "date-fns";

const ImportActivity = () => {
  const [activeTab, setActiveTab] = useState("imports");
  const { imports, isLoading } = useImports();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge variant="success">Success</Badge>;
      case "processing":
        return <Badge variant="warning">Processing</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const getTimeText = (date?: Date | null) => {
    if (!date) return "";
    return `${date.getTime() > new Date().getTime() ? "Starts" : "Completed"} ${formatDistanceToNow(date, { addSuffix: true })}`;
  };

  return (
    <div className="mt-10">
      <h2 className="text-lg font-medium text-neutral-900">Recent Activity</h2>
      
      <Tabs defaultValue="imports" className="mt-4">
        <div className="sm:hidden">
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="block w-full pl-3 pr-10 py-2 text-base border-neutral-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
          >
            <option value="imports">Imports</option>
            <option value="exports">Exports</option>
            <option value="workflow">Workflow Actions</option>
          </select>
        </div>
        <div className="hidden sm:block">
          <TabsList className="border-b border-neutral-200 w-full justify-start">
            <TabsTrigger value="imports" className="rounded-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=inactive]:border-transparent data-[state=inactive]:text-neutral-500 data-[state=inactive]:hover:text-neutral-700 data-[state=inactive]:hover:border-neutral-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
              Imports
            </TabsTrigger>
            <TabsTrigger value="exports" className="rounded-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=inactive]:border-transparent data-[state=inactive]:text-neutral-500 data-[state=inactive]:hover:text-neutral-700 data-[state=inactive]:hover:border-neutral-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
              Exports
            </TabsTrigger>
            <TabsTrigger value="workflow" className="rounded-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=inactive]:border-transparent data-[state=inactive]:text-neutral-500 data-[state=inactive]:hover:text-neutral-700 data-[state=inactive]:hover:border-neutral-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
              Workflow Actions
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="imports" className="mt-6 bg-white shadow overflow-hidden sm:rounded-md">
          {isLoading ? (
            <div className="p-6 text-center">Loading imports...</div>
          ) : (
            <ul role="list" className="divide-y divide-neutral-200">
              {imports.map((importItem) => (
                <li key={importItem.id}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <p className="text-sm font-medium text-primary truncate">{importItem.filename}</p>
                        <div className="ml-2 flex-shrink-0 flex">
                          {getStatusBadge(importItem.status)}
                        </div>
                      </div>
                      <div className="ml-2 flex-shrink-0 flex">
                        <p className="text-sm text-neutral-500">
                          {importItem.status === "processing" 
                            ? "Started " + formatDistanceToNow(new Date(importItem.createdAt || new Date()), { addSuffix: true }) 
                            : getTimeText(importItem.completedAt ? new Date(importItem.completedAt) : null)
                          }
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex">
                        <p className="flex items-center text-sm text-neutral-500">
                          <Building2 className="flex-shrink-0 mr-1.5 h-4 w-4 text-neutral-400" />
                          {importItem.supplierId === 1 ? "ABC Trading Co." : 
                           importItem.supplierId === 2 ? "XYZ Supplies Inc." :
                           importItem.supplierId === 3 ? "Global Supplies Ltd." :
                           importItem.supplierId === 4 ? "West Coast Distributors" : "Unknown Supplier"}
                        </p>
                        <p className="mt-2 flex items-center text-sm text-neutral-500 sm:mt-0 sm:ml-6">
                          <Package2 className="flex-shrink-0 mr-1.5 h-4 w-4 text-neutral-400" />
                          {importItem.recordCount} products
                        </p>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-neutral-500 sm:mt-0">
                        {importItem.status === "processing" ? (
                          <div className="w-24 bg-neutral-200 rounded-full h-2.5">
                            <div 
                              className="bg-primary h-2.5 rounded-full" 
                              style={{ 
                                width: `${Math.round(((importItem.processedCount || 0) / (importItem.recordCount || 1)) * 100)}%` 
                              }}
                            ></div>
                          </div>
                        ) : (
                          <Button variant="ghost" className="text-primary bg-primary-light bg-opacity-10 hover:bg-opacity-20">
                            View Details
                          </Button>
                        )}
                      </div>
                    </div>
                    {importItem.status === "error" && importItem.importErrors && 
                      Array.isArray(importItem.importErrors) && importItem.importErrors.length > 0 && (
                      <div className="mt-2 flex items-center text-sm text-red-500">
                        <AlertTriangle className="flex-shrink-0 mr-1.5 h-4 w-4 text-red-500" />
                        {importItem.importErrors[0]?.message || "Unknown error"}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
        
        <TabsContent value="exports" className="mt-6">
          <div className="bg-white shadow overflow-hidden sm:rounded-md p-6 text-center text-neutral-500">
            No recent exports.
          </div>
        </TabsContent>
        
        <TabsContent value="workflow" className="mt-6">
          <div className="bg-white shadow overflow-hidden sm:rounded-md p-6 text-center text-neutral-500">
            No recent workflow actions.
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-5">
        <Link href="/data-imports">
          <span className="text-sm font-medium text-primary hover:text-primary-dark cursor-pointer">
            View all import activity <span aria-hidden="true">&rarr;</span>
          </span>
        </Link>
      </div>
    </div>
  );
};

export default ImportActivity;
