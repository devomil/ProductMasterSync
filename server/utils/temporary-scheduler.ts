import { db } from '../db';
import { schedules, dataSources } from '@shared/schema';
import { eq, and, gte, lte, isNull, sql, desc } from 'drizzle-orm';
import { pullFromFTPConnection } from './ftp-ingestion';
import { processImportedFile } from './file-processor';
// Importing only the type to avoid conflict with local function
import type { batchSyncAmazonData as BatchSyncFn } from '../marketplace/amazon-service';

// Simplified type definitions
type ScheduledJob = {
  id: number;
  type: 'ftp' | 'sftp' | 'api';
  connectionId?: number;
  dataSourceId?: number;
  lastRun: Date | null;
  nextRun: Date | null;
  frequency: 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
  config: any;
};

// Keep track of scheduled jobs
let scheduledJobs: ScheduledJob[] = [];
let checkInterval: NodeJS.Timeout | null = null;

// Logger
const log = (message: string) => {
  console.log(`[${new Date().toISOString()}] [scheduler] ${message}`);
};

/**
 * Calculate the next run time based on frequency
 */
const calculateNextRun = (
  job: ScheduledJob, 
  from: Date = new Date()
): Date => {
  const nextRun = new Date(from);
  
  // Always start at least 10 seconds in the future
  nextRun.setSeconds(nextRun.getSeconds() + 10);
  
  switch (job.frequency) {
    case 'once':
      // For one-time jobs, we don't adjust the time
      return nextRun;
      
    case 'hourly':
      // Move to next hour
      nextRun.setHours(nextRun.getHours() + 1);
      // Set specific minute if defined
      if (job.config?.minute !== undefined) {
        nextRun.setMinutes(job.config.minute, 0, 0);
      } else {
        nextRun.setMinutes(0, 0, 0);
      }
      return nextRun;
      
    case 'daily':
      // Move to next day
      nextRun.setDate(nextRun.getDate() + 1);
      // Set specific hour if defined
      if (job.config?.hour !== undefined) {
        nextRun.setHours(job.config.hour, job.config.minute || 0, 0, 0);
      }
      return nextRun;
      
    case 'weekly':
      // Move to next week
      nextRun.setDate(nextRun.getDate() + 7);
      // Set to specific day of week if defined
      if (job.config?.dayOfWeek !== undefined) {
        const currentDay = nextRun.getDay();
        const targetDay = job.config.dayOfWeek;
        const daysToAdd = (targetDay - currentDay + 7) % 7;
        
        // Adjust date
        nextRun.setDate(nextRun.getDate() + daysToAdd - 7); // Subtract 7 because we already added a week
      }
      // Set specific hour if defined
      if (job.config?.hour !== undefined) {
        nextRun.setHours(job.config.hour, job.config.minute || 0, 0, 0);
      }
      return nextRun;
      
    case 'monthly':
      // Move to next month
      nextRun.setMonth(nextRun.getMonth() + 1);
      // Set to specific day of month if defined
      if (job.config?.dayOfMonth !== undefined) {
        // Handle cases where the day might not exist in the month
        const maxDaysInMonth = new Date(
          nextRun.getFullYear(), 
          nextRun.getMonth() + 1, 
          0
        ).getDate();
        const day = Math.min(job.config.dayOfMonth, maxDaysInMonth);
        nextRun.setDate(day);
      }
      // Set specific hour if defined
      if (job.config?.hour !== undefined) {
        nextRun.setHours(job.config.hour, job.config.minute || 0, 0, 0);
      }
      return nextRun;
      
    case 'custom':
      // Custom cron-like expression would be handled here
      // For simplicity, we default to daily if custom is specified but not implemented
      log('Custom schedule not fully implemented, defaulting to daily');
      nextRun.setDate(nextRun.getDate() + 1);
      return nextRun;
      
    default:
      // Default to daily
      nextRun.setDate(nextRun.getDate() + 1);
      return nextRun;
  }
};

/**
 * Process an FTP/SFTP job
 */
