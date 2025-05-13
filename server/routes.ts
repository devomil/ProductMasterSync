import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { 
  insertProductSchema, 
  insertSupplierSchema, 
  insertCategorySchema, 
  insertImportSchema,
  insertExportSchema,
  insertApprovalSchema,
  insertDataSourceSchema,
  insertMappingTemplateSchema
} from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { parse as parseCsv } from "csv-parse/sync";

// Set up multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.resolve(process.cwd(), "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Helper function to format error responses
const handleError = (res: Response, error: any) => {
  console.error("API Error:", error);
  if (error instanceof z.ZodError) {
    return res.status(400).json({ 
      message: "Validation error", 
      errors: error.errors 
    });
  }
  return res.status(500).json({ message: error.message || "Internal server error" });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Suppliers API
  app.get("/api/suppliers", async (req, res) => {
    try {
      const suppliers = await storage.getSuppliers();
      res.json(suppliers);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get("/api/suppliers/:id", async (req, res) => {
    try {
      const supplier = await storage.getSupplier(Number(req.params.id));
      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }
      res.json(supplier);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/suppliers", async (req, res) => {
    try {
      const validatedData = insertSupplierSchema.parse(req.body);
      const supplier = await storage.createSupplier(validatedData);
      
      // Create audit log
      await storage.createAuditLog({
        action: "create",
        entityType: "supplier",
        entityId: supplier.id,
        details: { supplier }
      });
      
      res.status(201).json(supplier);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.put("/api/suppliers/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const validatedData = insertSupplierSchema.partial().parse(req.body);
      const updatedSupplier = await storage.updateSupplier(id, validatedData);
      
      if (!updatedSupplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }
      
      // Create audit log
      await storage.createAuditLog({
        action: "update",
        entityType: "supplier",
        entityId: id,
        details: { 
          before: await storage.getSupplier(id),
          after: updatedSupplier
        }
      });
      
      res.json(updatedSupplier);
    } catch (error) {
      handleError(res, error);
    }
  });

  // Categories API
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get("/api/categories/:id", async (req, res) => {
    try {
      const category = await storage.getCategory(Number(req.params.id));
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const validatedData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(validatedData);
      
      // Create audit log
      await storage.createAuditLog({
        action: "create",
        entityType: "category",
        entityId: category.id,
        details: { category }
      });
      
      res.status(201).json(category);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.put("/api/categories/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const validatedData = insertCategorySchema.partial().parse(req.body);
      const updatedCategory = await storage.updateCategory(id, validatedData);
      
      if (!updatedCategory) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      // Create audit log
      await storage.createAuditLog({
        action: "update",
        entityType: "category",
        entityId: id,
        details: { 
          before: await storage.getCategory(id),
          after: updatedCategory
        }
      });
      
      res.json(updatedCategory);
    } catch (error) {
      handleError(res, error);
    }
  });

  // Products API
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(Number(req.params.id));
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const validatedData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(validatedData);
      
      // Create audit log
      await storage.createAuditLog({
        action: "create",
        entityType: "product",
        entityId: product.id,
        details: { product }
      });
      
      res.status(201).json(product);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.put("/api/products/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const validatedData = insertProductSchema.partial().parse(req.body);
      const updatedProduct = await storage.updateProduct(id, validatedData);
      
      if (!updatedProduct) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Create audit log
      await storage.createAuditLog({
        action: "update",
        entityType: "product",
        entityId: id,
        details: { 
          before: await storage.getProduct(id),
          after: updatedProduct
        }
      });
      
      res.json(updatedProduct);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const product = await storage.getProduct(id);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      const success = await storage.deleteProduct(id);
      
      if (success) {
        // Create audit log
        await storage.createAuditLog({
          action: "delete",
          entityType: "product",
          entityId: id,
          details: { product }
        });
      }
      
      res.json({ success });
    } catch (error) {
      handleError(res, error);
    }
  });

  // Imports API
  app.get("/api/imports", async (req, res) => {
    try {
      const imports = await storage.getImports();
      res.json(imports);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get("/api/imports/:id", async (req, res) => {
    try {
      const importData = await storage.getImport(Number(req.params.id));
      if (!importData) {
        return res.status(404).json({ message: "Import not found" });
      }
      res.json(importData);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/imports", upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Extract file extension
      const fileExt = path.extname(file.originalname).toLowerCase();
      let type = "";
      
      if ([".csv"].includes(fileExt)) {
        type = "csv";
      } else if ([".xlsx", ".xls"].includes(fileExt)) {
        type = "excel";
      } else if ([".json"].includes(fileExt)) {
        type = "json";
      } else if ([".xml"].includes(fileExt)) {
        type = "xml";
      } else {
        return res.status(400).json({ message: "Unsupported file format" });
      }
      
      const importData = {
        ...req.body,
        filename: file.originalname,
        type,
        status: "pending",
        recordCount: 0,
        supplierId: req.body.supplierId ? Number(req.body.supplierId) : undefined,
      };
      
      // For CSV files, we can do a quick record count
      if (type === "csv") {
        try {
          const fileContent = fs.readFileSync(file.path, 'utf8');
          const records = parseCsv(fileContent);
          importData.recordCount = records.length - 1; // Subtract header row
        } catch (err) {
          console.error("Error parsing CSV:", err);
        }
      }
      
      const validatedData = insertImportSchema.parse(importData);
      const newImport = await storage.createImport(validatedData);
      
      // Create audit log
      await storage.createAuditLog({
        action: "create",
        entityType: "import",
        entityId: newImport.id,
        details: { import: newImport }
      });
      
      // Start processing the import (simulated in this implementation)
      setTimeout(async () => {
        try {
          const updatedImport = await storage.updateImport(newImport.id, {
            status: "processing",
          });
          
          // Simulate processing delay
          setTimeout(async () => {
            try {
              // Simulate success or error randomly
              const success = Math.random() > 0.2;
              
              if (success) {
                await storage.updateImport(newImport.id, {
                  status: "success",
                  processedCount: importData.recordCount,
                  completedAt: new Date()
                });
              } else {
                await storage.updateImport(newImport.id, {
                  status: "error",
                  errorCount: 1,
                  importErrors: [{ message: "Processing error", line: Math.floor(Math.random() * importData.recordCount) + 1 }],
                  completedAt: new Date()
                });
              }
            } catch (err) {
              console.error("Error updating import:", err);
            }
          }, 5000);
        } catch (err) {
          console.error("Error starting import processing:", err);
        }
      }, 1000);
      
      res.status(201).json(newImport);
    } catch (error) {
      handleError(res, error);
    }
  });

  // Exports API
  app.get("/api/exports", async (req, res) => {
    try {
      const exports = await storage.getExports();
      res.json(exports);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/exports", async (req, res) => {
    try {
      const validatedData = insertExportSchema.parse(req.body);
      const exportData = await storage.createExport(validatedData);
      
      // Create audit log
      await storage.createAuditLog({
        action: "create",
        entityType: "export",
        entityId: exportData.id,
        details: { export: exportData }
      });
      
      // Simulate export processing
      setTimeout(async () => {
        try {
          await storage.updateExport(exportData.id, {
            status: "processing",
          });
          
          // Simulate processing delay
          setTimeout(async () => {
            try {
              await storage.updateExport(exportData.id, {
                status: "success",
                completedAt: new Date()
              });
            } catch (err) {
              console.error("Error finalizing export:", err);
            }
          }, 3000);
        } catch (err) {
          console.error("Error starting export processing:", err);
        }
      }, 1000);
      
      res.status(201).json(exportData);
    } catch (error) {
      handleError(res, error);
    }
  });

  // Approvals API
  app.get("/api/approvals", async (req, res) => {
    try {
      const approvals = await storage.getApprovals();
      res.json(approvals);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get("/api/approvals/:id", async (req, res) => {
    try {
      const approval = await storage.getApproval(Number(req.params.id));
      if (!approval) {
        return res.status(404).json({ message: "Approval not found" });
      }
      res.json(approval);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/approvals", async (req, res) => {
    try {
      const validatedData = insertApprovalSchema.parse(req.body);
      const approval = await storage.createApproval(validatedData);
      
      // Create audit log
      await storage.createAuditLog({
        action: "create",
        entityType: "approval",
        entityId: approval.id,
        details: { approval }
      });
      
      res.status(201).json(approval);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.put("/api/approvals/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { action } = req.body;
      
      if (!["approve", "reject", "postpone"].includes(action)) {
        return res.status(400).json({ message: "Invalid action" });
      }
      
      const approval = await storage.getApproval(id);
      if (!approval) {
        return res.status(404).json({ message: "Approval not found" });
      }
      
      let status = approval.status;
      if (action === "approve") {
        status = "approved";
      } else if (action === "reject") {
        status = "rejected";
      }
      
      const updatedApproval = await storage.updateApproval(id, {
        status,
        completedAt: ["approve", "reject"].includes(action) ? new Date() : undefined,
        approvedBy: action === "approve" ? 1 : undefined, // Hard-coded user ID for demo
      });
      
      // Create audit log
      await storage.createAuditLog({
        action: action,
        entityType: "approval",
        entityId: id,
        userId: 1, // Hard-coded user ID for demo
        details: { 
          before: approval,
          after: updatedApproval
        }
      });
      
      res.json(updatedApproval);
    } catch (error) {
      handleError(res, error);
    }
  });

  // Audit Logs API
  app.get("/api/audit-logs", async (req, res) => {
    try {
      const auditLogs = await storage.getAuditLogs();
      res.json(auditLogs);
    } catch (error) {
      handleError(res, error);
    }
  });
  
  // Data Sources API
  app.get("/api/data-sources", async (req, res) => {
    try {
      const dataSources = await storage.getDataSources();
      res.json(dataSources);
    } catch (error) {
      handleError(res, error);
    }
  });
  
  app.get("/api/data-sources/:id", async (req, res) => {
    try {
      const dataSource = await storage.getDataSource(Number(req.params.id));
      if (!dataSource) {
        return res.status(404).json({ message: "Data source not found" });
      }
      res.json(dataSource);
    } catch (error) {
      handleError(res, error);
    }
  });
  
  app.get("/api/data-sources/by-type/:type", async (req, res) => {
    try {
      const dataSources = await storage.getDataSourcesByType(req.params.type);
      res.json(dataSources);
    } catch (error) {
      handleError(res, error);
    }
  });
  
  app.get("/api/data-sources/by-supplier/:supplierId", async (req, res) => {
    try {
      const dataSources = await storage.getDataSourcesBySupplier(Number(req.params.supplierId));
      res.json(dataSources);
    } catch (error) {
      handleError(res, error);
    }
  });
  
  app.post("/api/data-sources", async (req, res) => {
    try {
      const validatedData = insertDataSourceSchema.parse(req.body);
      const dataSource = await storage.createDataSource(validatedData);
      
      // Create audit log
      await storage.createAuditLog({
        action: "create",
        entityType: "dataSource",
        entityId: dataSource.id,
        details: { dataSource }
      });
      
      res.status(201).json(dataSource);
    } catch (error) {
      handleError(res, error);
    }
  });
  
  app.put("/api/data-sources/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const validatedData = insertDataSourceSchema.partial().parse(req.body);
      const updatedDataSource = await storage.updateDataSource(id, validatedData);
      
      if (!updatedDataSource) {
        return res.status(404).json({ message: "Data source not found" });
      }
      
      // Create audit log
      await storage.createAuditLog({
        action: "update",
        entityType: "dataSource",
        entityId: id,
        details: { 
          before: await storage.getDataSource(id),
          after: updatedDataSource
        }
      });
      
      res.json(updatedDataSource);
    } catch (error) {
      handleError(res, error);
    }
  });
  
  app.delete("/api/data-sources/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const dataSource = await storage.getDataSource(id);
      
      if (!dataSource) {
        return res.status(404).json({ message: "Data source not found" });
      }
      
      const success = await storage.deleteDataSource(id);
      
      if (success) {
        // Create audit log
        await storage.createAuditLog({
          action: "delete",
          entityType: "dataSource",
          entityId: id,
          details: { dataSource }
        });
      }
      
      res.json({ success });
    } catch (error) {
      handleError(res, error);
    }
  });
  
  // Mapping Templates API
  app.get("/api/mapping-templates", async (req, res) => {
    try {
      const mappingTemplates = await storage.getMappingTemplates();
      res.json(mappingTemplates);
    } catch (error) {
      handleError(res, error);
    }
  });
  
  app.get("/api/mapping-templates/:id", async (req, res) => {
    try {
      const mappingTemplate = await storage.getMappingTemplate(Number(req.params.id));
      if (!mappingTemplate) {
        return res.status(404).json({ message: "Mapping template not found" });
      }
      res.json(mappingTemplate);
    } catch (error) {
      handleError(res, error);
    }
  });
  
  app.get("/api/mapping-templates/by-source-type/:sourceType", async (req, res) => {
    try {
      const mappingTemplates = await storage.getMappingTemplatesBySourceType(req.params.sourceType);
      res.json(mappingTemplates);
    } catch (error) {
      handleError(res, error);
    }
  });
  
  app.post("/api/mapping-templates", async (req, res) => {
    try {
      const validatedData = insertMappingTemplateSchema.parse(req.body);
      const mappingTemplate = await storage.createMappingTemplate(validatedData);
      
      // Create audit log
      await storage.createAuditLog({
        action: "create",
        entityType: "mappingTemplate",
        entityId: mappingTemplate.id,
        details: { mappingTemplate }
      });
      
      res.status(201).json(mappingTemplate);
    } catch (error) {
      handleError(res, error);
    }
  });
  
  app.put("/api/mapping-templates/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const validatedData = insertMappingTemplateSchema.partial().parse(req.body);
      const updatedMappingTemplate = await storage.updateMappingTemplate(id, validatedData);
      
      if (!updatedMappingTemplate) {
        return res.status(404).json({ message: "Mapping template not found" });
      }
      
      // Create audit log
      await storage.createAuditLog({
        action: "update",
        entityType: "mappingTemplate",
        entityId: id,
        details: { 
          before: await storage.getMappingTemplate(id),
          after: updatedMappingTemplate
        }
      });
      
      res.json(updatedMappingTemplate);
    } catch (error) {
      handleError(res, error);
    }
  });
  
  app.delete("/api/mapping-templates/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const mappingTemplate = await storage.getMappingTemplate(id);
      
      if (!mappingTemplate) {
        return res.status(404).json({ message: "Mapping template not found" });
      }
      
      const success = await storage.deleteMappingTemplate(id);
      
      if (success) {
        // Create audit log
        await storage.createAuditLog({
          action: "delete",
          entityType: "mappingTemplate",
          entityId: id,
          details: { mappingTemplate }
        });
      }
      
      res.json({ success });
    } catch (error) {
      handleError(res, error);
    }
  });

  // Statistics API
  app.get("/api/statistics", async (req, res) => {
    try {
      const products = await storage.getProducts();
      const suppliers = await storage.getSuppliers();
      const imports = await storage.getImports();
      const approvals = await storage.getApprovals();
      
      const pendingApprovals = approvals.filter(a => a.status === "pending").length;
      const successfulImports = imports.filter(i => i.status === "success").length;
      
      // Calculate data quality metrics (simulated)
      const dataQuality = {
        overall: 86,
        completeness: 91,
        consistency: 82,
        accuracy: 79,
        timeliness: 95
      };
      
      // Calculate pipeline performance (simulated)
      const pipelinePerformance = {
        ingestRate: "8.5K/hour",
        normalizationRate: "7.1K/hour",
        matchRate: "94.2%",
        autoApprovalRate: "78.5%",
        syncSuccessRate: "99.8%"
      };
      
      res.json({
        totalProducts: products.length || 23456, // Fallback to sample data
        activeSuppliers: suppliers.filter(s => s.active).length || 156,
        successfulImports30d: successfulImports || 248,
        pendingApprovals: pendingApprovals || 42,
        dataQuality,
        pipelinePerformance
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
