import { useQuery } from "@tanstack/react-query";
import { Approval } from "@shared/schema";

export function useApprovals() {
  const {
    data: approvals = [],
    isLoading,
    isError,
    error,
  } = useQuery<Approval[]>({
    queryKey: ['/api/approvals'],
  });

  // Filter to only get pending approvals
  const pendingApprovals = approvals.filter(approval => approval.status === 'pending');

  return {
    approvals: pendingApprovals,
    allApprovals: approvals,
    isLoading,
    isError,
    error,
  };
}
