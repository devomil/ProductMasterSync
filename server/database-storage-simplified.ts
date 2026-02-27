import { db } from './db';
import { eq, and, or, like, isNull, desc, asc, sql, count } from 'drizzle-orm';
import { queryCache } from './query-cache';
import * as schema from "@shared/schema";
import type {
  User, InsertUser,
  Supplier, InsertSupplier,
  Category, InsertCategory,
  Product, InsertProduct,
  ProductSupplier, InsertProductSupplier,
  Import, InsertImport,
  Export, InsertExport, 
  Approval, InsertApproval,
  AuditLog, InsertAuditLog,
  // Data integration entities
  DataSource, InsertDataSource,
  Schedule, InsertSchedule,
  MappingTemplate, InsertMappingTemplate,
  DataLineage, InsertDataLineage,
  DataMergingConfig, InsertDataMergingConfig,
  Workflow, InsertWorkflow,
  WorkflowExecution, InsertWorkflowExecution,
  CustomCatalogField, InsertCustomCatalogField
} from "@shared/schema";

import { IStorage } from './storage';

export class DatabaseStorage implements IStorage {
  // User management
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [createdUser] = await db.insert(schema.users).values(user).returning();
    return createdUser;
  }

  // Supplier management
  async getSuppliers(): Promise<Supplier[]> {
    return await db.select().from(schema.suppliers);
  }

  async getSupplier(id: number): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(schema.suppliers).where(eq(schema.suppliers.id, id));
    return supplier;
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const [createdSupplier] = await db.insert(schema.suppliers).values(supplier).returning();
    return createdSupplier;
  }

  async updateSupplier(id: number, supplier: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const [updatedSupplier] = await db
      .update(schema.suppliers)
      .set(supplier)
      .where(eq(schema.suppliers.id, id))
      .returning();
    return updatedSupplier;
  }

  async deleteSupplier(id: number): Promise<boolean> {
    // Delete related records first to avoid foreign key constraint violations
    // Delete supplier category mappings
    await db.delete(schema.supplierCategoryMappings)
      .where(eq(schema.supplierCategoryMappings.supplierId, id));
    
    // Delete product suppliers relationships
    await db.delete(schema.productSuppliers)
      .where(eq(schema.productSuppliers.supplierId, id));
    
    // Delete related imports (set supplierId to null or delete if required)
    await db.update(schema.imports)
      .set({ supplierId: null })
      .where(eq(schema.imports.supplierId, id));
    
    // Delete data sources
    await db.delete(schema.dataSources)
      .where(eq(schema.dataSources.supplierId, id));
    
    // Delete supplier automations
    await db.delete(schema.supplierAutomation)
      .where(eq(schema.supplierAutomation.supplierId, id));
    
    // Now delete the supplier
    const [deletedSupplier] = await db
      .delete(schema.suppliers)
      .where(eq(schema.suppliers.id, id))
      .returning();
    return !!deletedSupplier;
  }

  // Category management
  async getCategories(): Promise<Category[]> {
    const categoriesWithCounts = await db
      .select({
        id: schema.categories.id,
        name: schema.categories.name,
        code: schema.categories.code,
        parentId: schema.categories.parentId,
        level: schema.categories.level,
        path: schema.categories.path,
        createdAt: schema.categories.createdAt,
        updatedAt: schema.categories.updatedAt,
        attributes: schema.categories.attributes,
        productCount: count(schema.products.id),
      })
      .from(schema.categories)
      .leftJoin(schema.products, eq(schema.categories.id, schema.products.categoryId))
      .groupBy(schema.categories.id)
      .orderBy(schema.categories.level, schema.categories.name);
    
    return categoriesWithCounts.map(cat => ({
      ...cat,
      productCount: Number(cat.productCount) || 0
    }));
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(schema.categories).where(eq(schema.categories.id, id));
    return category;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [createdCategory] = await db.insert(schema.categories).values(category).returning();
    return createdCategory;
  }

  async updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined> {
    const [updatedCategory] = await db
      .update(schema.categories)
      .set(category)
      .where(eq(schema.categories.id, id))
      .returning();
    return updatedCategory;
  }

  async deleteCategory(id: number): Promise<boolean> {
    await db.delete(schema.categories).where(eq(schema.categories.id, id));
    return true;
  }

  // Category mapping management
  async getCategoryMappings(): Promise<any[]> {
    return await db
      .select({
        id: schema.supplierCategoryMappings.id,
        supplierId: schema.supplierCategoryMappings.supplierId,
        supplierName: schema.suppliers.name,
        supplierCategoryName: schema.supplierCategoryMappings.supplierCategoryName,
        masterCategoryId: schema.supplierCategoryMappings.masterCategoryId,
        masterCategoryName: schema.categories.name,
        confidence: schema.supplierCategoryMappings.confidence,
        isApproved: schema.supplierCategoryMappings.isApproved,
        productCount: sql<number>`0`
      })
      .from(schema.supplierCategoryMappings)
      .leftJoin(schema.suppliers, eq(schema.supplierCategoryMappings.supplierId, schema.suppliers.id))
      .leftJoin(schema.categories, eq(schema.supplierCategoryMappings.masterCategoryId, schema.categories.id));
  }

  async getUnmappedSupplierCategories(): Promise<any[]> {
    // This would require complex logic to find supplier categories not yet mapped
    // For now, return empty array - can be enhanced later
    return [];
  }

  async createCategoryMapping(mappingData: any): Promise<any> {
    const [createdMapping] = await db
      .insert(schema.supplierCategoryMappings)
      .values(mappingData)
      .returning();
    return createdMapping;
  }

  async updateCategoryMapping(id: number, mappingData: any): Promise<any> {
    const [updatedMapping] = await db
      .update(schema.supplierCategoryMappings)
      .set(mappingData)
      .where(eq(schema.supplierCategoryMappings.id, id))
      .returning();
    return updatedMapping;
  }

  async createCategoryMapping(mapping: any): Promise<any> {
    const [createdMapping] = await db
      .insert(schema.supplierCategoryMappings)
      .values(mapping)
      .returning();
    return createdMapping;
  }

  async updateCategoryMapping(id: number, mapping: any): Promise<any> {
    const [updatedMapping] = await db
      .update(schema.supplierCategoryMappings)
      .set(mapping)
      .where(eq(schema.supplierCategoryMappings.id, id))
      .returning();
    return updatedMapping;
  }

  // Product management
  async getProducts(): Promise<Product[]> {
    const cacheKey = 'products:all';
    const cached = queryCache.get<Product[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Optimized query - only essential fields for product listing
    const products = await db.select({
      id: schema.products.id,
      sku: schema.products.sku,
      usin: schema.products.usin,
      name: schema.products.name,
      description: schema.products.description,
      categoryId: schema.products.categoryId,
      manufacturerName: schema.products.manufacturerName,
      manufacturerPartNumber: schema.products.manufacturerPartNumber,
      upc: schema.products.upc,
      price: schema.products.price,
      cost: schema.products.cost,
      weight: schema.products.weight,
      status: schema.products.status,
      isRemanufactured: schema.products.isRemanufactured,
      isCloseout: schema.products.isCloseout,
      isOnSale: schema.products.isOnSale,
      hasRebate: schema.products.hasRebate,
      hasFreeShipping: schema.products.hasFreeShipping,
      inventoryQuantity: schema.products.inventoryQuantity,
      imageUrl: schema.products.imageUrl,
      imageUrlLarge: schema.products.imageUrlLarge,
      lastAmazonSync: schema.products.lastAmazonSync,
      amazonSyncStatus: schema.products.amazonSyncStatus,
      createdAt: schema.products.createdAt,
      updatedAt: schema.products.updatedAt,
    }).from(schema.products)
    .orderBy(desc(schema.products.id))
    .limit(5000); // Limit result set for better performance

    queryCache.set(cacheKey, products, 20000); // Cache for 20 seconds
    return products;
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select({
      id: schema.products.id,
      sku: schema.products.sku,
      usin: schema.products.usin,
      manufacturerPartNumber: schema.products.manufacturerPartNumber,
      upc: schema.products.upc,
      name: schema.products.name,
      description: schema.products.description,
      categoryId: schema.products.categoryId,
      manufacturerId: schema.products.manufacturerId,
      manufacturerName: schema.products.manufacturerName,
      price: schema.products.price,
      cost: schema.products.cost,
      weight: schema.products.weight,
      dimensions: schema.products.dimensions,
      attributes: schema.products.attributes,
      status: schema.products.status,
      isRemanufactured: schema.products.isRemanufactured,
      isCloseout: schema.products.isCloseout,
      isOnSale: schema.products.isOnSale,
      hasRebate: schema.products.hasRebate,
      hasFreeShipping: schema.products.hasFreeShipping,
      inventoryQuantity: schema.products.inventoryQuantity,
      reorderThreshold: schema.products.reorderThreshold,
      // Image fields from CWR feed
      imageUrl: schema.products.imageUrl,
      imageUrlLarge: schema.products.imageUrlLarge,
      additionalImages: schema.products.additionalImages,
      primaryImage: schema.products.primaryImage,
      // Additional fields
      thirdPartyMarketplaces: schema.products.thirdPartyMarketplaces,
      caseQuantity: schema.products.caseQuantity,
      googleMerchantCategory: schema.products.googleMerchantCategory,
      countryOfOrigin: schema.products.countryOfOrigin,
      boxHeight: schema.products.boxHeight,
      boxLength: schema.products.boxLength,
      boxWidth: schema.products.boxWidth,
      installationGuideUrl: schema.products.installationGuideUrl,
      ownersManualUrl: schema.products.ownersManualUrl,
      brochureUrl: schema.products.brochureUrl,
      quickGuideUrl: schema.products.quickGuideUrl,
      isOversized: schema.products.isOversized,
      isReturnable: schema.products.isReturnable,
      quickSpecs: schema.products.quickSpecs,
      nextShipmentDateNJ: schema.products.nextShipmentDateNJ,
      nextShipmentDateFL: schema.products.nextShipmentDateFL,
      nextShipmentDateCombined: schema.products.nextShipmentDateCombined,
      lastAmazonSync: schema.products.lastAmazonSync,
      amazonSyncStatus: schema.products.amazonSyncStatus,
      createdAt: schema.products.createdAt,
      updatedAt: schema.products.updatedAt,
    }).from(schema.products).where(eq(schema.products.id, id));
    return product;
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    const [product] = await db.select().from(schema.products).where(eq(schema.products.sku, sku));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    // Clean up category field if it's a string
    const cleanProduct = { ...product };
    if (cleanProduct.categoryId && typeof cleanProduct.categoryId === 'string') {
      cleanProduct.categoryId = null;
    }
    
    const [createdProduct] = await db.insert(schema.products).values(cleanProduct).returning();
    return createdProduct;
  }

  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updatedProduct] = await db
      .update(schema.products)
      .set(product)
      .where(eq(schema.products.id, id))
      .returning();
    return updatedProduct;
  }

  async deleteProduct(id: number): Promise<boolean> {
    await db.delete(schema.products).where(eq(schema.products.id, id));
    return true;
  }

  // Product Supplier management
  async getProductSuppliers(productId: number): Promise<ProductSupplier[]> {
    return await db
      .select()
      .from(schema.productSuppliers)
      .where(eq(schema.productSuppliers.productId, productId));
  }

  async createProductSupplier(productSupplier: InsertProductSupplier): Promise<ProductSupplier> {
    const [createdProductSupplier] = await db
      .insert(schema.productSuppliers)
      .values(productSupplier)
      .returning();
    return createdProductSupplier;
  }

  async updateProductSupplier(id: number, productSupplier: Partial<InsertProductSupplier>): Promise<ProductSupplier | undefined> {
    const [updatedProductSupplier] = await db
      .update(schema.productSuppliers)
      .set(productSupplier)
      .where(eq(schema.productSuppliers.id, id))
      .returning();
    return updatedProductSupplier;
  }

  // Import management
  async getImports(): Promise<Import[]> {
    return await db.select().from(schema.imports).orderBy(desc(schema.imports.createdAt));
  }

  async getImport(id: number): Promise<Import | undefined> {
    const [importData] = await db.select().from(schema.imports).where(eq(schema.imports.id, id));
    return importData;
  }

  async createImport(importData: InsertImport): Promise<Import> {
    const [createdImport] = await db.insert(schema.imports).values(importData).returning();
    return createdImport;
  }

  async updateImport(id: number, importData: Partial<InsertImport>): Promise<Import | undefined> {
    const [updatedImport] = await db
      .update(schema.imports)
      .set(importData)
      .where(eq(schema.imports.id, id))
      .returning();
    return updatedImport;
  }

  // Export management
  async getExports(): Promise<Export[]> {
    return await db.select().from(schema.exports).orderBy(desc(schema.exports.createdAt));
  }

  async getExport(id: number): Promise<Export | undefined> {
    const [exportData] = await db.select().from(schema.exports).where(eq(schema.exports.id, id));
    return exportData;
  }

  async createExport(exportData: InsertExport): Promise<Export> {
    const [createdExport] = await db.insert(schema.exports).values(exportData).returning();
    return createdExport;
  }

  async updateExport(id: number, exportData: Partial<InsertExport>): Promise<Export | undefined> {
    const [updatedExport] = await db
      .update(schema.exports)
      .set(exportData)
      .where(eq(schema.exports.id, id))
      .returning();
    return updatedExport;
  }

  // Approval management
  async getApprovals(): Promise<Approval[]> {
    return await db.select().from(schema.approvals).orderBy(desc(schema.approvals.createdAt));
  }

  async getApproval(id: number): Promise<Approval | undefined> {
    const [approval] = await db.select().from(schema.approvals).where(eq(schema.approvals.id, id));
    return approval;
  }

  async createApproval(approval: InsertApproval): Promise<Approval> {
    const [createdApproval] = await db.insert(schema.approvals).values(approval).returning();
    return createdApproval;
  }

  async updateApproval(id: number, approval: Partial<InsertApproval>): Promise<Approval | undefined> {
    const [updatedApproval] = await db
      .update(schema.approvals)
      .set(approval)
      .where(eq(schema.approvals.id, id))
      .returning();
    return updatedApproval;
  }

  // Audit logs
  async getAuditLogs(): Promise<AuditLog[]> {
    return await db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.timestamp));
  }

  async createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog> {
    const [createdAuditLog] = await db.insert(schema.auditLogs).values(auditLog).returning();
    return createdAuditLog;
  }

  // Data source management
  async getDataSources(): Promise<DataSource[]> {
    return await db.select().from(schema.dataSources);
  }

  async getDataSource(id: number): Promise<DataSource | undefined> {
    const [dataSource] = await db.select().from(schema.dataSources).where(eq(schema.dataSources.id, id));
    return dataSource;
  }

  async getDataSourcesByType(type: string): Promise<DataSource[]> {
    return await db.select().from(schema.dataSources).where(eq(schema.dataSources.type, type as any));
  }

  async getDataSourcesBySupplier(supplierId: number): Promise<DataSource[]> {
    return await db.select().from(schema.dataSources).where(eq(schema.dataSources.supplierId, supplierId));
  }

  async createDataSource(dataSource: InsertDataSource): Promise<DataSource> {
    const [createdDataSource] = await db.insert(schema.dataSources).values(dataSource).returning();
    return createdDataSource;
  }

  async updateDataSource(id: number, dataSource: Partial<InsertDataSource>): Promise<DataSource | undefined> {
    const [updatedDataSource] = await db
      .update(schema.dataSources)
      .set(dataSource)
      .where(eq(schema.dataSources.id, id))
      .returning();
    return updatedDataSource;
  }

  async deleteDataSource(id: number): Promise<boolean> {
    const [deletedDataSource] = await db
      .delete(schema.dataSources)
      .where(eq(schema.dataSources.id, id))
      .returning();
    return !!deletedDataSource;
  }
  
  // Schedule management
  async getSchedules(): Promise<Schedule[]> {
    return await db.select().from(schema.schedules);
  }

  async getSchedulesByDataSource(dataSourceId: number): Promise<Schedule[]> {
    return await db
      .select()
      .from(schema.schedules)
      .where(eq(schema.schedules.dataSourceId, dataSourceId));
  }

  async getSchedule(id: number): Promise<Schedule | undefined> {
    const [schedule] = await db.select().from(schema.schedules).where(eq(schema.schedules.id, id));
    return schedule;
  }

  async createSchedule(schedule: InsertSchedule): Promise<Schedule> {
    const [createdSchedule] = await db.insert(schema.schedules).values(schedule).returning();
    return createdSchedule;
  }

  async updateSchedule(id: number, schedule: Partial<InsertSchedule>): Promise<Schedule | undefined> {
    const [updatedSchedule] = await db
      .update(schema.schedules)
      .set(schedule)
      .where(eq(schema.schedules.id, id))
      .returning();
    return updatedSchedule;
  }

  async deleteSchedule(id: number): Promise<boolean> {
    await db.delete(schema.schedules).where(eq(schema.schedules.id, id));
    return true;
  }

  async updateScheduleLastRun(id: number, lastRun: Date): Promise<Schedule | undefined> {
    const [updatedSchedule] = await db
      .update(schema.schedules)
      .set({ lastRun })
      .where(eq(schema.schedules.id, id))
      .returning();
    return updatedSchedule;
  }

  async updateScheduleNextRun(id: number, nextRun: Date): Promise<Schedule | undefined> {
    const [updatedSchedule] = await db
      .update(schema.schedules)
      .set({ nextRun })
      .where(eq(schema.schedules.id, id))
      .returning();
    return updatedSchedule;
  }

  // Mapping template management
  async getMappingTemplates(): Promise<MappingTemplate[]> {
    return await db.select().from(schema.mappingTemplates);
  }

  async getMappingTemplate(id: number): Promise<MappingTemplate | undefined> {
    const [mappingTemplate] = await db
      .select()
      .from(schema.mappingTemplates)
      .where(eq(schema.mappingTemplates.id, id));
    return mappingTemplate;
  }

  async getMappingTemplatesBySourceType(sourceType: string): Promise<MappingTemplate[]> {
    return await db
      .select()
      .from(schema.mappingTemplates)
      .where(eq(schema.mappingTemplates.sourceType as any, sourceType));
  }

  async createMappingTemplate(mappingTemplate: InsertMappingTemplate): Promise<MappingTemplate> {
    const [createdMappingTemplate] = await db
      .insert(schema.mappingTemplates)
      .values(mappingTemplate)
      .returning();
    return createdMappingTemplate;
  }

  async updateMappingTemplate(
    id: number,
    mappingTemplate: Partial<InsertMappingTemplate>
  ): Promise<MappingTemplate | undefined> {
    const [updatedMappingTemplate] = await db
      .update(schema.mappingTemplates)
      .set(mappingTemplate)
      .where(eq(schema.mappingTemplates.id, id))
      .returning();
    return updatedMappingTemplate;
  }

  async deleteMappingTemplate(id: number): Promise<boolean> {
    await db.delete(schema.mappingTemplates).where(eq(schema.mappingTemplates.id, id));
    return true;
  }

  // New Automation System - Per-File Path Configuration
  async createSupplierAutomation(automationData: any): Promise<any> {
    const [automation] = await db
      .insert(schema.supplierAutomation)
      .values({
        name: automationData.name,
        supplierId: automationData.supplierId,
        dataSourceId: automationData.dataSourceId,
        isActive: automationData.isActive,
        maxRetryAttempts: automationData.maxRetryAttempts || 3,
        retryDelayMinutes: automationData.retryDelayMinutes || 30,
        pauseOnConsecutiveFailures: automationData.pauseOnConsecutiveFailures || 5,
        notifyOnSuccess: automationData.notifyOnSuccess || false,
        notifyOnFailure: automationData.notifyOnFailure || true,
        notificationEmails: automationData.notificationEmails || []
      })
      .returning();

    // Create file path configurations
    if (automationData.filePaths && automationData.filePaths.length > 0) {
      const filePathInserts = automationData.filePaths.map((fp: any) => ({
        automationId: automation.id,
        label: fp.label,
        filePath: fp.filePath,
        fileType: fp.fileType,
        isEnabled: fp.isEnabled,
        frequency: fp.frequency,
        timesPerDay: fp.timesPerDay,
        startTime: fp.startTime,
        endTime: fp.endTime,
        scheduleTimes: fp.scheduleTimes || [fp.startTime],
        customSchedule: fp.customSchedule,
        dependsOnFileType: fp.dependsOnFileType,
        processingOrder: fp.processingOrder,
        delayAfterDependency: fp.delayAfterDependency || 10
      }));

      await db.insert(schema.automationFilePaths).values(filePathInserts);
    }

    return automation;
  }

  async getSupplierAutomations(): Promise<any[]> {
    const automations = await db
      .select()
      .from(schema.supplierAutomation)
      .leftJoin(schema.suppliers, eq(schema.supplierAutomation.supplierId, schema.suppliers.id))
      .orderBy(desc(schema.supplierAutomation.createdAt));

    // Get file paths for each automation
    const automationsWithPaths = await Promise.all(
      automations.map(async (automation) => {
        const filePaths = await db
          .select()
          .from(schema.automationFilePaths)
          .where(eq(schema.automationFilePaths.automationId, automation.supplier_automation.id))
          .orderBy(schema.automationFilePaths.processingOrder);

        return {
          ...automation.supplier_automation,
          supplier: automation.suppliers,
          filePaths
        };
      })
    );

    return automationsWithPaths;
  }

  async getSupplierAutomationById(id: number): Promise<any | undefined> {
    const [automation] = await db
      .select()
      .from(schema.supplierAutomation)
      .leftJoin(schema.suppliers, eq(schema.supplierAutomation.supplierId, schema.suppliers.id))
      .where(eq(schema.supplierAutomation.id, id));

    if (!automation) return undefined;

    const filePaths = await db
      .select()
      .from(schema.automationFilePaths)
      .where(eq(schema.automationFilePaths.automationId, id))
      .orderBy(schema.automationFilePaths.processingOrder);

    return {
      ...automation.supplier_automation,
      supplier: automation.suppliers,
      filePaths
    };
  }

  async updateSupplierAutomation(id: number, updates: any): Promise<any | undefined> {
    const [updatedAutomation] = await db
      .update(schema.supplierAutomation)
      .set({
        name: updates.name,
        isActive: updates.isActive,
        maxRetryAttempts: updates.maxRetryAttempts,
        retryDelayMinutes: updates.retryDelayMinutes,
        pauseOnConsecutiveFailures: updates.pauseOnConsecutiveFailures,
        notifyOnSuccess: updates.notifyOnSuccess,
        notifyOnFailure: updates.notifyOnFailure,
        notificationEmails: updates.notificationEmails,
        updatedAt: new Date()
      })
      .where(eq(schema.supplierAutomation.id, id))
      .returning();

    // Update file paths if provided
    if (updates.filePaths) {
      // Delete existing file paths
      await db.delete(schema.automationFilePaths).where(eq(schema.automationFilePaths.automationId, id));

      // Insert new file paths
      if (updates.filePaths.length > 0) {
        const filePathInserts = updates.filePaths.map((fp: any) => ({
          automationId: id,
          label: fp.label,
          filePath: fp.filePath,
          fileType: fp.fileType,
          isEnabled: fp.isEnabled,
          frequency: fp.frequency,
          timesPerDay: fp.timesPerDay,
          startTime: fp.startTime,
          endTime: fp.endTime,
          scheduleTimes: fp.scheduleTimes || [fp.startTime],
          customSchedule: fp.customSchedule,
          dependsOnFileType: fp.dependsOnFileType,
          processingOrder: fp.processingOrder,
          delayAfterDependency: fp.delayAfterDependency || 10
        }));

        await db.insert(schema.automationFilePaths).values(filePathInserts);
      }
    }

    return updatedAutomation;
  }

  async deleteSupplierAutomation(id: number): Promise<boolean> {
    // Delete file paths first (due to foreign key constraint)
    await db.delete(schema.automationFilePaths).where(eq(schema.automationFilePaths.automationId, id));
    
    // Delete automation
    await db.delete(schema.supplierAutomation).where(eq(schema.supplierAutomation.id, id));
    
    return true;
  }

  async getAutomationFilePaths(automationId: number): Promise<any[]> {
    return await db
      .select()
      .from(schema.automationFilePaths)
      .where(eq(schema.automationFilePaths.automationId, automationId))
      .orderBy(schema.automationFilePaths.processingOrder);
  }

  async updateAutomationFilePath(id: number, updates: any): Promise<any | undefined> {
    const [updatedFilePath] = await db
      .update(schema.automationFilePaths)
      .set({
        label: updates.label,
        filePath: updates.filePath,
        fileType: updates.fileType,
        isEnabled: updates.isEnabled,
        frequency: updates.frequency,
        timesPerDay: updates.timesPerDay,
        startTime: updates.startTime,
        endTime: updates.endTime,
        scheduleTimes: updates.scheduleTimes,
        customSchedule: updates.customSchedule,
        dependsOnFileType: updates.dependsOnFileType,
        processingOrder: updates.processingOrder,
        delayAfterDependency: updates.delayAfterDependency,
        updatedAt: new Date()
      })
      .where(eq(schema.automationFilePaths.id, id))
      .returning();

    return updatedFilePath;
  }

  // Other methods - simplified implementations
  // For the methods below, we'll provide simplified implementations just to make the interface work

  // Data lineage
  async getDataLineageByProduct(productId: number): Promise<DataLineage[]> {
    return await db
      .select()
      .from(schema.dataLineage)
      .where(eq(schema.dataLineage.productId, productId))
      .orderBy(desc(schema.dataLineage.timestamp));
  }

  async getDataLineageByField(productId: number, fieldName: string): Promise<DataLineage[]> {
    return await db
      .select()
      .from(schema.dataLineage)
      .where(
        and(
          eq(schema.dataLineage.productId, productId),
          eq(schema.dataLineage.field as any, fieldName)
        )
      )
      .orderBy(desc(schema.dataLineage.timestamp));
  }

  async createDataLineage(lineageData: InsertDataLineage): Promise<DataLineage> {
    const [createdLineage] = await db
      .insert(schema.dataLineage)
      .values(lineageData)
      .returning();
    return createdLineage;
  }

  // Data merging configuration
  async getDataMergingConfigs(): Promise<DataMergingConfig[]> {
    return await db.select().from(schema.dataMergingConfig);
  }

  async getDataMergingConfig(id: number): Promise<DataMergingConfig | undefined> {
    const [config] = await db
      .select()
      .from(schema.dataMergingConfig)
      .where(eq(schema.dataMergingConfig.id, id));
    return config;
  }

  async getActiveDataMergingConfig(): Promise<DataMergingConfig | undefined> {
    const [config] = await db
      .select()
      .from(schema.dataMergingConfig)
      .where(eq(schema.dataMergingConfig.active as any, true));
    return config;
  }

  async createDataMergingConfig(config: InsertDataMergingConfig): Promise<DataMergingConfig> {
    // If this is being set as active, deactivate all other configs
    if (config.active) {
      await db
        .update(schema.dataMergingConfig)
        .set({ active: false })
        .where(eq(schema.dataMergingConfig.active as any, true));
    }

    const [createdConfig] = await db
      .insert(schema.dataMergingConfig)
      .values(config)
      .returning();
    return createdConfig;
  }

  async updateDataMergingConfig(
    id: number,
    config: Partial<InsertDataMergingConfig>
  ): Promise<DataMergingConfig | undefined> {
    // If this is being set as active, deactivate all other configs
    if (config.active) {
      await db
        .update(schema.dataMergingConfig)
        .set({ active: false })
        .where(and(
          eq(schema.dataMergingConfig.active as any, true),
          sql`${schema.dataMergingConfig.id} != ${id}`
        ));
    }

    const [updatedConfig] = await db
      .update(schema.dataMergingConfig)
      .set(config)
      .where(eq(schema.dataMergingConfig.id, id))
      .returning();
    return updatedConfig;
  }

  // Workflow management
  async getWorkflows(): Promise<Workflow[]> {
    return await db.select().from(schema.workflows);
  }

  async getWorkflow(id: number): Promise<Workflow | undefined> {
    const [workflow] = await db
      .select()
      .from(schema.workflows)
      .where(eq(schema.workflows.id, id));
    return workflow;
  }

  async getActiveWorkflows(): Promise<Workflow[]> {
    return await db
      .select()
      .from(schema.workflows)
      .where(eq(schema.workflows.active as any, true));
  }

  async createWorkflow(workflow: InsertWorkflow): Promise<Workflow> {
    const [createdWorkflow] = await db
      .insert(schema.workflows)
      .values(workflow)
      .returning();
    return createdWorkflow;
  }

  async updateWorkflow(id: number, workflow: Partial<InsertWorkflow>): Promise<Workflow | undefined> {
    const [updatedWorkflow] = await db
      .update(schema.workflows)
      .set(workflow)
      .where(eq(schema.workflows.id, id))
      .returning();
    return updatedWorkflow;
  }

  // Workflow execution
  async getWorkflowExecutions(workflowId: number): Promise<WorkflowExecution[]> {
    return await db
      .select()
      .from(schema.workflowExecutions)
      .where(eq(schema.workflowExecutions.workflowId, workflowId))
      .orderBy(desc(schema.workflowExecutions.startedAt));
  }

  async getWorkflowExecution(id: number): Promise<WorkflowExecution | undefined> {
    const [execution] = await db
      .select()
      .from(schema.workflowExecutions)
      .where(eq(schema.workflowExecutions.id, id));
    return execution;
  }

  async createWorkflowExecution(execution: InsertWorkflowExecution): Promise<WorkflowExecution> {
    const [createdExecution] = await db
      .insert(schema.workflowExecutions)
      .values({...execution, startedAt: new Date()})
      .returning();
    return createdExecution;
  }

  async updateWorkflowExecution(
    id: number,
    status: string,
    results?: any,
    error?: string
  ): Promise<WorkflowExecution | undefined> {
    const updates: any = { status };
    if (results) updates.results = results;
    if (error) updates.error = error;
    if (status === "completed" || status === "failed") {
      updates.completedAt = new Date();
    }

    const [updatedExecution] = await db
      .update(schema.workflowExecutions)
      .set(updates)
      .where(eq(schema.workflowExecutions.id, id))
      .returning();
    return updatedExecution;
  }

  async completeWorkflowExecution(id: number, results: any): Promise<WorkflowExecution | undefined> {
    return this.updateWorkflowExecution(id, "completed", results);
  }

  async failWorkflowExecution(id: number, error: string): Promise<WorkflowExecution | undefined> {
    return this.updateWorkflowExecution(id, "failed", undefined, error);
  }

  // Warehouse management - Temporary implementations until proper tables are created
  async getWarehouses(): Promise<any[]> {
    // This is a placeholder. In a real implementation, we'd have a warehouses table
    const mockWarehouses = [
      { id: "WH1", name: "Main Warehouse", code: "MAIN", address: { street: "123 Logistics Way", city: "Commerce", state: "CA", postal_code: "90001", country: "USA" }, active: true },
      { id: "WH2", name: "East Coast DC", code: "EASTDC", address: { street: "456 Distribution Ave", city: "Edison", state: "NJ", postal_code: "08817", country: "USA" }, active: true },
      { id: "WH3", name: "Midwest Fulfillment", code: "MIDWEST", address: { street: "789 Supply Chain Blvd", city: "Chicago", state: "IL", postal_code: "60642", country: "USA" }, active: true }
    ];
    return mockWarehouses;
  }
  
  // Product Fulfillment management - Temporary implementations until proper tables are created
  async getProductFulfillment(productId: number): Promise<any | undefined> {
    // In a real implementation, we'd query a dedicated table for this
    const product = await this.getProduct(productId);
    if (!product) return undefined;
    
    // Return mock fulfillment data
    return {
      productId,
      fulfillmentMode: "hybrid", // 'internal', 'dropship', 'hybrid'
      defaultWarehouse: "WH1",
      dropshipEnabled: true,
      dropshipPriority: 2, // 1 = prefer dropship, 2 = prefer internal, 3 = based on inventory
      supplierLeadTimes: {
        "1": 2, // supplier ID 1 has 2 days lead time
        "2": 3  // supplier ID 2 has 3 days lead time
      },
      warehouseInventory: {
        "WH1": 25,
        "WH2": 15,
        "WH3": 0
      }
    };
  }
  
  async updateProductFulfillment(productId: number, fulfillment: any): Promise<any> {
    // In a real implementation, we'd update a dedicated fulfillment table
    const product = await this.getProduct(productId);
    if (!product) throw new Error("Product not found");
    
    // Here we would persist the fulfillment data
    // For now we'll just return the input
    return fulfillment;
  }
  
  async getProductStock(productId: number): Promise<any> {
    // In a real implementation, we'd query inventory and supplier stock tables
    const product = await this.getProduct(productId);
    if (!product) throw new Error("Product not found");
    
    // Return mock stock data
    return {
      productId,
      sku: product.sku,
      internalStock: {
        total: 40,
        available: 35,
        reserved: 5,
        warehouses: [
          { id: "WH1", quantity: 25, available: 22, reserved: 3 },
          { id: "WH2", quantity: 15, available: 13, reserved: 2 },
          { id: "WH3", quantity: 0, available: 0, reserved: 0 }
        ]
      },
      supplierStock: [
        { supplierId: 1, supplierName: "ABC Trading Co.", quantity: 150, available: true, leadTime: "2-3 days" },
        { supplierId: 2, supplierName: "XYZ Supplies Inc.", quantity: 75, available: true, leadTime: "3-5 days" }
      ],
      lowStockThreshold: product.reorderThreshold || 10,
      isLowStock: (product.inventoryQuantity || 0) <= (product.reorderThreshold || 10)
    };
  }

  // Custom catalog fields
  async getCustomCatalogFields(): Promise<CustomCatalogField[]> {
    return await db.select().from(schema.customCatalogFields).orderBy(asc(schema.customCatalogFields.createdAt));
  }

  async createCustomCatalogField(field: InsertCustomCatalogField): Promise<CustomCatalogField> {
    const [created] = await db.insert(schema.customCatalogFields).values(field).returning();
    return created;
  }

  async deleteCustomCatalogField(id: number): Promise<boolean> {
    const result = await db.delete(schema.customCatalogFields).where(eq(schema.customCatalogFields.id, id));
    return true;
  }

  // Shipping template management
  async getShippingTemplatesForSupplier(supplierId: number): Promise<any[]> {
    // For now, return mock shipping templates based on the templates created in the UI
    // In a real implementation, we'd query the shipping_templates table
    if (supplierId === 2) { // CWR Distribution
      return [
        {
          id: 2,
          name: "CWR Distribution",
          supplierId: 2,
          method: "weight_based",
          isDefault: true,
          costRules: [],
          weightRules: [
            { minWeight: 0.1, maxWeight: 20, shippingCost: 15.99 },
            { minWeight: 20.01, maxWeight: 100, shippingCost: 49.99 }
          ],
          combinedRules: [],
          flatRate: null,
          freeShippingThreshold: 500,
          oversizedSurcharge: 0,
          hazmatSurcharge: 0
        }
      ];
    } else if (supplierId === 1) { // Test Marine Supply Co
      return [
        {
          id: 1,
          name: "Test Marine Supply Co",
          supplierId: 1,
          method: "cost_based", 
          isDefault: true,
          costRules: [
            { minCost: 1, maxCost: 100, shippingCost: 12.99 },
            { minCost: 101, maxCost: 500, shippingCost: 8.99 },
            { minCost: 501, maxCost: 1500, shippingCost: 0 }
          ],
          weightRules: [],
          combinedRules: [],
          flatRate: null,
          freeShippingThreshold: 500,
          oversizedSurcharge: 0,
          hazmatSurcharge: 0
        }
      ];
    }
    return [];
  }

  // Supplier Automation Methods
  async getSupplierAutomations() {
    // Return mock automation data for demonstration
    return [
      {
        id: 1,
        name: "CWR Distribution Automation",
        supplierId: 2,
        dataSourceId: 10,
        isActive: true,
        catalogEnabled: true,
        catalogFilePath: "/data/catalog.csv",
        catalogFrequency: "daily",
        catalogTimesPerDay: 2,
        catalogScheduleTimes: ["02:00", "14:00"],
        inventoryEnabled: true,
        inventoryFilePath: "/data/inventory.csv",
        inventoryFrequency: "hourly",
        inventoryTimesPerDay: 12,
        inventoryStartTime: "06:00",
        inventoryEndTime: "22:00",
        waitForCatalogCompletion: true,
        catalogTimeoutMinutes: 30,
        inventoryDelayAfterCatalog: 10,
        maxRetryAttempts: 3,
        retryDelayMinutes: 30,
        pauseOnConsecutiveFailures: 5,
        notifyOnSuccess: false,
        notifyOnFailure: true,
        lastCatalogPull: new Date(Date.now() - 32400000), // 9 hours ago
        lastInventoryPull: new Date(Date.now() - 7200000), // 2 hours ago
        nextCatalogPull: new Date(Date.now() + 3600000), // 1 hour from now
        nextInventoryPull: new Date(Date.now() + 1800000), // 30 minutes from now
        consecutiveFailures: 0,
        totalSuccessfulPulls: 247,
        totalFailedPulls: 3,
        averageProcessingTimeMinutes: 8.5,
        createdAt: new Date(Date.now() - 2592000000), // 30 days ago
        updatedAt: new Date(Date.now() - 86400000) // Yesterday
      }
    ];
  }

  async getSupplierAutomation(id: number) {
    // Return mock data for now since tables don't exist yet
    return {
      id,
      name: "CWR Distribution Automation",
      supplierId: 2,
      dataSourceId: 10,
      catalogFilePath: "/data/catalog.csv",
      inventoryFilePath: "/data/inventory.csv"
    };
  }

  async createSupplierAutomation(data: any) {
    // Return mock created automation for now
    return {
      id: Date.now(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async updateSupplierAutomation(id: number, data: any) {
    // Return mock updated automation for now
    return {
      id,
      ...data,
      updatedAt: new Date()
    };
  }

  async deleteSupplierAutomation(id: number) {
    // Mock deletion success
    return true;
  }

  // Data Pull Jobs Methods
  async getDataPullJobs(filters: { 
    limit?: number, 
    status?: string, 
    supplierId?: number, 
    jobType?: string 
  }) {
    // Return mock job data for demonstration
    return [
      {
        id: 1,
        supplierId: 2,
        dataSourceId: 10,
        jobType: "catalog",
        filePath: "/data/catalog.csv",
        status: "completed",
        scheduledAt: new Date(Date.now() - 86400000),
        recordsProcessed: 28453,
        recordsInserted: 156,
        recordsUpdated: 28297
      },
      {
        id: 2,
        supplierId: 2,
        dataSourceId: 10,
        jobType: "inventory",
        filePath: "/data/inventory.csv",
        status: "completed",
        scheduledAt: new Date(Date.now() - 7200000),
        recordsProcessed: 28453,
        recordsUpdated: 28453
      },
      {
        id: 3,
        supplierId: 2,
        dataSourceId: 10,
        jobType: "inventory",
        filePath: "/data/inventory.csv",
        status: "running",
        scheduledAt: new Date(),
        recordsProcessed: 12000
      }
    ].filter(job => {
      if (filters.status && job.status !== filters.status) return false;
      if (filters.supplierId && job.supplierId !== filters.supplierId) return false;
      if (filters.jobType && job.jobType !== filters.jobType) return false;
      return true;
    }).slice(0, filters.limit || 50);
  }

  async createDataPullJob(data: any) {
    // Return mock created job for now
    return {
      id: Date.now(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async updateDataPullJobStatus(id: number, updates: {
    status?: string,
    errorMessage?: string,
    recordsProcessed?: number,
    completedAt?: Date
  }) {
    // Return mock updated job for now
    return {
      id,
      ...updates,
      updatedAt: new Date()
    };
  }

  // Inventory Snapshots Methods  
  async getInventorySnapshots(productId: number) {
    // Return mock inventory data for now
    return [];
  }

  async createInventorySnapshot(data: any) {
    // Return mock created snapshot for now
    return {
      id: Date.now(),
      ...data,
      createdAt: new Date()
    };
  }

  // Automation Logs Methods
  async getAutomationLogs(automationId: number, filters: { limit?: number, level?: string }) {
    // Return mock logs for now
    return [];
  }

  async createAutomationLog(data: any) {
    // Return mock created log for now
    return {
      id: Date.now(),
      ...data,
      createdAt: new Date()
    };
  }
}