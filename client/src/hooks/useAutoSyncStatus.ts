import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface AutoSyncState {
  isEnabled: boolean;
  bulkJobId: string | null;
  lastJobId: string | null;
  lastCompletedTime: Date | null;
}

const AUTO_SYNC_STORAGE_KEY = 'auto-sync-state';

// Retrieve state from localStorage
const getStoredState = (): AutoSyncState => {
  try {
    const stored = localStorage.getItem(AUTO_SYNC_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...parsed,
        lastCompletedTime: parsed.lastCompletedTime ? new Date(parsed.lastCompletedTime) : null
      };
    }
  } catch (error) {
    console.warn('Failed to parse stored auto-sync state:', error);
  }
  
  return {
    isEnabled: false,
    bulkJobId: null,
    lastJobId: null,
    lastCompletedTime: null
  };
};

// Store state to localStorage
const storeState = (state: AutoSyncState) => {
  try {
    localStorage.setItem(AUTO_SYNC_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to store auto-sync state:', error);
  }
};

export const useAutoSyncStatus = () => {
  const [state, setState] = useState<AutoSyncState>(getStoredState);

  // Store state changes to localStorage
  useEffect(() => {
    storeState(state);
  }, [state]);

  // Fetch bulk job status if there's an active job
  const { data: bulkJobStatus, refetch: refetchJobStatus } = useQuery({
    queryKey: ['/api/marketplace/amazon/bulk-status', state.bulkJobId],
    queryFn: () => fetch(`/api/marketplace/amazon/bulk-status/${state.bulkJobId}`).then(res => res.json()),
    enabled: !!state.bulkJobId,
    refetchInterval: 3000, // Refresh every 3 seconds while job exists
  });

  // Check for active jobs on mount
  const { data: activeJobs } = useQuery({
    queryKey: ['/api/marketplace/amazon/bulk-jobs'],
    refetchInterval: state.isEnabled ? 5000 : false, // Check every 5 seconds if enabled
  });

  // Update state based on job status
  useEffect(() => {
    if (bulkJobStatus && typeof bulkJobStatus === 'object') {
      const status = (bulkJobStatus as any).status;
      if (status === 'completed' || status === 'failed') {
        // Job completed, update state
        setState(prev => ({
          ...prev,
          isEnabled: false,
          lastJobId: prev.bulkJobId,
          bulkJobId: null,
          lastCompletedTime: new Date()
        }));
      }
    }
  }, [bulkJobStatus]);

  // Check for active jobs and update state accordingly
  useEffect(() => {
    if (activeJobs && (activeJobs as any).jobs && Array.isArray((activeJobs as any).jobs)) {
      const jobs = (activeJobs as any).jobs;
      if (jobs.length > 0) {
        const runningJob = jobs.find((job: any) => job.status === 'running' || job.status === 'paused');
        if (runningJob && !state.bulkJobId) {
          // Found a running job but we don't have it tracked
          setState(prev => ({
            ...prev,
            isEnabled: true,
            bulkJobId: runningJob.id
          }));
        }
      } else if (jobs.length === 0 && state.bulkJobId) {
        // No active jobs but we think there's one running
        setState(prev => ({
          ...prev,
          isEnabled: false,
          bulkJobId: null,
          lastCompletedTime: new Date()
        }));
      }
    }
  }, [activeJobs, state.bulkJobId]);

  const enableAutoSync = (jobId: string) => {
    setState(prev => ({
      ...prev,
      isEnabled: true,
      bulkJobId: jobId
    }));
  };

  const disableAutoSync = () => {
    setState(prev => ({
      ...prev,
      isEnabled: false,
      bulkJobId: null
    }));
  };

  const clearState = () => {
    setState({
      isEnabled: false,
      bulkJobId: null,
      lastJobId: null,
      lastCompletedTime: null
    });
    localStorage.removeItem(AUTO_SYNC_STORAGE_KEY);
  };

  return {
    isEnabled: state.isEnabled,
    bulkJobId: state.bulkJobId,
    lastJobId: state.lastJobId,
    lastCompletedTime: state.lastCompletedTime,
    bulkJobStatus,
    enableAutoSync,
    disableAutoSync,
    clearState,
    refetchJobStatus
  };
};