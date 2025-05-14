/**
 * Scheduler Utility
 * 
 * Provides functionality to schedule and run recurring tasks
 */

import { batchSyncAmazonData } from '../marketplace/amazon-service';

// Store scheduled jobs
interface ScheduledJob {
  id: string;
  name: string;
  interval: number;  // Milliseconds
  lastRun: number;   // Timestamp
  isRunning: boolean;
  fn: () => Promise<any>;
  timeout: NodeJS.Timeout | null;
}

class Scheduler {
  private jobs: Map<string, ScheduledJob> = new Map();
  
  /**
   * Add a new scheduled job
   * @param id Unique identifier for the job
   * @param name Human-readable name for the job
   * @param intervalMinutes Interval in minutes between executions
   * @param fn Function to execute
   */
  public addJob(id: string, name: string, intervalMinutes: number, fn: () => Promise<any>): void {
    if (this.jobs.has(id)) {
      this.removeJob(id);
    }
    
    const job: ScheduledJob = {
      id,
      name,
      interval: intervalMinutes * 60 * 1000,
      lastRun: 0,
      isRunning: false,
      fn,
      timeout: null
    };
    
    this.jobs.set(id, job);
    this.scheduleNextRun(job);
    
    console.log(`Scheduled job "${name}" (${id}) to run every ${intervalMinutes} minutes`);
  }
  
  /**
   * Remove a scheduled job
   * @param id Job identifier
   */
  public removeJob(id: string): void {
    const job = this.jobs.get(id);
    if (job && job.timeout) {
      clearTimeout(job.timeout);
      this.jobs.delete(id);
      console.log(`Removed scheduled job "${job.name}" (${id})`);
    }
  }
  
  /**
   * Get all scheduled jobs
   */
  public getJobs(): Array<Pick<ScheduledJob, 'id' | 'name' | 'interval' | 'lastRun' | 'isRunning'>> {
    return Array.from(this.jobs.values()).map(({ id, name, interval, lastRun, isRunning }) => ({
      id,
      name,
      interval,
      lastRun,
      isRunning
    }));
  }
  
  /**
   * Schedule the next run of a job
   * @param job Job to schedule
   */
  private scheduleNextRun(job: ScheduledJob): void {
    if (job.timeout) {
      clearTimeout(job.timeout);
    }
    
    const now = Date.now();
    const timeSinceLastRun = now - job.lastRun;
    let nextRunDelay = Math.max(0, job.interval - timeSinceLastRun);
    
    // If it's never run before or it should have run already, run it soon
    if (job.lastRun === 0 || nextRunDelay === 0) {
      nextRunDelay = 5000; // Wait 5 seconds for first run to allow system to stabilize
    }
    
    job.timeout = setTimeout(() => this.runJob(job), nextRunDelay);
  }
  
  /**
   * Execute a job
   * @param job Job to run
   */
  private async runJob(job: ScheduledJob): Promise<void> {
    // Don't run if already running
    if (job.isRunning) {
      this.scheduleNextRun(job);
      return;
    }
    
    job.isRunning = true;
    job.lastRun = Date.now();
    
    console.log(`Running scheduled job "${job.name}" (${job.id}) at ${new Date().toISOString()}`);
    
    try {
      const result = await job.fn();
      console.log(`Completed job "${job.name}" (${job.id}):`, result);
    } catch (error) {
      console.error(`Error in scheduled job "${job.name}" (${job.id}):`, error);
    } finally {
      job.isRunning = false;
      this.scheduleNextRun(job);
    }
  }
  
  /**
   * Manually trigger a job to run immediately
   * @param id Job identifier
   */
  public async triggerJob(id: string): Promise<any> {
    const job = this.jobs.get(id);
    if (!job) {
      throw new Error(`Job with ID ${id} not found`);
    }
    
    if (job.isRunning) {
      throw new Error(`Job "${job.name}" is already running`);
    }
    
    // Clear any existing timeout
    if (job.timeout) {
      clearTimeout(job.timeout);
      job.timeout = null;
    }
    
    // Run the job and reschedule
    job.isRunning = true;
    job.lastRun = Date.now();
    
    try {
      const result = await job.fn();
      return result;
    } catch (error) {
      console.error(`Error manually triggering job "${job.name}" (${job.id}):`, error);
      throw error;
    } finally {
      job.isRunning = false;
      this.scheduleNextRun(job);
    }
  }
}

// Singleton instance
export const scheduler = new Scheduler();

/**
 * Initialize scheduled jobs
 */
export function initializeScheduledJobs(): void {
  // Amazon sync job - run every 30 minutes
  scheduler.addJob(
    'amazon-sync',
    'Amazon Marketplace Data Sync',
    30,
    async () => {
      try {
        // Process 5 products at a time to avoid overloading the system
        const result = await batchSyncAmazonData(5);
        return result;
      } catch (error) {
        console.error('Failed to run Amazon sync job:', error);
        throw error;
      }
    }
  );
  
  // Add more scheduled jobs as needed
}