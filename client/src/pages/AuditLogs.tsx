import { useState } from "react";
import { 
  History, 
  Search, 
  Filter, 
  Calendar,
  User,
  Clock,
  Package2,
  Building2,
  FolderTree,
  Upload,
  Download,
  Check,
  X,
  FileText,
  Eye,
  ArrowUpDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

// Sample audit logs
const auditLogs = [
  {
    id: 1,
    action: "create",
    entityType: "product",
    entityId: 12345,
    userId: 1,
    details: { product: { id: 12345, name: "Wireless Headphones", sku: "WL-HD-001" } },
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
  },
  {
    id: 2,
    action: "update",
    entityType: "supplier",
    entityId: 42,
    userId: 2,
    details: { 
      before: { name: "Tech Supplies Inc.", active: true }, 
      after: { name: "Tech Supplies Corporation", active: true }
    },
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: 3,
    action: "approve",
    entityType: "approval",
    entityId: 89,
    userId: 1,
    details: { 
      before: { status: "pending" }, 
      after: { status: "approved" }
    },
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
  },
  {
    id: 4,
    action: "delete",
    entityType: "product",
    entityId: 10045,
    userId: 3,
    details: { 
      product: { id: 10045, name: "Discontinued Item", sku: "DISC-001" }
    },
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
  },
  {
    id: 5,
    action: "create",
    entityType: "import",
    entityId: 56,
    userId: 2,
    details: { import: { id: 56, filename: "New-Products-Batch.csv", supplierId: 3 } },
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    id: 6,
    action: "create",
    entityType: "category",
    entityId: 78,
    userId: 1,
    details: { category: { id: 78, name: "Smart Home", code: "SMH" } },
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: 7,
    action: "update",
    entityType: "product",
    entityId: 5321,
    userId: 3,
    details: { 
      before: { price: 49.99, stock: 120 }, 
      after: { price: 45.99, stock: 200 }
    },
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
];

const AuditLogs = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);

  // Filter audit logs based on search query and date
  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entityType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(log.entityId).includes(searchQuery);
    
    const matchesDate = !date || (
      log.timestamp.getDate() === date.getDate() &&
      log.timestamp.getMonth() === date.getMonth() &&
      log.timestamp.getFullYear() === date.getFullYear()
    );
    
    return matchesSearch && matchesDate;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case "create":
        return <Badge variant="success">Create</Badge>;
      case "update":
        return <Badge variant="warning">Update</Badge>;
      case "delete":
        return <Badge variant="destructive">Delete</Badge>;
      case "approve":
        return <Badge variant="success">Approve</Badge>;
      case "reject":
        return <Badge variant="destructive">Reject</Badge>;
      default:
        return <Badge variant="secondary">{action}</Badge>;
    }
  };

  const getEntityTypeIcon = (entityType: string) => {
    switch (entityType) {
      case "product":
        return <Package2 className="h-4 w-4 text-blue-500" />;
      case "supplier":
        return <Building2 className="h-4 w-4 text-purple-500" />;
      case "category":
        return <FolderTree className="h-4 w-4 text-teal-500" />;
      case "import":
        return <Upload className="h-4 w-4 text-amber-500" />;
      case "export":
        return <Download className="h-4 w-4 text-green-500" />;
      case "approval":
        return <Check className="h-4 w-4 text-green-500" />;
      default:
        return <FileText className="h-4 w-4 text-neutral-500" />;
    }
  };

  const getUserName = (userId: number) => {
    // In a real app, we would fetch user names from a users database
    return `User ${userId}`;
  };

  const getEntityDetails = (log: any) => {
    if (log.action === "create") {
      const entity = log.details[log.entityType];
      return entity && entity.name ? entity.name : `${log.entityType} #${log.entityId}`;
    } else if (log.action === "update") {
      return `${log.entityType} #${log.entityId}`;
    } else if (log.action === "delete") {
      const entity = log.details[log.entityType];
      return entity && entity.name ? entity.name : `${log.entityType} #${log.entityId}`;
    } else {
      return `${log.entityType} #${log.entityId}`;
    }
  };

  return (
    <>
      <div className="pb-5 border-b border-neutral-200 sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Audit Logs</h1>
        <div className="mt-3 sm:mt-0 sm:ml-4">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Logs
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
            <Input 
              type="search" 
              placeholder="Search audit logs"
              className="pl-9" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex space-x-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={date ? "text-primary" : ""}>
                  <Calendar className="mr-2 h-4 w-4" />
                  {date ? date.toLocaleDateString() : "Filter by Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            
            {date && (
              <Button variant="ghost" size="sm" onClick={() => setDate(undefined)}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
            
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              More Filters
            </Button>
          </div>
        </div>

        <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-md">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">
                    <div className="flex items-center">
                      Action
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[180px]">Entity</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>
                    <div className="flex items-center">
                      Timestamp
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-neutral-500">
                      {searchQuery || date ? "No audit logs matching your filters" : "No audit logs available"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getEntityTypeIcon(log.entityType)}
                          <span className="capitalize">{log.entityType}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm truncate max-w-xs">
                          {getEntityDetails(log)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-1 text-neutral-400" />
                          <span>{getUserName(log.userId)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1 text-neutral-400" />
                          {formatDistanceToNow(log.timestamp, { addSuffix: true })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  );
};

export default AuditLogs;