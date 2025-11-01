/**
 * Scheduler API Routes
 * 
 * Control and monitor the 24/7 Purchasing AI analysis scheduler
 */

import express from "express";
import { db } from "../../db";
import { purchasingAnalysisJobs, purchasingAnalysisRuns, purchasingSettings } from "@shared/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { purchasingAIScheduler } from "./job-scheduler";

const router = express.Router();

/**
 * Get scheduler status
 */
router.get("/status", async (req, res) => {
  try {
    const status = purchasingAIScheduler.getStatus();
    
    // Get job queue statistics
    const jobStats = await db
      .select({
        total: sql<number>`COUNT(*)`,
        pending: sql<number>`SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)`,
        running: sql<number>`SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END)`,
        completed: sql<number>`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`,
        failed: sql<number>`SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)`,
        paused: sql<number>`SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END)`,
      })
      .from(purchasingAnalysisJobs);

    res.json({
      scheduler: status,
      jobs: jobStats[0] || {
        total: 0,
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        paused: 0,
      },
    });
  } catch (error) {
    console.error('[Scheduler API] Error getting status:', error);
    res.status(500).json({ error: 'Failed to get scheduler status' });
  }
});

/**
 * Start the scheduler
 */
router.post("/start", async (req, res) => {
  try {
    await purchasingAIScheduler.start();
    res.json({ success: true, message: 'Scheduler started' });
  } catch (error) {
    console.error('[Scheduler API] Error starting scheduler:', error);
    res.status(500).json({ error: 'Failed to start scheduler' });
  }
});

/**
 * Stop the scheduler
 */
router.post("/stop", async (req, res) => {
  try {
    await purchasingAIScheduler.stop();
    res.json({ success: true, message: 'Scheduler stopped' });
  } catch (error) {
    console.error('[Scheduler API] Error stopping scheduler:', error);
    res.status(500).json({ error: 'Failed to stop scheduler' });
  }
});

/**
 * Enable auto-analysis (update settings)
 */
router.post("/enable", async (req, res) => {
  try {
    const existing = await db.select().from(purchasingSettings).limit(1);
    
    if (existing.length === 0) {
      await db.insert(purchasingSettings).values({
        autoAnalysisEnabled: true,
      });
    } else {
      await db
        .update(purchasingSettings)
        .set({
          autoAnalysisEnabled: true,
          updatedAt: new Date(),
        })
        .where(eq(purchasingSettings.id, existing[0].id));
    }

    await purchasingAIScheduler.start();
    
    res.json({ success: true, message: '24/7 automated analysis enabled' });
  } catch (error) {
    console.error('[Scheduler API] Error enabling auto-analysis:', error);
    res.status(500).json({ error: 'Failed to enable auto-analysis' });
  }
});

/**
 * Disable auto-analysis
 */
router.post("/disable", async (req, res) => {
  try {
    const existing = await db.select().from(purchasingSettings).limit(1);
    
    if (existing.length > 0) {
      await db
        .update(purchasingSettings)
        .set({
          autoAnalysisEnabled: false,
          updatedAt: new Date(),
        })
        .where(eq(purchasingSettings.id, existing[0].id));
    }

    await purchasingAIScheduler.stop();
    
    res.json({ success: true, message: '24/7 automated analysis disabled' });
  } catch (error) {
    console.error('[Scheduler API] Error disabling auto-analysis:', error);
    res.status(500).json({ error: 'Failed to disable auto-analysis' });
  }
});

/**
 * Create a new analysis job
 */
router.post("/jobs", async (req, res) => {
  try {
    const {
      name,
      priority,
      scheduleType,
      productIds,
      supplierId,
      onlyStale,
      nextRunAt,
    } = req.body;

    const jobId = await purchasingAIScheduler.createJob({
      name: name || 'Manual Analysis',
      priority: priority || 'medium',
      scheduleType: scheduleType || 'manual',
      productIds,
      supplierId,
      onlyStale: onlyStale ?? true,
      nextRunAt: nextRunAt ? new Date(nextRunAt) : undefined,
    });

    res.json({
      success: true,
      jobId,
      message: `Analysis job created with ID ${jobId}`,
    });
  } catch (error) {
    console.error('[Scheduler API] Error creating job:', error);
    res.status(500).json({ error: 'Failed to create analysis job' });
  }
});

