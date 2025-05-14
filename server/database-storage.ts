import { db } from './db';
import { 
  eq, 
  and, 
  or, 
  like, 
  isNull, 
  desc, 
  asc, 
  sql 
} from 'drizzle-orm';
import * as schema from "@shared/schema";
import {
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
  WorkflowExecution, InsertWorkflowExecution
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
    return await db.select().from(suppliers);
  }

  async getSupplier(id: number): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return supplier;
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const [createdSupplier] = await db.insert(suppliers).values(supplier).returning();
    return createdSupplier;
  }

  async updateSupplier(id: number, supplier: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const [updatedSupplier] = await db
      .update(suppliers)
      .set({...supplier, updatedAt: new Date()})
      .where(eq(suppliers.id, id))
      .returning();
    return updatedSupplier;
  }

  // Category management
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [createdCategory] = await db.insert(categories).values(category).returning();
    return createdCategory;
  }

  async updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined> {
    const [updatedCategory] = await db
      .update(categories)
      .set({...category, updatedAt: new Date()})
      .where(eq(categories.id, id))
      .returning();
    return updatedCategory;
  }

  // Product management
  async getProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.sku, sku));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [createdProduct] = await db.insert(products).values(product).returning();
    return createdProduct;
  }

  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updatedProduct] = await db
      .update(products)
      .set({...product, updatedAt: new Date()})
      .where(eq(products.id, id))
      .returning();
    return updatedProduct;
  }

  async deleteProduct(id: number): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id));
    return true; // In PostgreSQL, delete doesn't return affected rows by default
  }

  // Product Supplier management
  async getProductSuppliers(productId: number): Promise<ProductSupplier[]> {
    return await db
      .select()
      .from(productSuppliers)
      .where(eq(productSuppliers.productId, productId));
  }

  async createProductSupplier(productSupplier: InsertProductSupplier): Promise<ProductSupplier> {
    const [createdProductSupplier] = await db
      .insert(productSuppliers)
      .values(productSupplier)
      .returning();
    return createdProductSupplier;
  }

  async updateProductSupplier(id: number, productSupplier: Partial<InsertProductSupplier>): Promise<ProductSupplier | undefined> {
    const [updatedProductSupplier] = await db
      .update(productSuppliers)
      .set({...productSupplier, updatedAt: new Date()})
      .where(eq(productSuppliers.id, id))
      .returning();
    return updatedProductSupplier;
  }

  // Import management
  async getImports(): Promise<Import[]> {
    return await db.select().from(imports).orderBy(desc(imports.createdAt));
  }

  async getImport(id: number): Promise<Import | undefined> {
    const [importData] = await db.select().from(imports).where(eq(imports.id, id));
    return importData;
  }

  async createImport(importData: InsertImport): Promise<Import> {
    const [createdImport] = await db.insert(imports).values(importData).returning();
    return createdImport;
  }

  async updateImport(id: number, importData: Partial<InsertImport>): Promise<Import | undefined> {
    const [updatedImport] = await db
      .update(imports)
      .set({...importData, updatedAt: new Date()})
      .where(eq(imports.id, id))
      .returning();
    return updatedImport;
  }

  // Export management
  async getExports(): Promise<Export[]> {
    return await db.select().from(exportsTable).orderBy(desc(exportsTable.createdAt));
  }

  async getExport(id: number): Promise<Export | undefined> {
    const [exportData] = await db.select().from(exportsTable).where(eq(exportsTable.id, id));
    return exportData;
  }

  async createExport(exportData: InsertExport): Promise<Export> {
    const [createdExport] = await db.insert(exportsTable).values(exportData).returning();
    return createdExport;
  }

  async updateExport(id: number, exportData: Partial<InsertExport>): Promise<Export | undefined> {
    const [updatedExport] = await db
      .update(exportsTable)
      .set({...exportData, updatedAt: new Date()})
      .where(eq(exportsTable.id, id))
      .returning();
    return updatedExport;
  }

  // Approval management
  async getApprovals(): Promise<Approval[]> {
    return await db.select().from(approvals).orderBy(desc(approvals.createdAt));
  }

  async getApproval(id: number): Promise<Approval | undefined> {
    const [approval] = await db.select().from(approvals).where(eq(approvals.id, id));
    return approval;
  }

  async createApproval(approval: InsertApproval): Promise<Approval> {
    const [createdApproval] = await db.insert(approvals).values(approval).returning();
    return createdApproval;
  }

  async updateApproval(id: number, approval: Partial<InsertApproval>): Promise<Approval | undefined> {
    const [updatedApproval] = await db
      .update(approvals)
      .set({...approval, updatedAt: new Date()})
      .where(eq(approvals.id, id))
      .returning();
    return updatedApproval;
  }

  // Audit logs
  async getAuditLogs(): Promise<AuditLog[]> {
    return await db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp));
  }

  async createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog> {
    const [createdAuditLog] = await db.insert(auditLogs).values(auditLog).returning();
    return createdAuditLog;
  }

  // Data source management
  async getDataSources(): Promise<DataSource[]> {
    return await db.select().from(dataSources);
  }

  async getDataSource(id: number): Promise<DataSource | undefined> {
    const [dataSource] = await db.select().from(dataSources).where(eq(dataSources.id, id));
    return dataSource;
  }

  async getDataSourcesByType(type: string): Promise<DataSource[]> {
    return await db.select().from(dataSources).where(eq(dataSources.type, type));
  }

  async getDataSourcesBySupplier(supplierId: number): Promise<DataSource[]> {
    return await db.select().from(dataSources).where(eq(dataSources.supplierId, supplierId));
  }

  async createDataSource(dataSource: InsertDataSource): Promise<DataSource> {
    const [createdDataSource] = await db.insert(dataSources).values(dataSource).returning();
    return createdDataSource;
  }

  async updateDataSource(id: number, dataSource: Partial<InsertDataSource>): Promise<DataSource | undefined> {
    const [updatedDataSource] = await db
      .update(dataSources)
      .set({...dataSource, updatedAt: new Date()})
      .where(eq(dataSources.id, id))
      .returning();
    return updatedDataSource;
  }

  async deleteDataSource(id: number): Promise<boolean> {
    await db.delete(dataSources).where(eq(dataSources.id, id));
    return true;
  }

  // Schedule management
  async getSchedules(): Promise<Schedule[]> {
    return await db.select().from(schedules);
  }

  async getSchedulesByDataSource(dataSourceId: number): Promise<Schedule[]> {
    return await db
      .select()
      .from(schedules)
      .where(eq(schedules.dataSourceId, dataSourceId));
  }

  async getSchedule(id: number): Promise<Schedule | undefined> {
    const [schedule] = await db.select().from(schedules).where(eq(schedules.id, id));
    return schedule;
  }

  async createSchedule(schedule: InsertSchedule): Promise<Schedule> {
    const [createdSchedule] = await db.insert(schedules).values(schedule).returning();
    return createdSchedule;
  }

  async updateSchedule(id: number, schedule: Partial<InsertSchedule>): Promise<Schedule | undefined> {
    const [updatedSchedule] = await db
      .update(schedules)
      .set({...schedule, updatedAt: new Date()})
      .where(eq(schedules.id, id))
      .returning();
    return updatedSchedule;
  }

  async deleteSchedule(id: number): Promise<boolean> {
    await db.delete(schedules).where(eq(schedules.id, id));
    return true;
  }

  async updateScheduleLastRun(id: number, lastRun: Date): Promise<Schedule | undefined> {
    const [updatedSchedule] = await db
      .update(schedules)
      .set({lastRun, updatedAt: new Date()})
      .where(eq(schedules.id, id))
      .returning();
    return updatedSchedule;
  }

  async updateScheduleNextRun(id: number, nextRun: Date): Promise<Schedule | undefined> {
    const [updatedSchedule] = await db
      .update(schedules)
      .set({nextRun, updatedAt: new Date()})
      .where(eq(schedules.id, id))
      .returning();
    return updatedSchedule;
  }

  // Mapping template management
  async getMappingTemplates(): Promise<MappingTemplate[]> {
    return await db.select().from(mappingTemplates);
  }

  async getMappingTemplate(id: number): Promise<MappingTemplate | undefined> {
    const [mappingTemplate] = await db
      .select()
      .from(mappingTemplates)
      .where(eq(mappingTemplates.id, id));
    return mappingTemplate;
  }

  async getMappingTemplatesBySourceType(sourceType: string): Promise<MappingTemplate[]> {
    return await db
      .select()
      .from(mappingTemplates)
      .where(eq(mappingTemplates.sourceType, sourceType));
  }

  async createMappingTemplate(mappingTemplate: InsertMappingTemplate): Promise<MappingTemplate> {
    const [createdMappingTemplate] = await db
      .insert(mappingTemplates)
      .values(mappingTemplate)
      .returning();
    return createdMappingTemplate;
  }

  async updateMappingTemplate(
    id: number,
    mappingTemplate: Partial<InsertMappingTemplate>
  ): Promise<MappingTemplate | undefined> {
    const [updatedMappingTemplate] = await db
      .update(mappingTemplates)
      .set({...mappingTemplate, updatedAt: new Date()})
      .where(eq(mappingTemplates.id, id))
      .returning();
    return updatedMappingTemplate;
  }

  async deleteMappingTemplate(id: number): Promise<boolean> {
    await db.delete(mappingTemplates).where(eq(mappingTemplates.id, id));
    return true;
  }

  // Data lineage
  async getDataLineageByProduct(productId: number): Promise<DataLineage[]> {
    return await db
      .select()
      .from(dataLineage)
      .where(eq(dataLineage.productId, productId))
      .orderBy(desc(dataLineage.timestamp));
  }

  async getDataLineageByField(productId: number, fieldName: string): Promise<DataLineage[]> {
    return await db
      .select()
      .from(dataLineage)
      .where(
        and(
          eq(dataLineage.productId, productId),
          eq(dataLineage.field, fieldName)
        )
      )
      .orderBy(desc(dataLineage.timestamp));
  }

  async createDataLineage(lineageData: InsertDataLineage): Promise<DataLineage> {
    const [createdLineage] = await db
      .insert(dataLineage)
      .values({...lineageData, timestamp: new Date()})
      .returning();
    return createdLineage;
  }

  // Data merging configuration
  async getDataMergingConfigs(): Promise<DataMergingConfig[]> {
    return await db.select().from(dataMergingConfig);
  }

  async getDataMergingConfig(id: number): Promise<DataMergingConfig | undefined> {
    const [config] = await db
      .select()
      .from(dataMergingConfig)
      .where(eq(dataMergingConfig.id, id));
    return config;
  }

  async getActiveDataMergingConfig(): Promise<DataMergingConfig | undefined> {
    const [config] = await db
      .select()
      .from(dataMergingConfig)
      .where(eq(dataMergingConfig.isActive, true));
    return config;
  }

  async createDataMergingConfig(config: InsertDataMergingConfig): Promise<DataMergingConfig> {
    // If this is being set as active, deactivate all other configs
    if (config.isActive) {
      await db
        .update(dataMergingConfig)
        .set({isActive: false})
        .where(eq(dataMergingConfig.isActive, true));
    }

    const [createdConfig] = await db
      .insert(dataMergingConfig)
      .values({...config, createdAt: new Date(), updatedAt: new Date()})
      .returning();
    return createdConfig;
  }

  async updateDataMergingConfig(
    id: number,
    config: Partial<InsertDataMergingConfig>
  ): Promise<DataMergingConfig | undefined> {
    // If this is being set as active, deactivate all other configs
    if (config.isActive) {
      await db
        .update(dataMergingConfig)
        .set({isActive: false})
        .where(and(
          eq(dataMergingConfig.isActive, true),
          sql`${dataMergingConfig.id} != ${id}`
        ));
    }

    const [updatedConfig] = await db
      .update(dataMergingConfig)
      .set({...config, updatedAt: new Date()})
      .where(eq(dataMergingConfig.id, id))
      .returning();
    return updatedConfig;
  }

  // Workflow management
  async getWorkflows(): Promise<Workflow[]> {
    return await db.select().from(workflows);
  }

  async getWorkflow(id: number): Promise<Workflow | undefined> {
    const [workflow] = await db
      .select()
      .from(workflows)
      .where(eq(workflows.id, id));
    return workflow;
  }

  async getActiveWorkflows(): Promise<Workflow[]> {
    return await db
      .select()
      .from(workflows)
      .where(eq(workflows.isActive, true));
  }

  async createWorkflow(workflow: InsertWorkflow): Promise<Workflow> {
    const [createdWorkflow] = await db
      .insert(workflows)
      .values({...workflow, createdAt: new Date(), updatedAt: new Date()})
      .returning();
    return createdWorkflow;
  }

  async updateWorkflow(id: number, workflow: Partial<InsertWorkflow>): Promise<Workflow | undefined> {
    const [updatedWorkflow] = await db
      .update(workflows)
      .set({...workflow, updatedAt: new Date()})
      .where(eq(workflows.id, id))
      .returning();
    return updatedWorkflow;
  }

  // Workflow execution
  async getWorkflowExecutions(workflowId: number): Promise<WorkflowExecution[]> {
    return await db
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.workflowId, workflowId))
      .orderBy(desc(workflowExecutions.startedAt));
  }

  async getWorkflowExecution(id: number): Promise<WorkflowExecution | undefined> {
    const [execution] = await db
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.id, id));
    return execution;
  }

  async createWorkflowExecution(execution: InsertWorkflowExecution): Promise<WorkflowExecution> {
    const [createdExecution] = await db
      .insert(workflowExecutions)
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
    const [updatedExecution] = await db
      .update(workflowExecutions)
      .set({
        status,
        results: results || sql`${workflowExecutions.results}`,
        error: error || sql`${workflowExecutions.error}`,
        ...(status === "completed" || status === "failed" ? { completedAt: new Date() } : {})
      })
      .where(eq(workflowExecutions.id, id))
      .returning();
    return updatedExecution;
  }

  async completeWorkflowExecution(id: number, results: any): Promise<WorkflowExecution | undefined> {
    return this.updateWorkflowExecution(id, "completed", results);
  }

  async failWorkflowExecution(id: number, error: string): Promise<WorkflowExecution | undefined> {
    return this.updateWorkflowExecution(id, "failed", undefined, error);
  }

  // Warehouse management - These are placeholder implementations that would need to be replaced with real DB tables
  async getWarehouses(): Promise<any[]> {
    // This is a placeholder. In a real implementation, we'd have a warehouses table
    const mockWarehouses = [
      { id: "WH1", name: "Main Warehouse", code: "MAIN", address: { street: "123 Logistics Way", city: "Commerce", state: "CA", postal_code: "90001", country: "USA" }, active: true },
      { id: "WH2", name: "East Coast DC", code: "EASTDC", address: { street: "456 Distribution Ave", city: "Edison", state: "NJ", postal_code: "08817", country: "USA" }, active: true },
      { id: "WH3", name: "Midwest Fulfillment", code: "MIDWEST", address: { street: "789 Supply Chain Blvd", city: "Chicago", state: "IL", postal_code: "60642", country: "USA" }, active: true }
    ];
    return mockWarehouses;
  }
  
  // Product Fulfillment management - These are placeholder implementations that would need to be replaced with real DB tables
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
}