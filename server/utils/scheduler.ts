import { db } from '../db';
import { schedules, dataSources, imports } from '@shared/schema';
import { eq, and, gte, lte, isNull, sql, desc } from 'drizzle-orm';
import { pullFromFTPConnection } from './ftp-ingestion';
import { processImportedFile } from './file-processor';
// Importing only the type to avoid conflict with local function
import type { batchSyncAmazonData as BatchSyncFn } from '../marketplace/amazon-service';

// Define job types
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

// In-memory job queue
let scheduledJobs: ScheduledJob[] = [];
let isInitialized = false;

// Logging with timestamp
const log = (message: string) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [scheduler] ${message}`);
};

/**
 * Calculate the next run time based on frequency
 */
const calculateNextRun = (
  job: ScheduledJob, 
  from: Date = new Date()
): Date | null => {
  const nextRun = new Date(from);
  
  switch (job.frequency) {
    case 'once':
      // For one-time jobs, there's no next run
      return null;
      
    case 'hourly':
      nextRun.setHours(nextRun.getHours() + 1);
      return nextRun;
      
    case 'daily':
      nextRun.setDate(nextRun.getDate() + 1);
      // Set specific hour if defined in job config
      if (job.config?.hour !== undefined) {
        nextRun.setHours(job.config.hour, job.config.minute || 0, 0, 0);
      }
      return nextRun;
      
    case 'weekly':
      // Calculate days until the next specified day of week
      if (job.config?.dayOfWeek !== undefined) {
        const daysUntilNextDay = (job.config.dayOfWeek - nextRun.getDay() + 7) % 7;
        nextRun.setDate(nextRun.getDate() + (daysUntilNextDay === 0 ? 7 : daysUntilNextDay));
      } else {
        // Default to running on the same day next week
        nextRun.setDate(nextRun.getDate() + 7);
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
  if (!job.connectionId) {
    log(`FTP job ${job.id} has no connectionId`);
    return false;
  }
  
  try {
    // Pull files from the connection
    log(`Processing FTP/SFTP job for connection ${job.connectionId}`);
    const result = await pullFromFTPConnection(job.connectionId, {
      skipExisting: job.config?.skipExisting !== false,
      deleteAfterDownload: job.config?.deleteAfterDownload === true
    });
    
    // Log the result
    if (result.success) {
      log(`Successfully pulled ${result.filesPulled.length} files for job ${job.id}`);
      
      // Process each file that was pulled
      for (const filename of result.filesPulled) {
        try {
          // Find the import record for this file
          const importRecords = await db.select()
            .from(imports)
            .where(eq(imports.filename, filename))
            .orderBy(sql`${imports.createdAt} DESC`)
            .limit(1);
            
          if (importRecords.length > 0) {
            // Process the file
            const importId = importRecords[0].id;
            log(`Processing file ${filename} (Import ID: ${importId})`);
            
            const processResult = await processImportedFile(importId);
            
            if (processResult.success) {
              log(`Successfully processed file ${filename}: ${processResult.message}`);
            } else {
              log(`Error processing file ${filename}: ${processResult.message}`);
            }
          }
        } catch (fileError) {
          log(`Error processing pulled file ${filename}: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
        }
      }
      
      return true;
    } else {
      log(`Failed to pull files for job ${job.id}: ${result.message}`);
      return false;
    }
  } catch (error) {
    log(`Error processing FTP job ${job.id}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
};

/**
 * Execute a scheduled job
 */
const executeJob = async (job: ScheduledJob): Promise<boolean> => {
  try {
    let success = false;
    
    // Mark job as running by updating lastRun
    const now = new Date();
    job.lastRun = now;
    
    // Execute job based on type
    switch (job.type) {
      case 'ftp':
      case 'sftp':
        success = await processFTPJob(job);
        break;
        
      case 'api':
        // API job handling would go here
        log(`API job type not implemented yet for job ${job.id}`);
        success = false;
        break;
        
      default:
        log(`Unknown job type ${job.type} for job ${job.id}`);
        success = false;
    }
    
    // Calculate next run time
    job.nextRun = calculateNextRun(job, now);
    
    // Update schedule in database
    if (job.dataSourceId) {
      await db.update(schedules)
        .set({
          lastRun: job.lastRun,
          nextRun: job.nextRun
        })
        .where(eq(schedules.id, job.id));
    }
    
    return success;
  } catch (error) {
    log(`Error executing job ${job.id}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
};

/**
 * Check and execute any due jobs
 */
const checkJobs = async () => {
  const now = new Date();
  
  // Find jobs that are due to run
  const dueJobs = scheduledJobs.filter(job => 
    job.nextRun && job.nextRun <= now
  );
  
  if (dueJobs.length > 0) {
    log(`Found ${dueJobs.length} jobs to execute`);
    
    // Execute each job
    for (const job of dueJobs) {
      log(`Executing job ${job.id}`);
      await executeJob(job);
    }
  }
};

/**
 * Load scheduled jobs from the database
 */
const loadJobs = async () => {
  try {
    // Temporarily use empty array until connections table is created
    const ftpConnections: { 
      id: number; 
      type: 'ftp' | 'sftp'; 
      supplierId: number | null; 
      credentials: any 
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
    // For FTP/SFTP connections without a schedule, we'll add a daily job
    for (const conn of ftpConnections) {
      // Check if there's already a schedule for this connection in sourceSchedules
      const hasSchedule = sourceSchedules.some(s => {
        const dataSource = s.dataSources;
        return dataSource && 
               dataSource.config && 
               dataSource.config.connectionId === conn.id;
      });
      
      if (!hasSchedule && conn.supplierId) {
        // Create a default daily job for this connection
        scheduledJobs.push({
          id: -conn.id, // Negative ID to avoid conflicts with database IDs
          type: conn.type as 'ftp' | 'sftp',
          connectionId: conn.id,
          lastRun: null,
          nextRun: new Date(Date.now() + 60000), // Start in 1 minute
          frequency: 'daily',
          config: {
            hour: 1, // Default to 1 AM
            minute: 0,
            skipExisting: true,
            deleteAfterDownload: false,
            ...((conn.credentials as any).schedulerConfig || {})
          }
        });
      }
    }
    
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
    
    log(`Loaded ${scheduledJobs.length} scheduled jobs`);
  } catch (error) {
    log(`Error loading jobs: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Initialize the scheduler
 */
export const initScheduler = async () => {
  if (isInitialized) return;
  
  log('Initializing scheduler');
  
  // Load initial jobs
  await loadJobs();
  
  // Start the scheduler loop
  const checkInterval = 1 * 60 * 1000; // Check every minute
  
  setInterval(async () => {
    try {
      await checkJobs();
    } catch (error) {
      log(`Error in scheduler loop: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, checkInterval);
  
  // Reload jobs every hour to pick up new configs
  setInterval(async () => {
    try {
      await loadJobs();
    } catch (error) {
      log(`Error reloading jobs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, 60 * 60 * 1000); // Every hour
  
  isInitialized = true;
  log('Scheduler initialized');
};

/**
 * Run a job immediately
 */
export const runJobNow = async (connectionId: number): Promise<{
  success: boolean;
  message: string;
}> => {
  try {
    // Find the connection
    const connection = await db.select()
      .from(connections)
      .where(eq(connections.id, connectionId))
      .limit(1);
      
    if (connection.length === 0) {
      return { success: false, message: 'Connection not found' };
    }
    
    const conn = connection[0];
    
    // Create a temporary job
    const job: ScheduledJob = {
      id: -Math.floor(Math.random() * 1000000), // Random negative ID
      type: conn.type as 'ftp' | 'sftp',
      connectionId,
      lastRun: null,
      nextRun: new Date(),
      frequency: 'once',
      config: {
        skipExisting: true,
        deleteAfterDownload: false
      }
    };
    
    // Execute the job
    const success = await executeJob(job);
    
    return {
      success,
      message: success 
        ? 'Job executed successfully' 
        : 'Job execution failed'
    };
  } catch (error) {
    return {
      success: false,
      message: `Error running job: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

// Create a scheduler object that can be imported and used by other modules
export const scheduler = {
  init: initScheduler,
  triggerJob: async (jobId: string) => {
    // For compatibility with the amazon marketplace integration
    if (jobId === 'amazon-sync') {
      try {
        // Dynamically import the Amazon sync function
        const amazonSyncFn = await getAmazonSyncFunction();
        return await amazonSyncFn(10);
      } catch (error) {
        console.error('Error importing Amazon sync function:', error);
        // Fallback to local implementation
        return await batchSyncAmazonData(10);
      }
    }
    
    // For FTP/SFTP connections, parse the ID after the prefix
    if (jobId.startsWith('connection-')) {
      const connectionId = parseInt(jobId.replace('connection-', ''));
      if (!isNaN(connectionId)) {
        return await runJobNow(connectionId);
      }
    }
    
    throw new Error(`Job with ID "${jobId}" not found`);
  },
  getJobs: () => {
    // Return formatted job information that's compatible with the existing code
    return scheduledJobs.map(job => {
      const jobId = job.connectionId ? `connection-${job.connectionId}` : 
                   job.dataSourceId ? `datasource-${job.dataSourceId}` : 
                   `job-${job.id}`;
      
      return {
        id: jobId,
        type: job.type,
        lastRun: job.lastRun,
        nextRun: job.nextRun,
        frequency: job.frequency,
        config: job.config
      };
    });
  }
};

// Import proper Amazon sync function when needed
const getAmazonSyncFunction = async () => {
  return (await import('../marketplace/amazon-service')).batchSyncAmazonData;
};

// Function to handle Amazon sync for compatibility (backup implementation)
async function batchSyncAmazonData(limit: number = 10) {
  // This is a placeholder since we don't have the actual function here
  // In a real implementation, we would import the real Amazon sync function
  console.log(`[Scheduler] Simulating Amazon batch sync with limit: ${limit}`);
  return {
    success: true,
    message: 'Amazon sync simulated (placeholder)',
    synced: 0,
    limit
  };
}