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
      timestamp: new Date().toISOString(),
      totalCount: 0,
      status: "ready"
    });
  });

  app.get("/api/suppliers", (req, res) => {
    res.json({ 
      suppliers: [],
      message: "Suppliers endpoint working", 
      timestamp: new Date().toISOString(),
      totalCount: 0,
      status: "ready"
    });
  });

  // Statistics endpoint for dashboard
  app.get("/api/statistics", (req, res) => {
    res.json({
      totalProducts: 0,
      activeSuppliers: 0,
      successfulImports30d: 0,
      pendingApprovals: 0,
      dataQuality: {
        overall: 100,
        completeness: 100,
        consistency: 100,
        accuracy: 100,
        timeliness: 100
      },
      recentActivity: [],
      systemHealth: "optimal"
    });
  });

  // Placeholder routes for key MDM/PIM functionality
  app.get("/api/categories", (req, res) => {
    res.json({ categories: [], message: "Categories endpoint ready" });
  });

  app.get("/api/data-sources", (req, res) => {
    res.json({ dataSources: [], message: "Data sources endpoint ready" });
  });

  app.get("/api/mapping-templates", (req, res) => {
    res.json({ templates: [], message: "Mapping templates endpoint ready" });
  });

  const httpServer = createServer(app);
  return httpServer;
}