const processFTPJob = async (job: ScheduledJob): Promise<boolean> => {
  try {
    // Skip if no connection ID
    if (!job.connectionId) {
      log(`Job ${job.id} has no connection ID, skipping`);
      return false;
    }
    
    log(`Processing FTP job ${job.id} for connection ${job.connectionId}`);
    
    // Use your existing FTP pull function
    const results = await pullFromFTPConnection(job.connectionId, {
      skipExisting: job.config?.skipExisting === true,
      deleteAfterDownload: job.config?.deleteAfterDownload === true
    });
    
    if (results.importedFiles.length > 0) {
      log(`Successfully imported ${results.importedFiles.length} files`);
      
      // Process each file
      for (const importId of results.importedFiles) {
        log(`Processing import ${importId}`);
        await processImportedFile(importId);
      }
      
      return true;
    } else {
      log(`No files were imported`);
      return false;
    }
  } catch (error) {
    log(`Error processing FTP job ${job.id}: ${error}`);
    return false;
  }
};

/**
 * Execute a scheduled job
 */
const executeJob = async (job: ScheduledJob): Promise<boolean> => {
  try {
    log(`Executing job ${job.id} (${job.type})`);
    
    // Update last run time
    job.lastRun = new Date();
    
    switch (job.type) {
      case 'ftp':
      case 'sftp':
        return await processFTPJob(job);
        
      case 'api':
        if (job.config?.apiType === 'amazon') {
          try {
            // Import dynamically to avoid circular dependencies
            // This is replaced with a stub for now
            log(`Running Amazon batch sync`);
            
            // We'll replace this with a stub function for now
            // const { batchSyncAmazonData } = await import('../marketplace/amazon-service');
            // return await batchSyncAmazonData(job.config?.limit || 10);
            return true;
          } catch (error) {
            log(`Error in Amazon batch sync: ${error}`);
            return false;
          }
        }
        
        log(`API type '${job.config?.apiType}' not implemented`);
        return false;
        
      default:
        log(`Job type '${job.type}' not implemented`);
        return false;
    }
  } catch (error) {
    log(`Error executing job ${job.id}: ${error}`);
    return false;
  }
};

/**
 * Check and execute any due jobs
 */
const checkJobs = async () => {
  if (scheduledJobs.length === 0) {
    return;
  }
  
  const now = new Date();
  const dueJobs = scheduledJobs.filter(job => 
    job.nextRun !== null && job.nextRun <= now
  );
  
  if (dueJobs.length === 0) {
    return;
  }
  
  log(`Found ${dueJobs.length} jobs due for execution`);
  
  for (const job of dueJobs) {
    try {
      await executeJob(job);
      
      // Calculate next run time
      job.nextRun = calculateNextRun(job);
      log(`Next run for job ${job.id} scheduled at ${job.nextRun}`);
      
      // Update the database for regular jobs (positive IDs)
      if (job.id > 0 && job.frequency !== 'once') {
        try {
          await db.update(schedules)
            .set({ 
              lastRun: job.lastRun,
              nextRun: job.nextRun
            })
            .where(eq(schedules.id, job.id));
        } catch (error) {
          log(`Error updating job ${job.id} in database: ${error}`);
        }
      } else if (job.frequency === 'once') {
        // Remove one-time jobs after execution
        scheduledJobs = scheduledJobs.filter(j => j.id !== job.id);
      }
    } catch (error) {
      log(`Error processing job ${job.id}: ${error}`);
    }
  }
};

/**
 * Load scheduled jobs from the database
 */