/**
 * Get all jobs
 */
router.get("/jobs", async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let query = db
      .select()
      .from(purchasingAnalysisJobs)
      .orderBy(desc(purchasingAnalysisJobs.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    if (status) {
      query = query.where(eq(purchasingAnalysisJobs.status, status as any)) as any;
    }

    const jobs = await query;

    res.json(jobs);
  } catch (error) {
    console.error('[Scheduler API] Error fetching jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

/**
 * Get a specific job with its runs
 */
router.get("/jobs/:id", async (req, res) => {
  try {
    const jobId = parseInt(req.params.id);

    const [job] = await db
      .select()
      .from(purchasingAnalysisJobs)
      .where(eq(purchasingAnalysisJobs.id, jobId));

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const runs = await db
      .select()
      .from(purchasingAnalysisRuns)
      .where(eq(purchasingAnalysisRuns.jobId, jobId))
      .orderBy(desc(purchasingAnalysisRuns.createdAt));

    res.json({ job, runs });
  } catch (error) {
    console.error('[Scheduler API] Error fetching job:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

/**
 * Pause a job
 */
router.post("/jobs/:id/pause", async (req, res) => {
  try {
    const jobId = parseInt(req.params.id);
    await purchasingAIScheduler.pauseJob(jobId);
    res.json({ success: true, message: `Job ${jobId} paused` });
  } catch (error) {
    console.error('[Scheduler API] Error pausing job:', error);
    res.status(500).json({ error: 'Failed to pause job' });
  }
});

/**
 * Resume a job
 */
router.post("/jobs/:id/resume", async (req, res) => {
  try {
    const jobId = parseInt(req.params.id);
    await purchasingAIScheduler.resumeJob(jobId);
    res.json({ success: true, message: `Job ${jobId} resumed` });
  } catch (error) {
    console.error('[Scheduler API] Error resuming job:', error);
    res.status(500).json({ error: 'Failed to resume job' });
  }
});

/**
 * Cancel a job
 */
router.post("/jobs/:id/cancel", async (req, res) => {
  try {
    const jobId = parseInt(req.params.id);
    await purchasingAIScheduler.cancelJob(jobId);
    res.json({ success: true, message: `Job ${jobId} cancelled` });
  } catch (error) {
    console.error('[Scheduler API] Error cancelling job:', error);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

/**
 * Get recent runs
 */
router.get("/runs", async (req, res) => {
  try {
    const { limit = 20, offset = 0, jobId } = req.query;

    let query = db
      .select({
        run: purchasingAnalysisRuns,
        job: purchasingAnalysisJobs,
      })
      .from(purchasingAnalysisRuns)
      .leftJoin(purchasingAnalysisJobs, eq(purchasingAnalysisRuns.jobId, purchasingAnalysisJobs.id))
      .orderBy(desc(purchasingAnalysisRuns.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    if (jobId) {
      query = query.where(eq(purchasingAnalysisRuns.jobId, Number(jobId))) as any;
    }

    const runs = await query;

    res.json(runs.map(r => ({ ...r.run, job: r.job })));
  } catch (error) {
    console.error('[Scheduler API] Error fetching runs:', error);
    res.status(500).json({ error: 'Failed to fetch runs' });
  }
});

/**
 * Get analytics/statistics
 */
router.get("/analytics", async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const sinceDate = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);

    const stats = await db
      .select({
        totalRuns: sql<number>`COUNT(*)`,
        completedRuns: sql<number>`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`,
        failedRuns: sql<number>`SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)`,
        totalProducts: sql<number>`SUM(processed_count)`,
        totalOpportunities: sql<number>`SUM(opportunities_found)`,
        avgDuration: sql<number>`AVG(duration)`,
        avgConfidence: sql<number>`AVG(avg_confidence)`,
        totalApiCalls: sql<number>`SUM(api_calls_made)`,
        totalRateLimitHits: sql<number>`SUM(rate_limit_hits)`,
      })
      .from(purchasingAnalysisRuns)
      .where(gte(purchasingAnalysisRuns.createdAt, sinceDate));

    res.json(stats[0] || {});
  } catch (error) {
    console.error('[Scheduler API] Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
