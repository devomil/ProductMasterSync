import { db } from './db';
import { eq, and, or, like, isNull, desc, asc, sql, count, inArray } from 'drizzle-orm';
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
  DataSource, InsertDataSource,
  Schedule, InsertSchedule,
  MappingTemplate, InsertMappingTemplate,
  DataLineage, InsertDataLineage,
  DataMergingConfig, InsertDataMergingConfig,
  Workflow, InsertWorkflow,
  WorkflowExecution, InsertWorkflowExecution
} from "@shared/schema";

import { IStorage } from './storage';

// Cache interface for optimized data retrieval
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class OptimizedDatabaseStorage implements IStorage {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 30000; // 30 seconds
  private readonly LONG_TTL = 300000; // 5 minutes for relatively static data

  // Cache management
  private isCacheValid<T>(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    return Date.now() - entry.timestamp < entry.ttl;
  }

  private getFromCache<T>(key: string): T | null {
    if (this.isCacheValid(key)) {
      return this.cache.get(key)!.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private invalidateCache(pattern: string): void {
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  // User management
  async getUser(id: number): Promise<User | undefined> {
    const cacheKey = `user:${id}`;
    const cached = this.getFromCache<User>(cacheKey);
    if (cached) return cached;

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    if (user) this.setCache(cacheKey, user, this.LONG_TTL);
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const cacheKey = `user:username:${username}`;
    const cached = this.getFromCache<User>(cacheKey);
    if (cached) return cached;

    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username));
    if (user) this.setCache(cacheKey, user, this.LONG_TTL);
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [createdUser] = await db.insert(schema.users).values(user).returning();
    this.invalidateCache('user:');
    return createdUser;
  }

  // Optimized supplier management
  async getSuppliers(): Promise<Supplier[]> {
    const cacheKey = 'suppliers:all';
    const cached = this.getFromCache<Supplier[]>(cacheKey);
    if (cached) return cached;

    const suppliers = await db.select().from(schema.suppliers).orderBy(schema.suppliers.name);
    this.setCache(cacheKey, suppliers, this.DEFAULT_TTL);
    return suppliers;
  }

  async getSupplier(id: number): Promise<Supplier | undefined> {
    const cacheKey = `supplier:${id}`;
    const cached = this.getFromCache<Supplier>(cacheKey);
    if (cached) return cached;

    const [supplier] = await db.select().from(schema.suppliers).where(eq(schema.suppliers.id, id));
    if (supplier) this.setCache(cacheKey, supplier, this.DEFAULT_TTL);
    return supplier;
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const [createdSupplier] = await db.insert(schema.suppliers).values(supplier).returning();
    this.invalidateCache('suppliers:');
    return createdSupplier;
  }

  async updateSupplier(id: number, supplier: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const [updatedSupplier] = await db.update(schema.suppliers)
      .set(supplier)
      .where(eq(schema.suppliers.id, id))
      .returning();
    
    this.invalidateCache('suppliers:');
    this.invalidateCache(`supplier:${id}`);
    return updatedSupplier;
  }

  async deleteSupplier(id: number): Promise<boolean> {
    const result = await db.delete(schema.suppliers).where(eq(schema.suppliers.id, id));
    this.invalidateCache('suppliers:');
    this.invalidateCache(`supplier:${id}`);
    return result.rowCount > 0;
  }

  // Highly optimized category management with count aggregation
  async getCategories(): Promise<Category[]> {
    const cacheKey = 'categories:all:with-counts';
    const cached = this.getFromCache<Category[]>(cacheKey);
    if (cached) return cached;

    // Single optimized query with left join for product counts
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
        productCount: sql<number>`CAST(COUNT(${schema.products.id}) AS INTEGER)`,
      })
      .from(schema.categories)
      .leftJoin(schema.products, eq(schema.categories.id, schema.products.categoryId))
      .groupBy(
        schema.categories.id,
        schema.categories.name,
        schema.categories.code,
        schema.categories.parentId,
        schema.categories.level,
        schema.categories.path,
        schema.categories.createdAt,
        schema.categories.updatedAt,
        schema.categories.attributes
      )
      .orderBy(asc(schema.categories.level), asc(schema.categories.name));
    
    const result = categoriesWithCounts.map(cat => ({
      ...cat,
      productCount: cat.productCount || 0
    }));

    this.setCache(cacheKey, result, this.DEFAULT_TTL);
    return result;
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const cacheKey = `category:${id}`;
    const cached = this.getFromCache<Category>(cacheKey);
    if (cached) return cached;

    const [category] = await db.select().from(schema.categories).where(eq(schema.categories.id, id));
    if (category) this.setCache(cacheKey, category, this.LONG_TTL);
    return category;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [createdCategory] = await db.insert(schema.categories).values(category).returning();
    this.invalidateCache('categories:');
    return createdCategory;
  }

  async updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined> {
    const [updatedCategory] = await db.update(schema.categories)
      .set(category)
      .where(eq(schema.categories.id, id))
      .returning();
    
    this.invalidateCache('categories:');
    this.invalidateCache(`category:${id}`);
    return updatedCategory;
  }

  async deleteCategory(id: number): Promise<boolean> {
    const result = await db.delete(schema.categories).where(eq(schema.categories.id, id));
    this.invalidateCache('categories:');
    this.invalidateCache(`category:${id}`);
    return result.rowCount > 0;
  }

  // Super-optimized product management with selective field loading
  async getProducts(): Promise<Product[]> {
    const cacheKey = 'products:all:optimized';
    const cached = this.getFromCache<Product[]>(cacheKey);
    if (cached) return cached;

    // Optimized query with only essential fields for listing
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
      lastAmazonSync: schema.products.lastAmazonSync,
      amazonSyncStatus: schema.products.amazonSyncStatus,
      createdAt: schema.products.createdAt,
      updatedAt: schema.products.updatedAt,
    }).from(schema.products)
    .orderBy(desc(schema.products.id));

    this.setCache(cacheKey, products, this.DEFAULT_TTL);
    return products;
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const cacheKey = `product:${id}`;
    const cached = this.getFromCache<Product>(cacheKey);
    if (cached) return cached;

    const [product] = await db.select().from(schema.products).where(eq(schema.products.id, id));
    if (product) this.setCache(cacheKey, product, this.DEFAULT_TTL);
    return product;
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    const cacheKey = `product:sku:${sku}`;
    const cached = this.getFromCache<Product>(cacheKey);
    if (cached) return cached;

    const [product] = await db.select().from(schema.products).where(eq(schema.products.sku, sku));
    if (product) this.setCache(cacheKey, product, this.DEFAULT_TTL);
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [createdProduct] = await db.insert(schema.products).values(product).returning();
    this.invalidateCache('products:');
    this.invalidateCache('categories:'); // Invalidate category counts
    return createdProduct;
  }

  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updatedProduct] = await db.update(schema.products)
      .set(product)
      .where(eq(schema.products.id, id))
      .returning();
    
    this.invalidateCache('products:');
    this.invalidateCache(`product:${id}`);
    this.invalidateCache('categories:'); // Invalidate category counts
    return updatedProduct;
  }

  async deleteProduct(id: number): Promise<boolean> {
    const result = await db.delete(schema.products).where(eq(schema.products.id, id));
    this.invalidateCache('products:');
    this.invalidateCache(`product:${id}`);
    this.invalidateCache('categories:'); // Invalidate category counts
    return result.rowCount > 0;
  }

  // Optimized mapping template management
  async getMappingTemplates(): Promise<MappingTemplate[]> {
    const cacheKey = 'mapping-templates:all';
    const cached = this.getFromCache<MappingTemplate[]>(cacheKey);
    if (cached) return cached;

    const templates = await db.select().from(schema.mappingTemplates).orderBy(schema.mappingTemplates.name);
    this.setCache(cacheKey, templates, this.LONG_TTL);
    return templates;
  }

  async getMappingTemplate(id: number): Promise<MappingTemplate | undefined> {
    const cacheKey = `mapping-template:${id}`;
    const cached = this.getFromCache<MappingTemplate>(cacheKey);
    if (cached) return cached;

    const [template] = await db.select().from(schema.mappingTemplates).where(eq(schema.mappingTemplates.id, id));
    if (template) this.setCache(cacheKey, template, this.LONG_TTL);
    return template;
  }

  async createMappingTemplate(template: InsertMappingTemplate): Promise<MappingTemplate> {
    const [createdTemplate] = await db.insert(schema.mappingTemplates).values(template).returning();
    this.invalidateCache('mapping-templates:');
    return createdTemplate;
  }

  async updateMappingTemplate(id: number, template: Partial<InsertMappingTemplate>): Promise<MappingTemplate | undefined> {
    const [updatedTemplate] = await db.update(schema.mappingTemplates)
      .set(template)
      .where(eq(schema.mappingTemplates.id, id))
      .returning();
    
    this.invalidateCache('mapping-templates:');
    this.invalidateCache(`mapping-template:${id}`);
    return updatedTemplate;
  }

  async deleteMappingTemplate(id: number): Promise<boolean> {
    const result = await db.delete(schema.mappingTemplates).where(eq(schema.mappingTemplates.id, id));
    this.invalidateCache('mapping-templates:');
    this.invalidateCache(`mapping-template:${id}`);
    return result.rowCount > 0;
  }

  // Placeholder methods for remaining interface - implement as needed
  async getCategoryMappings(): Promise<any[]> { return []; }
  async getUnmappedSupplierCategories(): Promise<any[]> { return []; }
  async createCategoryMapping(mapping: any): Promise<any> { return mapping; }
  async updateCategoryMapping(id: number, mapping: any): Promise<any> { return mapping; }

  async getProductSuppliers(productId: number): Promise<ProductSupplier[]> { return []; }
  async createProductSupplier(productSupplier: InsertProductSupplier): Promise<ProductSupplier> { 
    return productSupplier as ProductSupplier; 
  }
  async updateProductSupplier(id: number, productSupplier: Partial<InsertProductSupplier>): Promise<ProductSupplier | undefined> { 
    return undefined; 
  }

  async getImports(): Promise<Import[]> { return []; }
  async getImport(id: number): Promise<Import | undefined> { return undefined; }
  async createImport(importData: InsertImport): Promise<Import> { return importData as Import; }
  async updateImport(id: number, importData: Partial<InsertImport>): Promise<Import | undefined> { return undefined; }

  async getExports(): Promise<Export[]> { return []; }
  async getExport(id: number): Promise<Export | undefined> { return undefined; }
  async createExport(exportData: InsertExport): Promise<Export> { return exportData as Export; }
  async updateExport(id: number, exportData: Partial<InsertExport>): Promise<Export | undefined> { return undefined; }

  async getApprovals(): Promise<Approval[]> { return []; }
  async getApproval(id: number): Promise<Approval | undefined> { return undefined; }
  async createApproval(approval: InsertApproval): Promise<Approval> { return approval as Approval; }
  async updateApproval(id: number, approval: Partial<InsertApproval>): Promise<Approval | undefined> { return undefined; }

  async getAuditLogs(): Promise<AuditLog[]> { return []; }
  async createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog> { return auditLog as AuditLog; }

  async getDataSources(): Promise<DataSource[]> { return []; }
  async getDataSource(id: number): Promise<DataSource | undefined> { return undefined; }
  async getDataSourcesByType(type: string): Promise<DataSource[]> { return []; }
  async getDataSourcesBySupplier(supplierId: number): Promise<DataSource[]> { return []; }
  async createDataSource(dataSource: InsertDataSource): Promise<DataSource> { return dataSource as DataSource; }
  async updateDataSource(id: number, dataSource: Partial<InsertDataSource>): Promise<DataSource | undefined> { return undefined; }
  async deleteDataSource(id: number): Promise<boolean> { return false; }

  async getSchedules(): Promise<Schedule[]> { return []; }
  async getSchedulesByDataSource(dataSourceId: number): Promise<Schedule[]> { return []; }
  async getSchedule(id: number): Promise<Schedule | undefined> { return undefined; }
  async createSchedule(schedule: InsertSchedule): Promise<Schedule> { return schedule as Schedule; }
  async updateSchedule(id: number, schedule: Partial<InsertSchedule>): Promise<Schedule | undefined> { return undefined; }
  async deleteSchedule(id: number): Promise<boolean> { return false; }
  async updateScheduleLastRun(id: number, lastRun: Date): Promise<Schedule | undefined> { return undefined; }
  async updateScheduleNextRun(id: number, nextRun: Date): Promise<Schedule | undefined> { return undefined; }

  async getDataLineages(): Promise<DataLineage[]> { return []; }
  async getDataLineage(id: number): Promise<DataLineage | undefined> { return undefined; }
  async createDataLineage(dataLineage: InsertDataLineage): Promise<DataLineage> { return dataLineage as DataLineage; }
  async updateDataLineage(id: number, dataLineage: Partial<InsertDataLineage>): Promise<DataLineage | undefined> { return undefined; }
  async deleteDataLineage(id: number): Promise<boolean> { return false; }

  async getDataMergingConfigs(): Promise<DataMergingConfig[]> { return []; }
  async getDataMergingConfig(id: number): Promise<DataMergingConfig | undefined> { return undefined; }
  async createDataMergingConfig(config: InsertDataMergingConfig): Promise<DataMergingConfig> { return config as DataMergingConfig; }
  async updateDataMergingConfig(id: number, config: Partial<InsertDataMergingConfig>): Promise<DataMergingConfig | undefined> { return undefined; }
  async deleteDataMergingConfig(id: number): Promise<boolean> { return false; }

  async getWorkflows(): Promise<Workflow[]> { return []; }
  async getWorkflow(id: number): Promise<Workflow | undefined> { return undefined; }
  async createWorkflow(workflow: InsertWorkflow): Promise<Workflow> { return workflow as Workflow; }
  async updateWorkflow(id: number, workflow: Partial<InsertWorkflow>): Promise<Workflow | undefined> { return undefined; }
  async deleteWorkflow(id: number): Promise<boolean> { return false; }

  async getWorkflowExecutions(): Promise<WorkflowExecution[]> { return []; }
  async getWorkflowExecution(id: number): Promise<WorkflowExecution | undefined> { return undefined; }
  async createWorkflowExecution(execution: InsertWorkflowExecution): Promise<WorkflowExecution> { return execution as WorkflowExecution; }
  async updateWorkflowExecution(id: number, execution: Partial<InsertWorkflowExecution>): Promise<WorkflowExecution | undefined> { return undefined; }
  async deleteWorkflowExecution(id: number): Promise<boolean> { return false; }
}