const loadJobs = async () => {
  try {
    // Empty array since the connections table is not created yet
    const ftpConnections: { 
      id: number; 
      type: 'ftp' | 'sftp';
      supplierId: number | null;
      credentials: any;
    }[] = [];
    
    // Load data source schedules
    const sourceSchedules = await db.select({
      id: schedules.id,
      dataSourceId: schedules.dataSourceId,
      frequency: schedules.frequency,
      lastRun: schedules.lastRun,
      nextRun: schedules.nextRun,
      hour: schedules.hour,
      minute: schedules.minute,
      dayOfWeek: schedules.dayOfWeek,
      dayOfMonth: schedules.dayOfMonth,
      customCron: schedules.customCron
    })
    .from(schedules)
    .leftJoin(dataSources, eq(schedules.dataSourceId, dataSources.id))
    .where(and(
      eq(dataSources.active, true),
      sql`${dataSources.type} IN ('sftp', 'ftp', 'api')`
    ));
    
    // Reset job queue
    scheduledJobs = [];
    
    // Add connection-based jobs
    // (skipped for now since we have no connections)
    
    // Add data source schedules
    for (const schedule of sourceSchedules) {
      // Get data source details
      const dataSource = await db.select()
        .from(dataSources)
        .where(eq(dataSources.id, schedule.dataSourceId))
        .limit(1);
        
      if (dataSource.length === 0) continue;
      
      const source = dataSource[0];
      
      // Create job from schedule
      const job: ScheduledJob = {
        id: schedule.id,
        type: source.type as 'ftp' | 'sftp' | 'api',
        dataSourceId: source.id,
        connectionId: source.config?.connectionId,
        lastRun: schedule.lastRun,
        nextRun: schedule.nextRun || calculateNextRun({ 
          ...schedule,
          type: source.type as 'ftp' | 'sftp' | 'api',
          config: {
            hour: schedule.hour,
            minute: schedule.minute,
            dayOfWeek: schedule.dayOfWeek,
            dayOfMonth: schedule.dayOfMonth
          }
        }),
        frequency: schedule.frequency,
        config: {
          // Default configs
          skipExisting: true,
          deleteAfterDownload: false,
          
          // Schedule-specific configs
          hour: schedule.hour,
          minute: schedule.minute,
          dayOfWeek: schedule.dayOfWeek,
          dayOfMonth: schedule.dayOfMonth,
          
          // Data source configs
          ...source.config
        }
      };
      
      scheduledJobs.push(job);
    }
    
    // Add a daily Amazon sync job if not already present
    const hasAmazonJob = scheduledJobs.some(job => 
      job.type === 'api' && job.config?.apiType === 'amazon'
    );
    
    if (!hasAmazonJob) {
      // Create default Amazon sync job
      scheduledJobs.push({
        id: -9999, // Special ID for Amazon job
        type: 'api',
        lastRun: null,
        nextRun: new Date(Date.now() + 300000), // Start in 5 minutes
        frequency: 'daily',
        config: {
          apiType: 'amazon',
          limit: 10, // Process 10 products per run
          hour: 3, // Run at 3 AM
          minute: 0
        }
      });
      
      log('Added default Amazon sync job');
    }
    
    log(`Loaded ${scheduledJobs.length} jobs`);
  } catch (error) {
    log(`Error loading jobs: ${error}`);
  }
};

/**
 * Initialize the scheduler
 */
export const initScheduler = async () => {
  log('Initializing scheduler');
  
  try {
    // Load initial jobs
    await loadJobs();
    
    // Set up interval to check jobs
    if (checkInterval) {
      clearInterval(checkInterval);
    }
    
    checkInterval = setInterval(async () => {
      await checkJobs();
    }, 30000); // Check every 30 seconds
    
    log('Scheduler initialized');
  } catch (error) {
    log(`Error initializing scheduler: ${error}`);
  }
};

/**
 * Run a job immediately - stubbed for now
 */
export const runJobNow = async (connectionId: number): Promise<{
  success: boolean;
  message: string;
}> => {
  try {
    return { success: false, message: 'Connections feature is under development' };
  } catch (error) {
    log(`Error running job for connection ${connectionId}: ${error}`);
    return { 
      success: false, 
      message: `Error running job: ${error}`
    };
  }
};

// Add a special Amazon-specific job that can be referenced by the API
export const addAmazonSyncJob = async (limit: number = 10): Promise<boolean> => {
  try {
    // Create a one-time job that executes immediately
    const job: ScheduledJob = {
      id: -Math.floor(Math.random() * 10000), // Random negative ID
      type: 'api',
      lastRun: null,
      nextRun: new Date(Date.now() + 1000), // Start in 1 second
      frequency: 'once',
      config: {
        apiType: 'amazon',
        limit
      }
    };
    
    scheduledJobs.push(job);
    log(`Added one-time Amazon sync job with limit ${limit}`);
    return true;
  } catch (error) {
    log(`Error adding Amazon sync job: ${error}`);
    return false;
  }
};

export const scheduler = {
  init: initScheduler,
  runJob: runJobNow,
  addAmazonSyncJob
};

// Export for testing purposes
export { calculateNextRun, loadJobs, checkJobs, executeJob };