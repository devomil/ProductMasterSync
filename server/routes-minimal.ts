import { type Express } from "express";
import { createServer } from "http";

export function registerRoutes(app: Express) {
  // Basic API routes for testing
  app.get("/api/test", (req, res) => {
    res.json({ message: "API is working", timestamp: new Date().toISOString() });
  });

  app.get("/api/products", (req, res) => {
    res.json({ 
      products: [],
      message: "Products endpoint working",
      timestamp: new Date().toISOString()
    });
  });

  app.get("/api/suppliers", (req, res) => {
    res.json({ 
      suppliers: [],
      message: "Suppliers endpoint working",
      timestamp: new Date().toISOString()
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}