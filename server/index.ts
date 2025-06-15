import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { scheduler } from "./utils/temporary-scheduler";
import setupDatabase from "./db-setup";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
  // Initialize database tables before registering routes
  try {
    log('Setting up database tables...');
    await setupDatabase();
    log('Database tables setup complete.');
    
    // Initialize Amazon ASIN mappings with authentic data
    const { initializeAmazonDatabase } = await import('./services/database-initialization');
    await initializeAmazonDatabase();
  } catch (error) {
    log('Error setting up database tables:', String(error));
    // Continue initialization even if there's an error
  }

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
    
    // Initialize scheduled jobs after server is up and running
    if (process.env.AMAZON_SP_API_CLIENT_ID) {
      log('Initializing scheduled jobs for Amazon data sync');
      scheduler.init();
    } else {
      log('Amazon SP-API credentials not found. Skipping scheduled jobs initialization.');
    }
  });
})();
