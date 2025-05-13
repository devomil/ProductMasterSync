import { useState } from "react";
import { 
  CheckSquare, 
  X,
  Clock,
  User,
  Filter,
  Search,
  ListFilter,
  ArrowUpDown,
  MoreHorizontal,
  Eye,
  Check,
  Ban
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApprovals } from "@/hooks/useApprovals";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const Approvals = () => {
  const { allApprovals, isLoading } = useApprovals();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Filter approvals based on search query and status filter
  const filteredApprovals = allApprovals.filter(approval => {
    const matchesSearch = approval.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      approval.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || approval.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleApprovalAction = async (id: number, action: "approve" | "reject" | "postpone") => {
    try {
      await apiRequest("PUT", `/api/approvals/${id}`, { action });
      
      queryClient.invalidateQueries({ queryKey: ['/api/approvals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/statistics'] });
      
      toast({
        title: "Approval updated",
        description: `The approval request has been ${action === "postpone" ? "postponed" : action + "d"}.`,
      });
    } catch (error) {
      console.error("Failed to update approval:", error);
      toast({
        title: "Error",
        description: "Failed to update the approval request.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge variant="success">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="warning">Pending</Badge>;
    }
  };

  return (
    <>
      <div className="pb-5 border-b border-neutral-200 sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Approval Workflows</h1>
      </div>

      <div className="mt-6">
        <Tabs defaultValue="pending">
          <div className="flex justify-between flex-col sm:flex-row">
            <TabsList>
              <TabsTrigger value="pending" onClick={() => setStatusFilter("pending")}>Pending</TabsTrigger>
              <TabsTrigger value="approved" onClick={() => setStatusFilter("approved")}>Approved</TabsTrigger>
              <TabsTrigger value="rejected" onClick={() => setStatusFilter("rejected")}>Rejected</TabsTrigger>
              <TabsTrigger value="all" onClick={() => setStatusFilter("all")}>All Requests</TabsTrigger>
            </TabsList>

            <div className="flex space-x-2 mt-3 sm:mt-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
                <Input 
                  type="search" 
                  placeholder="Search approvals"
                  className="pl-9 w-full sm:w-64" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Filter
              </Button>
            </div>
          </div>

          <TabsContent value="pending" className="mt-6">
            <ApprovalTable 
              approvals={filteredApprovals.filter(a => a.status === "pending")} 
              isLoading={isLoading} 
              handleApprovalAction={handleApprovalAction}
              showActionButtons={true}
            />
          </TabsContent>
          
          <TabsContent value="approved" className="mt-6">
            <ApprovalTable 
              approvals={filteredApprovals.filter(a => a.status === "approved")} 
              isLoading={isLoading} 
              handleApprovalAction={handleApprovalAction}
              showActionButtons={false}
            />
          </TabsContent>
          
          <TabsContent value="rejected" className="mt-6">
            <ApprovalTable 
              approvals={filteredApprovals.filter(a => a.status === "rejected")} 
              isLoading={isLoading} 
              handleApprovalAction={handleApprovalAction}
              showActionButtons={false}
            />
          </TabsContent>
          
          <TabsContent value="all" className="mt-6">
            <ApprovalTable 
              approvals={filteredApprovals} 
              isLoading={isLoading} 
              handleApprovalAction={handleApprovalAction}
              showActionButtons={false}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

interface ApprovalTableProps {
  approvals: any[];
  isLoading: boolean;
  handleApprovalAction: (id: number, action: "approve" | "reject" | "postpone") => Promise<void>;
  showActionButtons: boolean;
}

const ApprovalTable = ({ approvals, isLoading, handleApprovalAction, showActionButtons }: ApprovalTableProps) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge variant="success">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="warning">Pending</Badge>;
    }
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">
                <div className="flex items-center">
                  Request
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </div>
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requestor</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : approvals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-neutral-500">
                  No approval requests found
                </TableCell>
              </TableRow>
            ) : (
              approvals.map((approval) => (
                <TableRow key={approval.id}>
                  <TableCell>
                    <div className="font-medium">{approval.title}</div>
                    <div className="text-sm text-neutral-500 truncate max-w-xs">
                      {approval.description}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{approval.type}</TableCell>
                  <TableCell>{getStatusBadge(approval.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <User className="h-4 w-4 mr-1 text-neutral-400" />
                      <span>User {approval.requestedBy}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1 text-neutral-400" />
                      {formatDistanceToNow(new Date(approval.createdAt), { addSuffix: true })}
                    </div>
                  </TableCell>
                  <TableCell>
                    {approval.updatedAt && (
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1 text-neutral-400" />
                        {formatDistanceToNow(new Date(approval.updatedAt), { addSuffix: true })}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {showActionButtons && approval.status === 'pending' ? (
                      <div className="flex justify-end space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-green-600"
                          onClick={() => handleApprovalAction(approval.id, "approve")}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-red-600"
                          onClick={() => handleApprovalAction(approval.id, "reject")}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          {approval.status === 'pending' && (
                            <>
                              <DropdownMenuItem onClick={() => handleApprovalAction(approval.id, "approve")}>
                                <Check className="mr-2 h-4 w-4 text-green-600" />
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleApprovalAction(approval.id, "reject")}>
                                <X className="mr-2 h-4 w-4 text-red-600" />
                                Reject
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Approvals;