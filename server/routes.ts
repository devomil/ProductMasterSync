import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { z } from "zod";
import { 
  insertProductSchema, 
  insertSupplierSchema, 
  insertCategorySchema, 
  insertImportSchema,
  insertExportSchema,
  insertApprovalSchema,
  insertDataSourceSchema,
  insertMappingTemplateSchema,
  schedules,
  dataSources
} from "@shared/schema";
import { eq } from "drizzle-orm";
import marketplaceRoutes from "./marketplace/routes";
import schedulerRoutes from './routes/scheduler';
import multer from "multer";
import path from "path";
import fs from "fs";
import { parse as parseCsv } from "csv-parse/sync";

// Import connections routes
import { registerConnectionsRoutes } from "./connections";

// Import the ingestion engine
import { processSFTPIngestion } from "./utils/ingestion-engine";
import { processDescription, formatDescriptionForContext } from "./utils/description-processor";
import { BulkImportProcessor } from "./utils/bulk-import";

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
  
  // Search products with advanced filters
  app.get("/api/products/search", async (req, res) => {
    try {
      const {
        query,
        searchType = 'all',
        category,
        supplier,
        status,
        isRemanufactured,
        isCloseout,
        isOnSale,
        hasRebate,
        hasFreeShipping,
        priceMin,
        priceMax,
        inventoryStatus,
        page = '1',
        limit = '20',
        sortBy = 'name',
        sortDir = 'asc'
      } = req.query;

      const parsedFilters = {
        query: typeof query === 'string' ? query : '',
        searchType: typeof searchType === 'string' ? searchType : 'all',
        category: typeof category === 'string' ? category : undefined,
        supplier: typeof supplier === 'string' ? supplier : undefined,
        status: typeof status === 'string' ? status : undefined,
        isRemanufactured: isRemanufactured === 'true',
        isCloseout: isCloseout === 'true',
        isOnSale: isOnSale === 'true',
        hasRebate: hasRebate === 'true',
        hasFreeShipping: hasFreeShipping === 'true',
        priceMin: priceMin ? Number(priceMin) : undefined,
        priceMax: priceMax ? Number(priceMax) : undefined,
        inventoryStatus: typeof inventoryStatus === 'string' ? inventoryStatus : undefined,
        page: Number(page),
        limit: Number(limit),
        sortBy: typeof sortBy === 'string' ? sortBy : 'name',
        sortDir: typeof sortDir === 'string' ? sortDir : 'asc'
      };
      
      // For now, use the regular getProducts and handle filtering in-memory
      // In a real implementation, this would use database-level filtering
      const allProducts = await storage.getProducts();
      
      // Filter products based on parsedFilters
      let filteredProducts = [...allProducts];
      
      // Text search
      if (parsedFilters.query) {
        const searchQuery = parsedFilters.query.toLowerCase();
        if (parsedFilters.searchType === 'all') {
          filteredProducts = filteredProducts.filter(product => 
            (product.name?.toLowerCase().includes(searchQuery)) ||
            (product.sku?.toLowerCase().includes(searchQuery)) ||
            (product.description?.toLowerCase().includes(searchQuery)) ||
            (product.manufacturerPartNumber?.toLowerCase().includes(searchQuery)) ||
            (product.upc?.toLowerCase().includes(searchQuery)) ||
            (product.manufacturerName?.toLowerCase().includes(searchQuery))
          );
        } else {
          filteredProducts = filteredProducts.filter(product => {
            switch (parsedFilters.searchType) {
              case 'sku':
                return product.sku?.toLowerCase().includes(searchQuery);
              case 'mfgPart':
                return product.manufacturerPartNumber?.toLowerCase().includes(searchQuery);
              case 'upc':
                return product.upc?.toLowerCase().includes(searchQuery);
              case 'title':
                return product.name?.toLowerCase().includes(searchQuery);
              case 'description':
                return product.description?.toLowerCase().includes(searchQuery);
              case 'manufacturer':
                return product.manufacturerName?.toLowerCase().includes(searchQuery);
              case 'category':
                // This would check against category name in a real implementation
                return product.categoryId?.toString() === parsedFilters.category;
              default:
                return false;
            }
          });
        }
      }
      
      // Category filtering
      if (parsedFilters.category) {
        filteredProducts = filteredProducts.filter(product => 
          product.categoryId?.toString() === parsedFilters.category
        );
      }
      
      // Supplier filtering
      if (parsedFilters.supplier) {
        filteredProducts = filteredProducts.filter(product => 
          product.supplierId?.toString() === parsedFilters.supplier
        );
      }
      
      // Status filtering
      if (parsedFilters.status) {
        filteredProducts = filteredProducts.filter(product => 
          product.status === parsedFilters.status
        );
      }
      
      // Special flags
      if (parsedFilters.isRemanufactured) {
        filteredProducts = filteredProducts.filter(product => product.isRemanufactured);
      }
      
      if (parsedFilters.isCloseout) {
        filteredProducts = filteredProducts.filter(product => product.isCloseout);
      }
      
      if (parsedFilters.isOnSale) {
        filteredProducts = filteredProducts.filter(product => product.isOnSale);
      }
      
      if (parsedFilters.hasRebate) {
        filteredProducts = filteredProducts.filter(product => product.hasRebate);
      }
      
      if (parsedFilters.hasFreeShipping) {
        filteredProducts = filteredProducts.filter(product => product.hasFreeShipping);
      }
      
      // Price range
      if (parsedFilters.priceMin !== undefined) {
        filteredProducts = filteredProducts.filter(product => {
          const price = parseFloat(product.price || '0');
          return price >= parsedFilters.priceMin!;
        });
      }
      
      if (parsedFilters.priceMax !== undefined) {
        filteredProducts = filteredProducts.filter(product => {
          const price = parseFloat(product.price || '0');
          return price <= parsedFilters.priceMax!;
        });
      }
      
      // Inventory status
      if (parsedFilters.inventoryStatus && parsedFilters.inventoryStatus !== 'all') {
        filteredProducts = filteredProducts.filter(product => {
          const qty = product.inventoryQuantity || 0;
          const threshold = product.reorderThreshold || 5;
          
          switch (parsedFilters.inventoryStatus) {
            case 'inStock':
              return qty > threshold;
            case 'lowStock':
              return qty > 0 && qty <= threshold;
            case 'outOfStock':
              return qty <= 0;
            default:
              return true;
          }
        });
      }
      
      // Sort products
      filteredProducts.sort((a, b) => {
        const sortField = parsedFilters.sortBy as keyof typeof a;
        const aValue = a[sortField] || '';
        const bValue = b[sortField] || '';
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return parsedFilters.sortDir === 'asc' 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
        }
        
        // Handle numeric sorting
        const numA = Number(aValue) || 0;
        const numB = Number(bValue) || 0;
        return parsedFilters.sortDir === 'asc' ? numA - numB : numB - numA;
      });
      
      // Pagination
      const startIndex = (parsedFilters.page - 1) * parsedFilters.limit;
      const endIndex = startIndex + parsedFilters.limit;
      const paginatedProducts = filteredProducts.slice(startIndex, endIndex);
      
      res.json({
        products: paginatedProducts,
        pagination: {
          page: parsedFilters.page,
          limit: parsedFilters.limit,
          totalItems: filteredProducts.length,
          totalPages: Math.ceil(filteredProducts.length / parsedFilters.limit)
        }
      });
    } catch (error) {
      handleError(res, error);
    }
  });
  
  // Get detailed product information for sales reps
  app.get("/api/products/:id/details", async (req, res) => {
    try {
      const productId = Number(req.params.id);
      const product = await storage.getProduct(productId);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // In a real implementation, we would join with related tables
      // For this prototype, we'll enrich the product with additional data
      const supplier = await storage.getSupplier(product.supplierId || 0);
      
      // Get categories
      const categories = await storage.getCategories();
      const category = categories.find(c => c.id === product.categoryId);
      
      // Mock product documents (would be from a real database in production)
      const documents = [
        { id: 1, name: 'Product Datasheet', type: 'pdf', url: '/documents/datasheet.pdf' },
        { id: 2, name: 'User Manual', type: 'pdf', url: '/documents/manual.pdf' },
        { id: 3, name: 'Warranty Information', type: 'pdf', url: '/documents/warranty.pdf' }
      ];
      
      // Mock product images (would be from a real database in production)
      const images = [
        { id: 1, url: '/images/product-main.jpg', isPrimary: true },
        { id: 2, url: '/images/product-angle1.jpg', isPrimary: false },
        { id: 3, url: '/images/product-angle2.jpg', isPrimary: false }
      ];
      
      // Create enriched product object
      const productDetails = {
        ...product,
        category: category,
        supplier: supplier ? {
          id: supplier.id,
          name: supplier.name,
          leadTime: '5-7 days', // Mock data
          stockStatus: 'In Stock', // Mock data
        } : null,
        specifications: {
          dimensions: '10 x 5 x 2 inches',
          weight: '2.5 lbs',
          color: 'Black',
          material: 'Aluminum',
          // These would be dynamic attributes in a real implementation
          attributes: JSON.parse(product.attributes || '{}')
        },
        promotions: [
          {
            id: 1,
            name: 'Summer Sale',
            discountType: 'percentage',
            discountValue: 10,
            startDate: '2023-06-01',
            endDate: '2023-08-31'
          }
        ],
        documents,
        images
      };
      
      res.json(productDetails);
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
  
  // Ingest data from SFTP path using mapping template
  app.post("/api/ingest/sftp", async (req, res) => {
    try {
      const { 
        sftpPath, 
        connectionId, 
        mappingTemplateId, 
        deleteAfterProcessing = false,
        skipExistingProducts = false 
      } = req.body;
      
      if (!sftpPath || !connectionId || !mappingTemplateId) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      // Import the ingestion engine
      const { processSFTPIngestion } = await import('./utils/ingestion-engine');
      
      // Process the ingestion
      const result = await processSFTPIngestion(sftpPath, connectionId, mappingTemplateId, {
        deleteSourceAfterProcessing: deleteAfterProcessing,
        createImportRecord: true,
        skipExistingProducts
      });
      
      res.json(result);
    } catch (error) {
      console.error('Error processing SFTP ingestion:', error);
      res.status(500).json({ 
        error: 'Failed to process SFTP ingestion',
        details: error instanceof Error ? error.message : String(error)
      });
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
  
  // Pull sample data from a data source (SFTP/FTP)
  app.post("/api/data-sources/:id/pull-sample", async (req, res) => {
    try {
      const id = Number(req.params.id);
      
      // Get the data source
      const dataSource = await storage.getDataSource(id);
      
      if (!dataSource) {
        return res.status(404).json({
          success: false,
          message: "Data source not found"
        });
      }
      
      // Get request parameters
      const { path: remotePath, limit = 100 } = req.body;
      
      if (!remotePath) {
        return res.status(400).json({
          success: false,
          message: "Remote path is required"
        });
      }
      
      // Handle SFTP data source
      if (dataSource.type === 'sftp') {
        const { pullSampleFromSFTP } = await import('./utils/ftp-ingestion');
        
        // Extract credentials from data source config
        let config = dataSource.config;
        if (typeof config === 'string') {
          try {
            config = JSON.parse(config);
          } catch (e) {
            return res.status(400).json({
              success: false,
              message: "Invalid data source configuration"
            });
          }
        }
        
        // Prepare credentials for SFTP
        const typedConfig = config as any;
        const credentials = {
          host: typedConfig.host,
          port: typedConfig.port || 22,
          username: typedConfig.username,
          password: typedConfig.password || process.env.SFTP_PASSWORD,
          secure: typedConfig.secure || false,
          remoteDir: typedConfig.path || '/',
          privateKey: typedConfig.privateKey || undefined,
          passphrase: typedConfig.passphrase || undefined
        };
        
        console.log(`Pulling sample data from ${dataSource.type} path: ${remotePath}`);
        
        try {
          // Pull sample from SFTP
          const result = await pullSampleFromSFTP(credentials, remotePath, {
            limit: Number(limit),
            hasHeader: true
          });
          
          // Return the result
          return res.json({
            success: result.success,
            message: result.message,
            sample_data: result.records || [],
            headers: result.headers || [],
            remote_path: remotePath,
            total_records: result.records?.length || 0
          });
        } catch (pullError) {
          console.error("Error pulling SFTP sample:", pullError);
          return res.status(500).json({
            success: false,
            message: pullError instanceof Error ? pullError.message : "Failed to pull SFTP sample data",
            error_details: {
              error: pullError instanceof Error ? pullError.message : String(pullError),
              path: pathToUse,
              host: credentials.host
            }
          });
        }
      } 
      // Add support for other data source types as needed
      else {
        return res.status(400).json({
          success: false,
          message: `Sample data pull not implemented for ${dataSource.type} data sources`
        });
      }
    } catch (error) {
      console.error("Error pulling sample data:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to pull sample data"
      });
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
  
  // Test pull data from a data source
  app.post("/api/test-pull/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { path: remotePath, limit = 50 } = req.body;
      
      // Check if data source exists
      const dataSource = await storage.getDataSource(id);
      
      if (!dataSource) {
        return res.status(404).json({ 
          success: false,
          message: "Data source not found" 
        });
      }
      
      // Handle SFTP data sources
      if (dataSource.type === 'sftp') {
        // Import the function
        const { pullSampleFromSFTP } = await import('./utils/ftp-ingestion');
        
        // Extract credentials from data source config
        let config = dataSource.config;
        if (typeof config === 'string') {
          try {
            config = JSON.parse(config);
          } catch (e) {
            return res.status(400).json({
              success: false,
              message: "Invalid data source configuration"
            });
          }
        }
        
        // Prepare credentials - using type assertion for config
        const typedConfig = config as any;
        const credentials = {
          host: typedConfig.host,
          port: typedConfig.port || 22,
          username: typedConfig.username,
          password: typedConfig.password || process.env.SFTP_PASSWORD,
          secure: typedConfig.secure !== false,
          remoteDir: typedConfig.path || '/',
          privateKey: typedConfig.privateKey || undefined,
          passphrase: typedConfig.passphrase || undefined
        };
        
        // If no specific remote path provided, use the first one in the config
        let pathToUse = remotePath;
        if (!pathToUse && typedConfig.remote_paths && typedConfig.remote_paths.length > 0) {
          pathToUse = typedConfig.remote_paths[0].path;
        }
        
        if (!pathToUse) {
          return res.status(400).json({
            success: false,
            message: "No remote path specified"
          });
        }
        
        console.log(`Attempting SFTP connection to ${credentials.host}:${credentials.port} with path: ${pathToUse}`);
        console.log("SFTP credentials:", { 
          host: credentials.host, 
          port: credentials.port, 
          username: credentials.username,
          hasPassword: !!credentials.password,
          remoteDir: credentials.remoteDir
        });
        
        try {
          console.log("Starting SFTP data pull with credentials:", {
            host: credentials.host,
            port: credentials.port,
            username: credentials.username,
            path: pathToUse
          });
          
          // Pull sample from SFTP directly
          const result = await pullSampleFromSFTP(credentials, pathToUse, {
            limit: Math.min(limit, 100), // Cap at 100 records for mapping
            hasHeader: true,
          });
          
          console.log("SFTP pull result:", {
            success: result.success,
            message: result.message,
            recordCount: result.records?.length || 0,
            hasHeaders: result.headers?.length || 0
          });
          
          if (!result.success) {
            console.error("SFTP pull failed:", result.message);
            res.setHeader('Content-Type', 'application/json');
            return res.status(400).json({
              success: false,
              message: result.message || "SFTP data pull failed",
              error_details: {
                host: credentials.host,
                path: pathToUse,
                error: result.error?.message || result.message
              }
            });
          }
        
        // Ensure we have valid data to return
        const sampleData = result.records || [];
        const headers = result.headers || [];
        
        console.log("Returning SFTP data:", {
          recordCount: sampleData.length,
          headerCount: headers.length,
          firstRecord: sampleData[0] || null
        });
        
        res.setHeader('Content-Type', 'application/json');
        return res.json({
          success: true,
          message: `Successfully loaded ${sampleData.length} records from ${pathToUse}`,
          sample_data: sampleData,
          headers: headers,
          schema_validation: [],
          mapping_suggestion: null,
          mapping_confidence: 0.8
        });
        
      } catch (error) {
        console.error("SFTP error:", error);
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({
          success: false,
          message: error instanceof Error ? error.message : "SFTP connection failed"
        });
      }
      
      } else {
        // Handle other data source types
        // For other types, return sample data as a placeholder
        const sampleData = [
          { sku: "ABC123", name: "Test Product 1", price: "19.99", inventory: "100" },
          { sku: "DEF456", name: "Test Product 2", price: "29.99", inventory: "50" },
          { sku: "GHI789", name: "Test Product 3", price: "39.99", inventory: "75" }
        ];
        
        // Log info for debugging
        console.log(`Test pull request for data source ${id}, path: ${remotePath} (using mock data for type ${dataSource.type})`);
        
        return res.json({
          success: true,
          message: `Sample data retrieved successfully (mock data for ${dataSource.type})`,
          sample_data: sampleData,
          remote_path: remotePath,
          total_records: sampleData.length
        });
      }
    } catch (error) {
      console.error("Error in test-pull:", error);
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to pull test data"
      });
    }
  });

  // Import sample data using a mapping template
  app.post("/api/mapping-templates/:id/import-sample", async (req, res) => {
    try {
      const templateId = Number(req.params.id);
      const { dataSourceId, remotePath, recordLimit = 10 } = req.body;

      // Get the mapping template
      const template = await storage.getMappingTemplate(templateId);
      if (!template) {
        return res.status(404).json({ 
          success: false, 
          message: "Mapping template not found" 
        });
      }

      // Get the data source
      const dataSource = await storage.getDataSource(dataSourceId);
      if (!dataSource) {
        return res.status(404).json({ 
          success: false, 
          message: "Data source not found" 
        });
      }

      // Pull sample data from the source
      let sampleData = [];
      if (dataSource.type === 'sftp') {
        const { pullSampleFromSFTP } = await import('./utils/ftp-ingestion');
        
        let config = dataSource.config;
        if (typeof config === 'string') {
          config = JSON.parse(config);
        }
        
        const typedConfig = config as any;
        const credentials = {
          host: typedConfig.host,
          port: typedConfig.port || 22,
          username: typedConfig.username,
          password: typedConfig.password || process.env.SFTP_PASSWORD,
          secure: typedConfig.secure || false,
          remoteDir: typedConfig.path || '/',
          privateKey: typedConfig.privateKey || undefined,
          passphrase: typedConfig.passphrase || undefined
        };

        const result = await pullSampleFromSFTP(credentials, remotePath, {
          limit: recordLimit,
          hasHeader: true
        });

        if (!result.success) {
          return res.status(500).json({
            success: false,
            message: result.message
          });
        }

        sampleData = result.records || [];
      }

      // Parse the template mappings
      let mappings = template.mappings;
      if (typeof mappings === 'string') {
        mappings = JSON.parse(mappings);
      }

      // Process each record using the mapping template
      const processedProducts = [];
      let successCount = 0;
      let errorCount = 0;

      for (const record of sampleData) {
        try {
          // Generate numeric EDC code (6 digits)
          const edcSku = String(Math.floor(Math.random() * 900000) + 100000);
          
          // Apply catalog mappings
          const catalogData: any = { sku: edcSku };
          const productDetailData: any = { sku: edcSku };

          // Process catalog mappings - handle both old and new mapping format
          if (mappings.catalog) {
            for (const mapping of mappings.catalog) {
              if (mapping.sourceField && mapping.targetField && record[mapping.sourceField]) {
                catalogData[mapping.targetField] = record[mapping.sourceField];
              }
            }
          } else {
            // Handle direct mappings object format
            for (const [sourceField, targetField] of Object.entries(mappings)) {
              if (record[sourceField]) {
                catalogData[targetField as string] = record[sourceField];
              }
            }
          }

          // Process product detail mappings  
          if (mappings.productDetail) {
            for (const mapping of mappings.productDetail) {
              if (mapping.sourceField && mapping.targetField && record[mapping.sourceField]) {
                productDetailData[mapping.targetField] = record[mapping.sourceField];
              }
            }
          }

          // Set required fields and defaults
          catalogData.status = catalogData.status || 'active';
          catalogData.supplierId = dataSource.supplierId;
          catalogData.supplierCode = dataSource.name;
          
          // Handle category field - if it's text, store as null for now
          if (catalogData.categoryId && typeof catalogData.categoryId === 'string') {
            catalogData.categoryId = null;
          }
          
          // Apply automatic description processing if HTML is detected
          if (catalogData.description && catalogData.description.includes('<')) {
            try {
              const cleanText = catalogData.description
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&trade;/g, '™')
                .replace(/&reg;/g, '®')
                .replace(/&copy;/g, '©')
                .replace(/\s+/g, ' ')
                .trim();
              catalogData.description = cleanText;
              console.log('🧹 Automatically processed HTML description to clean text');
            } catch (error) {
              console.error('Error processing description:', error);
            }
          }
          
          // Debug: Log the mapping and record data
          console.log('Available CWR fields:', Object.keys(record));
          console.log('Mapped catalog data:', catalogData);
          console.log('Template mappings:', mappings);
          
          // Ensure required fields have values - use fallbacks if mapping fails
          if (!catalogData.product_name && !catalogData.name) {
            // Try different CWR title fields as fallback
            catalogData.name = record['Title'] || record['Uppercase Title'] || `Product ${edcSku}`;
            console.log('Set fallback name:', catalogData.name);
          } else if (catalogData.product_name) {
            catalogData.name = catalogData.product_name;
          }

          // Parse costs and prices
          if (catalogData.cost) catalogData.cost = parseFloat(catalogData.cost) || 0;
          if (catalogData.price) catalogData.price = parseFloat(catalogData.price) || 0;

          // Handle special product flags from CWR data
          const flags = {
            isRemanufactured: record['Remanufactured'] === '1',
            isCloseout: record['Closeout'] === '1', 
            isOnSale: record['Sale'] === '1',
            hasRebate: record['Rebate'] === '1',
            hasFreeShipping: record['Free Shipping'] === '1'
          };

          // Create the product with all data
          const productData = {
            ...catalogData,
            ...productDetailData,
            ...flags,
            rawSupplierData: JSON.stringify(record),
            importedAt: new Date(),
            mappingTemplateId: templateId
          };
          
          // Final cleanup - ensure categoryId is null if it's still a string
          if (productData.categoryId && typeof productData.categoryId === 'string') {
            productData.categoryId = null;
          }

          // Save to storage
          const newProduct = await storage.createProduct(productData);
          processedProducts.push(newProduct);
          successCount++;

        } catch (error) {
          console.error("Error processing record:", error);
          errorCount++;
        }
      }

      // Create import log
      const importLog = await storage.createImport({
        filename: `Sample Import - ${template.name}`,
        type: 'sample',
        status: successCount > 0 ? 'success' : 'error',
        recordCount: sampleData.length,
        processedCount: successCount,
        errorCount: errorCount,
        supplierId: dataSource.supplierId,
        mappingTemplateId: templateId,
        completedAt: new Date()
      });

      res.json({
        success: true,
        message: `Successfully imported ${successCount} of ${sampleData.length} sample records`,
        importId: importLog.id,
        products: processedProducts,
        stats: {
          total: sampleData.length,
          success: successCount,
          errors: errorCount
        }
      });

    } catch (error) {
      console.error("Sample import error:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to import sample data"
      });
    }
  });
  
  // Get remote paths for an SFTP/FTP data source
  app.get("/api/data-sources/:id/remote-paths", async (req, res) => {
    try {
      const id = Number(req.params.id);
      
      // Check if data source exists
      const dataSource = await storage.getDataSource(id);
      
      if (!dataSource) {
        return res.status(404).json({ 
          success: false,
          message: "Data source not found" 
        });
      }
      
      // Handle SFTP/FTP data sources
      if (dataSource.type === 'sftp' || dataSource.type === 'ftp') {
        // Import the function
        const { getRemotePaths } = await import('./utils/ftp-ingestion');
        
        // Extract credentials from data source config
        let config = dataSource.config;
        if (typeof config === 'string') {
          try {
            config = JSON.parse(config);
          } catch (e) {
            return res.status(400).json({
              success: false,
              message: "Invalid data source configuration"
            });
          }
        }
        
        // Prepare credentials for FTP/SFTP
        const typedConfig = config as any;
        const credentials = {
          host: typedConfig.host,
          port: typedConfig.port || (dataSource.type === 'sftp' ? 22 : 21),
          username: typedConfig.username,
          password: typedConfig.password || process.env.SFTP_PASSWORD,
          secure: typedConfig.secure || false,
          remoteDir: typedConfig.path || '/',
          privateKey: typedConfig.privateKey || undefined,
          passphrase: typedConfig.passphrase || undefined
        };
        
        // Log the connection attempt for debugging
        console.log(`Fetching remote paths for ${dataSource.type} data source ${id} at ${credentials.host}`);
        
        // Get remote paths from the server
        const result = await getRemotePaths(credentials);
        
        if (result.success) {
          return res.json({
            success: true,
            message: result.message,
            paths: result.paths
          });
        } else {
          return res.status(400).json({
            success: false,
            message: result.message
          });
        }
      } else {
        // For non-FTP/SFTP data sources return an empty array
        return res.json({
          success: true,
          message: `Remote paths not applicable for ${dataSource.type} data source`,
          paths: []
        });
      }
    } catch (error) {
      console.error("Error fetching remote paths:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to fetch remote paths"
      });
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
  
  // File upload for sample data to assist with mapping template creation
  app.post("/api/mapping-templates/sample-upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded"
        });
      }
      
      const filePath = req.file.path;
      const fileType = req.file.mimetype;
      const fileName = req.file.originalname;
      const extension = path.extname(fileName).toLowerCase();
      
      let records = [];
      let headers = [];
      
      // Process file based on type
      if (extension === ".csv" || fileType.includes("csv")) {
        // CSV Processing
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const parser = parse(fileContent, {
          columns: true,
          skip_empty_lines: true
        });
        
        // Process records
        let recordCount = 0;
        const maxRecords = 20; // Limit to 20 records for the sample
        
        for await (const record of parser) {
          if (recordCount === 0) {
            // First record - get headers
            headers = Object.keys(record);
          }
          
          if (recordCount < maxRecords) {
            records.push(record);
          }
          
          recordCount++;
          if (recordCount >= maxRecords) break;
        }
      } 
      else if (extension === ".xlsx" || extension === ".xls" || fileType.includes("excel") || fileType.includes("spreadsheet")) {
        // Excel Processing
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (data.length > 0) {
          // First row is headers
          headers = data[0];
          
          // Process up to 20 rows of data
          for (let i = 1; i < Math.min(21, data.length); i++) {
            const row = data[i];
            const record = {};
            
            // Create record using headers as keys
            for (let j = 0; j < headers.length; j++) {
              record[headers[j]] = j < row.length ? row[j] : '';
            }
            
            records.push(record);
          }
        }
      }
      else if (extension === ".json" || fileType.includes("json")) {
        // JSON Processing
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(fileContent);
        
        if (Array.isArray(data) && data.length > 0) {
          // Use keys from first object as headers
          headers = Object.keys(data[0]);
          
          // Limit to 20 records
          records = data.slice(0, 20);
        }
      }
      else {
        return res.status(400).json({
          success: false,
          message: "Unsupported file type. Please upload CSV, Excel, or JSON files."
        });
      }
      
      // Clean up the temporary file
      fs.unlinkSync(filePath);
      
      res.json({
        success: true,
        message: `Successfully processed ${records.length} records from ${fileName}`,
        headers,
        records,
        fileType: extension.substring(1) // Remove the dot
      });
    } catch (error) {
      console.error("Error processing sample file:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred processing the file"
      });
    }
  });

  // Process data from SFTP using a mapping template
  app.post("/api/mapping-templates/process-sftp", async (req, res) => {
    try {
      const { dataSourceId, mappingTemplateId, remotePath, deleteAfterProcessing = false } = req.body;
      
      if (!dataSourceId || !mappingTemplateId || !remotePath) {
        return res.status(400).json({
          success: false,
          message: "Missing required parameters: dataSourceId, mappingTemplateId, and remotePath are required"
        });
      }
      
      // Get the data source details
      const [dataSource] = await db.select().from(dataSources).where(eq(dataSources.id, dataSourceId));
      
      if (!dataSource) {
        return res.status(404).json({
          success: false,
          message: `Data source with ID ${dataSourceId} not found`
        });
      }
      
      // Create an import record to track the progress
      const [importRecord] = await db.insert(imports).values({
        type: 'sftp-ingest',
        status: 'pending',
        supplierId: dataSource.supplierId,
        filename: remotePath,
        createdAt: new Date()
      }).returning();
      
      // Process the SFTP ingestion asynchronously
      const processPromise = processSFTPIngestion(
        remotePath,
        { id: dataSourceId, credentials: dataSource.config, type: dataSource.type },
        mappingTemplateId,
        {
          deleteSourceAfterProcessing: deleteAfterProcessing,
          createImportRecord: false, // We already created one
          skipExistingProducts: true 
        },
        importRecord.id
      );
      
      // Start processing in the background
      processPromise.then(result => {
        console.log(`SFTP ingestion result for import ${importRecord.id}:`, result);
      }).catch(error => {
        console.error(`SFTP ingestion error for import ${importRecord.id}:`, error);
      });
      
      // Return the import ID immediately so the client can track progress
      res.json({
        success: true,
        message: "SFTP ingestion started",
        importId: importRecord.id
      });
    } catch (error) {
      console.error("Error starting SFTP ingestion:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred starting the SFTP ingestion"
      });
    }
  });

  // Product Fulfillment API
  app.get("/api/products/:id/fulfillment", async (req, res) => {
    try {
      const productId = Number(req.params.id);
      const product = await storage.getProduct(productId);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Get fulfillment data for this product from storage
      const fulfillment = await storage.getProductFulfillment(productId);
      
      // If no fulfillment data exists yet, return a default structure
      if (!fulfillment) {
        return res.json({
          internal_stock: {
            enabled: true,
            warehouses: []
          },
          dropship: {
            enabled: false,
            supplier_id: null,
            stock: 0,
            lead_time_days: 1
          },
          bulk_discount_available: false,
          preferred_source: 'auto'
        });
      }
      
      res.json(fulfillment);
    } catch (error) {
      handleError(res, error);
    }
  });
  
  app.post("/api/products/:id/fulfillment", async (req, res) => {
    try {
      const productId = Number(req.params.id);
      const product = await storage.getProduct(productId);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Update fulfillment data
      const updatedFulfillment = await storage.updateProductFulfillment(productId, req.body);
      
      // Create audit log
      await storage.createAuditLog({
        action: "update",
        entityType: "product_fulfillment",
        entityId: productId,
        details: { 
          productId,
          fulfillment: updatedFulfillment
        }
      });
      
      res.json(updatedFulfillment);
    } catch (error) {
      handleError(res, error);
    }
  });
  
  app.get("/api/products/:id/stock", async (req, res) => {
    try {
      const productId = Number(req.params.id);
      const product = await storage.getProduct(productId);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Get stock data from storage
      const stockData = await storage.getProductStock(productId);
      
      res.json(stockData);
    } catch (error) {
      handleError(res, error);
    }
  });
  
  app.get("/api/warehouses", async (req, res) => {
    try {
      const warehouses = await storage.getWarehouses();
      res.json(warehouses);
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

  // DataSources API
  app.get("/api/datasources", async (req, res) => {
    try {
      const dataSources = await storage.getDataSources();
      res.json(dataSources);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get("/api/datasources/:id", async (req, res) => {
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

  app.post("/api/datasources", async (req, res) => {
    try {
      // Parse the config from a string to an object if it's passed as a string
      let dataSourceData = { ...req.body };
      
      if (typeof dataSourceData.config === 'string') {
        try {
          dataSourceData.config = JSON.parse(dataSourceData.config);
        } catch (e) {
          dataSourceData.config = { data: dataSourceData.config };
        }
      }
      
      // Convert supplier_id to supplierId if needed
      if (dataSourceData.supplier_id && !dataSourceData.supplierId) {
        dataSourceData.supplierId = dataSourceData.supplier_id;
        delete dataSourceData.supplier_id;
      }
      
      // Validate with zod schema
      const validatedData = insertDataSourceSchema.parse(dataSourceData);
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

  app.put("/api/datasources/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      
      // Parse the config from a string to an object if it's passed as a string
      let dataSourceData = { ...req.body };
      
      if (typeof dataSourceData.config === 'string') {
        try {
          dataSourceData.config = JSON.parse(dataSourceData.config);
        } catch (e) {
          dataSourceData.config = { data: dataSourceData.config };
        }
      }
      
      // Convert supplier_id to supplierId if needed
      if (dataSourceData.supplier_id && !dataSourceData.supplierId) {
        dataSourceData.supplierId = dataSourceData.supplier_id;
        delete dataSourceData.supplier_id;
      }
      
      // Validate with zod schema
      const validatedData = insertDataSourceSchema.partial().parse(dataSourceData);
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

  app.delete("/api/datasources/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const success = await storage.deleteDataSource(id);
      
      if (!success) {
        return res.status(404).json({ message: "Data source not found" });
      }
      
      // Create audit log
      await storage.createAuditLog({
        action: "delete",
        entityType: "dataSource",
        entityId: id
      });
      
      res.status(204).send();
    } catch (error) {
      handleError(res, error);
    }
  });

  // Register marketplace routes
  app.use("/api/marketplace", marketplaceRoutes);
  
  // Direct implementation of scheduling routes until we fix the module structure
  
  // Utility function to handle errors
  const handleError = (res: Response, error: any) => {
    console.error('API Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Unknown error occurred'
    });
  };
  
  // Get all schedules for a data source
  app.get("/api/schedules", async (req, res) => {
    try {
      const dataSourceId = req.query.dataSourceId ? Number(req.query.dataSourceId) : undefined;
      
      // If dataSourceId is provided, filter by it
      const results = dataSourceId 
        ? await db.select().from(schedules).where(eq(schedules.dataSourceId, dataSourceId))
        : await db.select().from(schedules);
      
      res.json(results);
    } catch (error) {
      handleError(res, error);
    }
  });
  
  // Create a new schedule
  app.post("/api/schedules", async (req, res) => {
    try {
      const { 
        dataSourceId, remotePath, pathLabel, frequency,
        hour, minute, dayOfWeek, dayOfMonth, customCron,
        startDate, endDate 
      } = req.body;
      
      // Simple validation
      if (!dataSourceId || !frequency) {
        return res.status(400).json({ 
          error: 'Invalid schedule data', 
          details: 'dataSourceId and frequency are required' 
        });
      }
      
      // Verify data source exists
      const [dataSource] = await db
        .select()
        .from(dataSources)
        .where(eq(dataSources.id, dataSourceId));
      
      if (!dataSource) {
        return res.status(404).json({ error: 'Data source not found' });
      }
      
      // Calculate next run time (simplified)
      const nextRun = new Date();
      nextRun.setDate(nextRun.getDate() + 1); // Default to tomorrow
      
      const [created] = await db
        .insert(schedules)
        .values({
          dataSourceId,
          remotePath,
          pathLabel,
          frequency,
          hour: hour || 0,
          minute: minute || 0,
          dayOfWeek: dayOfWeek || null,
          dayOfMonth: dayOfMonth || null,
          customCron: customCron || null,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          nextRun
        })
        .returning();
      
      res.status(201).json(created);
    } catch (error) {
      handleError(res, error);
    }
  });
  
  // Update an existing schedule
  app.patch("/api/schedules/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { 
        dataSourceId, remotePath, pathLabel, frequency,
        hour, minute, dayOfWeek, dayOfMonth, customCron,
        startDate, endDate 
      } = req.body;
      
      // Verify schedule exists
      const [existingSchedule] = await db
        .select()
        .from(schedules)
        .where(eq(schedules.id, id));
      
      if (!existingSchedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }
      
      // Calculate next run time (simplified)
      const nextRun = new Date();
      nextRun.setDate(nextRun.getDate() + 1); // Default to tomorrow
      
      const [updated] = await db
        .update(schedules)
        .set({
          dataSourceId: dataSourceId || existingSchedule.dataSourceId,
          remotePath: remotePath !== undefined ? remotePath : existingSchedule.remotePath,
          pathLabel: pathLabel !== undefined ? pathLabel : existingSchedule.pathLabel,
          frequency: frequency || existingSchedule.frequency,
          hour: hour !== undefined ? hour : existingSchedule.hour,
          minute: minute !== undefined ? minute : existingSchedule.minute,
          dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : existingSchedule.dayOfWeek,
          dayOfMonth: dayOfMonth !== undefined ? dayOfMonth : existingSchedule.dayOfMonth,
          customCron: customCron !== undefined ? customCron : existingSchedule.customCron,
          startDate: startDate ? new Date(startDate) : existingSchedule.startDate,
          endDate: endDate ? new Date(endDate) : existingSchedule.endDate,
          nextRun,
          updatedAt: new Date()
        })
        .where(eq(schedules.id, id))
        .returning();
      
      res.json(updated);
    } catch (error) {
      handleError(res, error);
    }
  });
  
  // Delete a schedule
  app.delete("/api/schedules/:id", async (req, res) => {
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
      handleError(res, error);
    }
  });
  
  // Register connections management routes
  // Register connections routes directly
  registerConnectionsRoutes(app);

  const httpServer = createServer(app);

  return httpServer;
}
