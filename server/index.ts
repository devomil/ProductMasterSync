import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { healthCheck } from "./health-check";
import { startSupplierAutomationScheduler } from "./utils/supplier-automation-scheduler";

const originalExit = process.exit.bind(process);
(process as any).exit = (code?: number) => {
  const fs = require('fs');
  const msg = `[PROCESS EXIT] code=${code} at ${new Date().toISOString()}\n${new Error().stack}\n`;
  fs.appendFileSync('/tmp/process-exit.log', msg);
  console.log(msg);
  return originalExit(code);
};

process.on('exit', (code) => {
  console.error(`[PROCESS] Exit with code: ${code}`);
});
process.on('SIGTERM', () => {
  console.error('[PROCESS] Received SIGTERM');
});
process.on('SIGINT', () => {
  console.error('[PROCESS] Received SIGINT');
});
process.on('uncaughtException', (err) => {
  console.error('[PROCESS] Uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[PROCESS] Unhandled rejection:', reason);
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Basic middleware only

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Add health check endpoint
  app.get('/api/health', async (req, res) => {
    const health = await healthCheck();
    res.status(health.status === 'ok' ? 200 : 500).json(health);
  });
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Set proper content type
    res.setHeader('Content-Type', 'application/json');
    
    // Send error response in JSON format
    res.status(status).json({ 
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined 
    });
    // Don't throw after sending response
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
  
  // Start the supplier automation scheduler
  await startSupplierAutomationScheduler();
  
  // Start the Purchasing AI job scheduler
  try {
    const { purchasingAIScheduler } = await import("./purchasing/scheduler/job-scheduler");
    await purchasingAIScheduler.start();
    log('✅ Purchasing AI scheduler started');
  } catch (error) {
    log(`⚠️ Failed to start Purchasing AI scheduler: ${error}`);
  }

  // Pre-load Walmart price incentives cache in the background
  setTimeout(async () => {
    try {
      const { fetchAllWalmartIncentives } = await import("./utils/walmart-api");
      await fetchAllWalmartIncentives();
      log('✅ Walmart price incentives cache pre-loaded');
    } catch (e) {
      log(`⚠️ Failed to pre-load Walmart incentives cache: ${(e as Error).message}`);
    }
  }, 5000);
})();
