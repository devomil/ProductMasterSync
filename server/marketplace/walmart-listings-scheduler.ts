/**
 * Walmart Listings Scheduler
 * 
 * Manages automated syncing of Walmart listings twice daily
 * Default schedule: 6:00 AM and 6:00 PM (every 12 hours)
 */

import { startWalmartListingsSync, isSyncRunning } from './walmart-listings-sync';
import * as listingsRepo from './listings-repository';

interface SchedulerState {
  active: boolean;
  intervalId: NodeJS.Timeout | null;
  lastRun: number | null;
  nextRun: number | null;
  isRunning: boolean;
  intervalMs: number;
  lastJobId: number | null;
}

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

const state: SchedulerState = {
  active: false,
  intervalId: null,
  lastRun: null,
  nextRun: null,
  isRunning: false,
  intervalMs: TWELVE_HOURS_MS,
  lastJobId: null
};

const log = (message: string) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Walmart Listings Scheduler] ${message}`);
};

async function checkWalmartCredentials(): Promise<boolean> {
  try {
    const { getWalmartConfig } = await import('../utils/walmart-api');
    const config = await getWalmartConfig();
    return !!(config.clientId && config.clientSecret);
  } catch (error) {
    return false;
  }
}

async function runScheduledSync(): Promise<void> {
  const syncInProgress = await isSyncRunning();
  if (syncInProgress || state.isRunning) {
    log('Sync already in progress (checked via isSyncRunning), skipping scheduled run');
    return;
  }

  try {
    state.isRunning = true;
    log('Starting scheduled Walmart listings sync');

    const job = await listingsRepo.createMarketplaceSyncJob({
      marketplace: 'walmart',
      jobType: 'full_catalog',
      status: 'pending',
      totalItems: 0,
      processedItems: 0,
      successItems: 0,
      failedItems: 0,
      triggeredBy: 'scheduler'
    });

    state.lastJobId = job.id;
    state.lastRun = Date.now();
    state.nextRun = Date.now() + state.intervalMs;

    await startWalmartListingsSync(job.id);

    log(`Scheduled sync completed (Job ID: ${job.id})`);
  } catch (error) {
    log(`Error during scheduled sync: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    state.isRunning = false;
  }
}

export async function initWalmartListingsScheduler(): Promise<void> {
  if (state.active) {
    log('Scheduler already active');
    return;
  }

  const hasCredentials = await checkWalmartCredentials();
  if (!hasCredentials) {
    log('Walmart API credentials not configured, scheduler not started');
    return;
  }

  log('Initializing Walmart listings scheduler (every 12 hours)');

  state.nextRun = Date.now() + state.intervalMs;

  state.intervalId = setInterval(async () => {
    try {
      await runScheduledSync();
    } catch (error) {
      log(`Scheduler error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, state.intervalMs);

  state.active = true;
  log('Scheduler started - next run in 12 hours');
}

export async function stopWalmartListingsScheduler(): Promise<void> {
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  state.active = false;
  state.nextRun = null;
  log('Scheduler stopped');
}

export async function triggerManualSync(): Promise<{ success: boolean; jobId: number; message: string }> {
  const syncInProgress = await isSyncRunning();
  if (syncInProgress || state.isRunning) {
    return {
      success: false,
      jobId: state.lastJobId || 0,
      message: 'Sync already in progress'
    };
  }

  const hasCredentials = await checkWalmartCredentials();
  if (!hasCredentials) {
    return {
      success: false,
      jobId: 0,
      message: 'Walmart API credentials not configured'
    };
  }

  try {
    state.isRunning = true;
    log('Starting manual Walmart listings sync');

    const job = await listingsRepo.createMarketplaceSyncJob({
      marketplace: 'walmart',
      jobType: 'full_catalog',
      status: 'pending',
      totalItems: 0,
      processedItems: 0,
      successItems: 0,
      failedItems: 0,
      triggeredBy: 'manual'
    });

    state.lastJobId = job.id;
    state.lastRun = Date.now();

    startWalmartListingsSync(job.id).finally(() => {
      state.isRunning = false;
    });

    return {
      success: true,
      jobId: job.id,
      message: 'Walmart listings sync started'
    };
  } catch (error) {
    state.isRunning = false;
    return {
      success: false,
      jobId: 0,
      message: `Failed to start sync: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export async function getSchedulerStatus(): Promise<{
  active: boolean;
  details: {
    lastRun: number | null;
    nextRun: number | null;
    isRunning: boolean;
    interval: number;
    lastJobId: number | null;
  } | null;
}> {
  // Get last completed full_catalog sync job from database for persistent Last Run
  let lastRunFromDb: number | null = null;
  let lastJobIdFromDb: number | null = null;
  
  try {
    // Only get full_catalog jobs (listings sync), not pricing_insights
    const recentJobs = await listingsRepo.getRecentSyncJobs('walmart', 10);
    const fullCatalogJob = recentJobs.find(job => job.jobType === 'full_catalog');
    if (fullCatalogJob) {
      if (fullCatalogJob.completedAt) {
        lastRunFromDb = new Date(fullCatalogJob.completedAt).getTime();
      } else if (fullCatalogJob.createdAt) {
        lastRunFromDb = new Date(fullCatalogJob.createdAt).getTime();
      }
      lastJobIdFromDb = fullCatalogJob.id;
    }
  } catch (error) {
    log(`Error fetching last sync job: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Use in-memory state for isRunning (more reliable than DB query every time)
  const isRunning = state.isRunning;

  if (!state.active) {
    return { 
      active: false, 
      details: {
        lastRun: lastRunFromDb,
        nextRun: null,
        isRunning: isRunning,
        interval: state.intervalMs,
        lastJobId: lastJobIdFromDb
      }
    };
  }

  return {
    active: true,
    details: {
      lastRun: state.lastRun || lastRunFromDb,
      nextRun: state.nextRun,
      isRunning: isRunning,
      interval: state.intervalMs,
      lastJobId: state.lastJobId || lastJobIdFromDb
    }
  };
}

export async function updateSchedulerInterval(intervalHours: number): Promise<void> {
  state.intervalMs = intervalHours * 60 * 60 * 1000;
  
  if (state.active) {
    await stopWalmartListingsScheduler();
    await initWalmartListingsScheduler();
  }
  
  log(`Scheduler interval updated to ${intervalHours} hours`);
}
