import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { useApprovals } from "@/hooks/useApprovals";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";

const PendingApprovals = () => {
  const { approvals, isLoading } = useApprovals();

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

  return (
    <Card>
      <div className="px-4 py-5 sm:px-6 border-b border-neutral-200">
        <h3 className="text-lg leading-6 font-medium text-neutral-900">Pending Approvals</h3>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">Items requiring review and approval</p>
      </div>
      <div className="divide-y divide-neutral-200 max-h-80 overflow-y-auto">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="px-4 py-4 sm:px-6">
              <Skeleton className="h-4 w-2/3 mb-2" />
              <Skeleton className="h-4 w-3/4 mb-4" />
              <div className="flex space-x-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          ))
        ) : approvals.length === 0 ? (
          <div className="px-4 py-4 sm:px-6 text-center text-neutral-500">
            No pending approvals
          </div>
        ) : (
          approvals.map((approval) => (
            <div key={approval.id} className="px-4 py-4 sm:px-6 hover:bg-neutral-50">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-primary truncate">{approval.title}</p>
                <div className="ml-2 flex-shrink-0 flex">
                  <p className="text-xs text-neutral-500">
                    {formatDistanceToNow(new Date(approval.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <div className="mt-2">
                <p className="text-sm text-neutral-700">{approval.description}</p>
              </div>
              <div className="mt-3 flex">
                <Button 
                  size="sm" 
                  onClick={() => handleApprovalAction(approval.id, "approve")}
                >
                  Review
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="ml-3"
                  onClick={() => handleApprovalAction(approval.id, "postpone")}
                >
                  Postpone
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="px-4 py-4 sm:px-6 bg-neutral-50 rounded-b-lg">
        <a href="#" className="text-sm font-medium text-primary hover:text-primary-dark">
          View all approvals <span aria-hidden="true">&rarr;</span>
        </a>
      </div>
    </Card>
  );
};

export default PendingApprovals;
