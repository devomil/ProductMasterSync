import express from 'express';
import { db } from '../db';
import { schedules, dataSources } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { scheduler } from '../utils/scheduler';

const router = express.Router();

// Schema for creating/updating a schedule
const scheduleSchema = z.object({
  dataSourceId: z.number(),
  remotePath: z.string().optional(),
  pathLabel: z.string().optional(),
  frequency: z.enum(['once', 'hourly', 'daily', 'weekly', 'monthly', 'custom']),
  hour: z.number().min(0).max(23).optional(),
  minute: z.number().min(0).max(59).optional(),
  dayOfWeek: z.number().min(0).max(6).optional().nullable(),
  dayOfMonth: z.number().min(1).max(31).optional().nullable(),
  customCron: z.string().optional().nullable(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// Get all schedules
router.get('/', async (req, res) => {
  try {
    const dataSourceId = req.query.dataSourceId ? Number(req.query.dataSourceId) : undefined;
    
    // If dataSourceId is provided, filter by it
    const results = dataSourceId 
      ? await db.select().from(schedules).where(eq(schedules.dataSourceId, dataSourceId))
      : await db.select().from(schedules);
    
    res.json(results);
  } catch (error) {
    console.error('Error getting schedules:', error);
    res.status(500).json({ error: 'Failed to get schedules' });
  }
});

// Get a specific schedule
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    const [result] = await db
      .select()
      .from(schedules)
      .where(eq(schedules.id, id));
    
    if (!result) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error getting schedule:', error);
    res.status(500).json({ error: 'Failed to get schedule' });
  }
});

// Create a new schedule
router.post('/', async (req, res) => {
  try {
    const scheduleData = scheduleSchema.parse(req.body);
    
    // Verify data source exists
    const [dataSource] = await db
      .select()
      .from(dataSources)
      .where(eq(dataSources.id, scheduleData.dataSourceId));
    
    if (!dataSource) {
      return res.status(404).json({ error: 'Data source not found' });
    }
    
    // Calculate next run time
    const nextRun = calculateNextRun(scheduleData);
    
    const [created] = await db
      .insert(schedules)
      .values({
        ...scheduleData,
        nextRun
      })
      .returning();
    
    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating schedule:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid schedule data', details: error.errors });
    }
    
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

// Update a schedule
router.patch('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const scheduleData = scheduleSchema.parse(req.body);
    
    // Verify schedule exists
    const [existingSchedule] = await db
      .select()
      .from(schedules)
      .where(eq(schedules.id, id));
    
    if (!existingSchedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    
    // Calculate next run time
    const nextRun = calculateNextRun(scheduleData);
    
    const [updated] = await db
      .update(schedules)
      .set({
        ...scheduleData,
        nextRun,
        updatedAt: new Date()
      })
      .where(eq(schedules.id, id))
      .returning();
    
    res.json(updated);
  } catch (error) {
    console.error('Error updating schedule:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid schedule data', details: error.errors });
    }
    
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// Delete a schedule
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    // Verify schedule exists
    const [existingSchedule] = await db
      .select()
      .from(schedules)
      .where(eq(schedules.id, id));
    
    if (!existingSchedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    
    await db
      .delete(schedules)
      .where(eq(schedules.id, id));
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

// Run a schedule now
router.post('/:id/run', async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    // Verify schedule exists
    const [existingSchedule] = await db
      .select()
      .from(schedules)
      .where(eq(schedules.id, id));
    
    if (!existingSchedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    
    // Get data source
    const [dataSource] = await db
      .select()
      .from(dataSources)
      .where(eq(dataSources.id, existingSchedule.dataSourceId));
    
    if (!dataSource) {
      return res.status(404).json({ error: 'Data source not found' });
    }
    
    // Generate job ID
    const jobId = `datasource-${dataSource.id}`;
    
    // Try to run the job
    try {
      // Execute the job
      await scheduler.triggerJob(jobId);
      
      // Update last run time
      await db
        .update(schedules)
        .set({
          lastRun: new Date(),
          updatedAt: new Date()
        })
        .where(eq(schedules.id, id));
      
      res.json({ success: true, message: 'Schedule triggered successfully' });
    } catch (error) {
      console.error('Error triggering schedule:', error);
      res.status(500).json({ error: 'Failed to trigger schedule', details: error.message });
    }
  } catch (error) {
    console.error('Error running schedule:', error);
    res.status(500).json({ error: 'Failed to run schedule' });
  }
});

// Helper function to calculate next run time based on schedule
function calculateNextRun(scheduleData: z.infer<typeof scheduleSchema>): Date {
  const now = new Date();
  let nextRun = new Date();
  
  switch (scheduleData.frequency) {
    case 'once':
      // If once, set to now + 1 minute
      nextRun.setMinutes(now.getMinutes() + 1);
      break;
      
    case 'hourly':
      // If hourly, set to next hour
      nextRun.setHours(now.getHours() + 1);
      nextRun.setMinutes(scheduleData.minute || 0);
      nextRun.setSeconds(0);
      break;
      
    case 'daily':
      // If daily, set to next occurrence of the specified time
      nextRun.setHours(scheduleData.hour || 0);
      nextRun.setMinutes(scheduleData.minute || 0);
      nextRun.setSeconds(0);
      
      // If the calculated time is in the past, add a day
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;
      
    case 'weekly':
      // If weekly, set to next occurrence of the specified day and time
      const currentDay = now.getDay();
      const targetDay = scheduleData.dayOfWeek ?? 0;
      
      // Calculate days to add
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7; // Ensure it's in the future
      
      nextRun.setDate(now.getDate() + daysToAdd);
      nextRun.setHours(scheduleData.hour || 0);
      nextRun.setMinutes(scheduleData.minute || 0);
      nextRun.setSeconds(0);
      break;
      
    case 'monthly':
      // If monthly, set to next occurrence of the specified day of month and time
      const targetDate = scheduleData.dayOfMonth ?? 1;
      
      nextRun.setDate(targetDate);
      nextRun.setHours(scheduleData.hour || 0);
      nextRun.setMinutes(scheduleData.minute || 0);
      nextRun.setSeconds(0);
      
      // If the calculated time is in the past, add a month
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
      break;
      
    case 'custom':
      // For custom CRON, we would need a CRON parser
      // For simplicity, we'll set it to tomorrow at midnight
      nextRun.setDate(now.getDate() + 1);
      nextRun.setHours(0);
      nextRun.setMinutes(0);
      nextRun.setSeconds(0);
      break;
  }
  
  return nextRun;
}

export default router;