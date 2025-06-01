import { pgTable, text, serial, integer, boolean, timestamp, json, uniqueIndex, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Custom types for the application
export interface ValidationRule {
  field: string;
  type: "required" | "type" | "format" | "range" | "enum" | "custom";
  value?: any;
  message?: string;
  errorLevel: "error" | "warning";
  defaultValue?: any;
}

// Enums
export const importStatusEnum = pgEnum('import_status', ['pending', 'processing', 'success', 'error']);
export const approvalStatusEnum = pgEnum('approval_status', ['pending', 'approved', 'rejected']);
export const exportStatusEnum = pgEnum('export_status', ['pending', 'processing', 'success', 'error']);
export const dataSourceTypeEnum = pgEnum('data_source_type', [
  'csv', 'excel', 'json', 'xml', 'edi_x12', 'edifact', 'api', 'sftp', 'ftp', 'manual'
]);
export const marketplaceEnum = pgEnum('marketplace', [
  'amazon', 'walmart', 'ebay', 'target', 'home_depot'
]);
export const scheduleFrequencyEnum = pgEnum('schedule_frequency', [
  'once', 'hourly', 'daily', 'weekly', 'monthly', 'custom'
]);
export const resolutionStrategyEnum = pgEnum('resolution_strategy', [
  'newest_wins', 'highest_confidence_wins', 'specific_source_wins', 'manual_resolution', 'keep_all'
]);
export const connectionTypeEnum = pgEnum('connection_type', [
  'ftp', 'sftp', 'api', 'database'
]);
export const connectionStatusEnum = pgEnum('connection_status', [
  'success', 'error', 'pending'
]);

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name"),
  email: text("email"),
  role: text("role").default("user"),
});

// Suppliers table
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  active: boolean("active").default(true),
});

// Categories table
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  parentId: integer("parent_id").references(() => categories.id),
  level: integer("level").default(0),
  path: text("path"),
  attributes: json("attributes").default({}),
});

// Products table
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull(),                       // Internal SKU/Part Number
  usin: text("usin"),                               // Universal Supplier Item Number (USIN)
  manufacturerPartNumber: text("manufacturer_part_number"),  // Manufacturer's Part Number
  upc: text("upc"),                                 // UPC Code
  name: text("name").notNull(),                     // Product Title
  description: text("description"),                 // Product Description
  categoryId: integer("category_id").references(() => categories.id),
  manufacturerId: integer("manufacturer_id"),       // Manufacturer ID (could reference a manufacturers table)
  manufacturerName: text("manufacturer_name"),      // Manufacturer Name
  price: text("price"),                             // Price 
  cost: text("cost"),                               // Cost
  weight: text("weight"),                           // Weight
  dimensions: text("dimensions"),                   // Dimensions
  attributes: json("attributes").default({}),       // Flexible attributes
  status: text("status").default("draft"),          // Product status
  isRemanufactured: boolean("is_remanufactured").default(false),
  isCloseout: boolean("is_closeout").default(false),
  isOnSale: boolean("is_on_sale").default(false),
  hasRebate: boolean("has_rebate").default(false),
  hasFreeShipping: boolean("has_free_shipping").default(false),
  inventoryQuantity: integer("inventory_quantity").default(0),
  reorderThreshold: integer("reorder_threshold").default(0),
  // Image fields for CWR product images
  imageUrl: text("image_url"),                      // Primary product image URL
  imageUrlLarge: text("image_url_large"),           // Large/high-res product image URL
  // Missing fields from catalog.csv
  thirdPartyMarketplaces: text("third_party_marketplaces"), // 3rd Party Marketplaces
  caseQuantity: text("case_quantity"),              // Case Qty
  googleMerchantCategory: text("google_merchant_category"), // Google Merchant Category
  countryOfOrigin: text("country_of_origin"),       // Country of Origin
  boxHeight: text("box_height"),                    // Box Height
  boxLength: text("box_length"),                    // Box Length
  boxWidth: text("box_width"),                      // Box Width
  // Documentation and Resources
  installationGuideUrl: text("installation_guide_url"),    // Installation Guide PDF URL
  ownersManualUrl: text("owners_manual_url"),              // Owners Manual PDF URL
  brochureUrl: text("brochure_url"),                       // Brochure Literature PDF URL
  quickGuideUrl: text("quick_guide_url"),                  // Quick Guide Literature PDF URL
  additionalImages: text("additional_images"),             // Additional Image URLs (JSON array)
  // Shipping and Logistics
  isOversized: boolean("is_oversized").default(false),     // Oversized shipping flag
  isReturnable: boolean("is_returnable").default(true),    // Returnable flag
  quickSpecs: text("quick_specs"),                         // Quick Specifications
  // Inventory dates
  nextShipmentDateNJ: text("next_shipment_date_nj"),       // Next Shipment Date NJ
  nextShipmentDateFL: text("next_shipment_date_fl"),       // Next Shipment Date FL
  nextShipmentDateCombined: text("next_shipment_date_combined"), // Next Shipment Date Combined
  primaryImage: text("primary_image"),                     // Primary Image (1000x1000)
  // Amazon sync tracking fields
  lastAmazonSync: timestamp("last_amazon_sync"),
  amazonSyncStatus: text("amazon_sync_status").default("pending"), // pending, processing, success, error, ratelimited
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    skuIdx: uniqueIndex("products_sku_idx").on(table.sku),
  };
});

// Product Suppliers mapping
export const productSuppliers = pgTable("product_suppliers", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id).notNull(),
  supplierSku: text("supplier_sku").notNull(),
  supplierAttributes: json("supplier_attributes").default({}),
  confidence: integer("confidence").default(100),
  isPrimary: boolean("is_primary").default(false),
});

// Data Imports table
export const imports = pgTable("imports", {
  id: serial("id").primaryKey(),
  filename: text("filename"),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  status: importStatusEnum("status").default('pending'),
  type: text("type").notNull(), // csv, excel, api, etc.
  recordCount: integer("record_count").default(0),
  processedCount: integer("processed_count").default(0),
  errorCount: integer("error_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  sourceData: json("source_data").default({}), // For API config/metadata
  mappingTemplate: text("mapping_template"),
  importErrors: json("import_errors").default([]),
});

// Data Exports table
export const exportsTable = pgTable("exports", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // file, api, etc.
  status: exportStatusEnum("status").default('pending'),
  format: text("format"), // csv, excel, json, etc.
  filter: json("filter").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  recordCount: integer("record_count").default(0),
  destination: text("destination"), // For API endpoint or file path
});

// Approval Workflows table
export const approvals = pgTable("approvals", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // product, category, attribute, etc.
  title: text("title").notNull(),
  description: text("description"),
  status: approvalStatusEnum("status").default('pending'),
  requestedBy: integer("requested_by").references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  entityId: integer("entity_id"), // ID of the entity being approved
  entityType: text("entity_type"), // Type of entity (product, category, etc.)
  changes: json("changes").default({}), // JSON diff of changes
});

// Audit Logs table
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  userId: integer("user_id").references(() => users.id),
  details: json("details").default({}),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Data Sources table for configuring various import sources
export const dataSources = pgTable("data_sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: dataSourceTypeEnum("type").notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  config: json("config").notNull(), // Stores connection details based on source type
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Scheduled imports for data sources
export const schedules = pgTable("schedules", {
  id: serial("id").primaryKey(),
  dataSourceId: integer("data_source_id").references(() => dataSources.id).notNull(),
  remotePath: text("remote_path"), // Path this schedule is associated with (for FTP/SFTP)
  pathLabel: text("path_label"), // Human-readable label for the path
  frequency: scheduleFrequencyEnum("frequency").notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  dayOfWeek: integer("day_of_week"), // 0-6 for Sunday to Saturday
  dayOfMonth: integer("day_of_month"), // 1-31
  hour: integer("hour"), // 0-23
  minute: integer("minute"), // 0-59
  customCron: text("custom_cron"), // For custom CRON expressions
  lastRun: timestamp("last_run"),
  nextRun: timestamp("next_run"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Mapping templates for data normalization
export const mappingViews = pgEnum('mapping_view', [
  'catalog', 'detail'
]);

export const mappingTemplates = pgTable("mapping_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  sourceType: dataSourceTypeEnum("source_type").notNull(),
  mappings: json("mappings").notNull(), // Object with mappings for each view { catalog: {}, detail: {} }
  transformations: json("transformations").default([]), // Array of transformations
  validationRules: json("validation_rules").default([]), // Array of validation rules
  supplierId: integer("supplier_id").references(() => suppliers.id),
  fileLabel: text("file_label"), // Label for specific file paths this template applies to
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Data Lineage for tracking product data origins
export const dataLineage = pgTable("data_lineage", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  fieldName: text("field_name").notNull(),
  sourceId: integer("source_id").notNull(), // ID of import, manual entry, etc.
  sourceType: text("source_type").notNull(), // 'import', 'manual', 'api', etc.
  userId: integer("user_id").references(() => users.id),
  previousValue: json("previous_value"),
  confidence: integer("confidence"), // 0-100 confidence score
  timestamp: timestamp("timestamp").defaultNow(),
});

// Data merging configuration
export const dataMergingConfig = pgTable("data_merging_config", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  strategy: resolutionStrategyEnum("strategy").notNull(),
  preferredSourceId: integer("preferred_source_id"),
  confidenceThreshold: integer("confidence_threshold"),
  fieldStrategies: json("field_strategies").default({}), // Field-specific strategies
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Workflow definitions for automation
export const workflows = pgTable("workflows", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  steps: json("steps").notNull(), // Array of workflow steps
  triggers: json("triggers").notNull(), // What triggers this workflow
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Workflow execution history
export const workflowExecutions = pgTable("workflow_executions", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").references(() => workflows.id).notNull(),
  status: text("status").notNull(), // 'running', 'completed', 'failed'
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  results: json("results"), // Results of each step
  error: text("error"),
});

// Amazon sync logs table
// Connections table for external data sources
export const connections = pgTable("connections", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: connectionTypeEnum("type").notNull(),
  description: text("description"),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  isActive: boolean("is_active").default(true),
  credentials: json("credentials").notNull(),
  lastTested: timestamp("last_tested"),
  lastStatus: connectionStatusEnum("last_status"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const amazonSyncLogs = pgTable("amazon_sync_logs", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id),
  batchId: text("batch_id"), // To group logs for a specific batch run
  syncStartedAt: timestamp("sync_started_at").defaultNow(),
  syncCompletedAt: timestamp("sync_completed_at"),
  result: text("result"), // "success", "not_found", "timeout", "invalid_upc", "rate_limited", "error"
  responseTimeMs: integer("response_time_ms"), // API response time in milliseconds
  errorMessage: text("error_message"),
  errorDetails: json("error_details").default({}),
  upc: text("upc"), // The UPC that was used
  asin: text("asin"), // The ASIN that was found if successful
  createdAt: timestamp("created_at").defaultNow(),
});

// UPC to ASIN mapping table - captures the many-to-many relationship
export const upcAsinMappings = pgTable("upc_asin_mappings", {
  id: serial("id").primaryKey(),
  upc: text("upc").notNull(),
  asin: text("asin").notNull(),
  discoveredAt: timestamp("discovered_at").defaultNow(),
  lastVerifiedAt: timestamp("last_verified_at").defaultNow(),
  isActive: boolean("is_active").default(true), // Whether this mapping is still valid
  confidence: integer("confidence").default(100), // 0-100 confidence in the mapping
  source: text("source").default("sp_api"), // How we discovered this mapping
  marketplaceId: text("marketplace_id").default("ATVPDKIKX0DER"), // Amazon marketplace ID
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    upcAsinIdx: uniqueIndex("upc_asin_mappings_upc_asin_idx").on(table.upc, table.asin, table.marketplaceId),
    upcIdx: uniqueIndex("upc_asin_mappings_upc_idx").on(table.upc),
    asinIdx: uniqueIndex("upc_asin_mappings_asin_idx").on(table.asin),
  };
});

// Amazon marketplace competitive intelligence data
export const amazonMarketData = pgTable("amazon_market_data", {
  id: serial("id").primaryKey(),
  asin: text("asin").notNull(),
  upc: text("upc"), // Reference UPC for tracking
  title: text("title"),
  brand: text("brand"),
  manufacturer: text("manufacturer"),
  category: text("category"),
  subcategory: text("subcategory"),
  
  // Pricing intelligence
  currentPrice: integer("current_price"), // Stored in cents
  listPrice: integer("list_price"), // MSRP in cents
  lowestPrice: integer("lowest_price"), // Lowest price we've seen
  highestPrice: integer("highest_price"), // Highest price we've seen
  priceHistory: json("price_history").default([]), // Historical price data
  
  // Sales rank and performance
  salesRank: integer("sales_rank"),
  categoryRank: integer("category_rank"),
  bsr30Day: integer("bsr_30_day"), // Best Sellers Rank 30-day average
  rankHistory: json("rank_history").default([]), // Historical rank data
  
  // Product details
  imageUrl: text("image_url"),
  dimensions: json("dimensions").default({}), // L x W x H
  weight: text("weight"),
  features: json("features").default([]), // Bullet points
  description: text("description"),
  
  // Availability and fulfillment
  availability: text("availability"), // In Stock, Out of Stock, etc.
  fulfillmentBy: text("fulfillment_by"), // Amazon, Merchant, etc.
  isAmazonChoice: boolean("is_amazon_choice").default(false),
  isPrime: boolean("is_prime").default(false),
  
  // Variation data
  parentAsin: text("parent_asin"), // For variation relationships
  variationType: text("variation_type"), // color, size, etc.
  variationValue: text("variation_value"), // red, large, etc.
  totalVariations: integer("total_variations"),
  
  // Review and rating data
  rating: integer("rating"), // Stored as 1-50 (multiply by 0.1 for display)
  reviewCount: integer("review_count"),
  qaCount: integer("qa_count"), // Number of Q&A items
  
  // Seller information
  sellerName: text("seller_name"),
  sellerType: text("seller_type"), // Amazon, Third Party, etc.
  soldBy: text("sold_by"),
  shippedBy: text("shipped_by"),
  
  // Intelligence flags
  isRestrictedBrand: boolean("is_restricted_brand").default(false),
  hasGating: boolean("has_gating").default(false),
  isHazmat: boolean("is_hazmat").default(false),
  requiresApproval: boolean("requires_approval").default(false),
  
  // Sync metadata
  dataFetchedAt: timestamp("data_fetched_at").defaultNow(),
  lastPriceCheck: timestamp("last_price_check"),
  lastRankCheck: timestamp("last_rank_check"),
  syncFrequency: text("sync_frequency").default("daily"), // daily, weekly, monthly
  marketplaceId: text("marketplace_id").default("ATVPDKIKX0DER"),
  
  // Raw data storage
  rawApiResponse: json("raw_api_response").default({}), // Full API response for debugging
  additionalData: json("additional_data").default({}), // Any extra data we collect
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    asinIdx: uniqueIndex("amazon_market_data_asin_idx").on(table.asin, table.marketplaceId),
    upcIdx: uniqueIndex("amazon_market_data_upc_idx").on(table.upc),
    salesRankIdx: uniqueIndex("amazon_market_data_sales_rank_idx").on(table.salesRank),
    brandIdx: uniqueIndex("amazon_market_data_brand_idx").on(table.brand),
  };
});

// Amazon competitive intelligence analysis
export const amazonCompetitiveAnalysis = pgTable("amazon_competitive_analysis", {
  id: serial("id").primaryKey(),
  upc: text("upc").notNull(),
  analysisDate: timestamp("analysis_date").defaultNow(),
  
  // Market overview
  totalAsinsFound: integer("total_asins_found").default(0),
  priceRangeMin: integer("price_range_min"), // Lowest price across all ASINs
  priceRangeMax: integer("price_range_max"), // Highest price across all ASINs
  averagePrice: integer("average_price"),
  medianPrice: integer("median_price"),
  
  // Brand competition
  uniqueBrands: integer("unique_brands").default(0),
  dominantBrand: text("dominant_brand"), // Brand with most ASINs
  brandDistribution: json("brand_distribution").default({}), // { "brand": count }
  
  // Sales performance insights
  bestPerformingAsin: text("best_performing_asin"), // Highest ranked ASIN
  worstPerformingAsin: text("worst_performing_asin"), // Lowest ranked ASIN
  averageSalesRank: integer("average_sales_rank"),
  rankSpread: integer("rank_spread"), // Difference between best and worst rank
  
  // Market saturation indicators
  fbaVsFbmRatio: json("fba_vs_fbm_ratio").default({}), // Fulfillment method distribution
  primeEligibleCount: integer("prime_eligible_count").default(0),
  amazonChoiceCount: integer("amazon_choice_count").default(0),
  
  // Entry barriers and opportunities
  averageReviewCount: integer("average_review_count"),
  reviewCountRange: json("review_count_range").default({}), // min, max
  gatedBrandCount: integer("gated_brand_count").default(0),
  restrictedAsinCount: integer("restricted_asin_count").default(0),
  
  // Market trends
  priceVolatility: integer("price_volatility"), // Standard deviation of prices
  marketConcentration: integer("market_concentration"), // 0-100, how concentrated the market is
  competitionLevel: text("competition_level"), // "low", "medium", "high", "saturated"
  
  // Strategic recommendations
  recommendedStrategy: text("recommended_strategy"), // "enter", "avoid", "monitor", "undercut"
  opportunityScore: integer("opportunity_score"), // 0-100 overall opportunity rating
  riskFactors: json("risk_factors").default([]), // Array of identified risks
  keyInsights: json("key_insights").default([]), // Array of strategic insights
  
  // Metadata
  dataQuality: integer("data_quality").default(100), // 0-100 completeness of analysis
  nextAnalysisDate: timestamp("next_analysis_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    upcAnalysisIdx: uniqueIndex("amazon_competitive_analysis_upc_idx").on(table.upc, table.analysisDate),
    opportunityIdx: uniqueIndex("amazon_competitive_analysis_opportunity_idx").on(table.opportunityScore),
  };
});

// Schemas for insertions
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductSupplierSchema = createInsertSchema(productSuppliers).omit({ id: true });
export const insertImportSchema = createInsertSchema(imports).omit({ id: true, createdAt: true, completedAt: true });
export const insertExportSchema = createInsertSchema(exportsTable).omit({ id: true, createdAt: true, completedAt: true });
export const insertApprovalSchema = createInsertSchema(approvals).omit({ id: true, createdAt: true, updatedAt: true, completedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, timestamp: true });

// Data integration schemas
export const insertDataSourceSchema = createInsertSchema(dataSources).omit({ id: true, createdAt: true, updatedAt: true });
export const insertScheduleSchema = createInsertSchema(schedules).omit({ id: true, createdAt: true, updatedAt: true, lastRun: true, nextRun: true });
export const insertMappingTemplateSchema = createInsertSchema(mappingTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDataLineageSchema = createInsertSchema(dataLineage).omit({ id: true, timestamp: true });
export const insertDataMergingConfigSchema = createInsertSchema(dataMergingConfig).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWorkflowSchema = createInsertSchema(workflows).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWorkflowExecutionSchema = createInsertSchema(workflowExecutions).omit({ id: true, startedAt: true });
export const insertConnectionSchema = createInsertSchema(connections).omit({ id: true, createdAt: true, updatedAt: true, lastTested: true });
export const insertUpcAsinMappingSchema = createInsertSchema(upcAsinMappings).omit({ id: true, createdAt: true, updatedAt: true, discoveredAt: true });
export const insertAmazonMarketDataSchema = createInsertSchema(amazonMarketData).omit({ id: true, createdAt: true, updatedAt: true, dataFetchedAt: true });
export const insertAmazonSyncLogSchema = createInsertSchema(amazonSyncLogs).omit({ id: true, syncStartedAt: true, createdAt: true });
export const insertAmazonCompetitiveAnalysisSchema = createInsertSchema(amazonCompetitiveAnalysis).omit({ id: true, createdAt: true, updatedAt: true, analysisDate: true });

// Types for inserts
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertProductSupplier = z.infer<typeof insertProductSupplierSchema>;
export type InsertImport = z.infer<typeof insertImportSchema>;
export type InsertExport = z.infer<typeof insertExportSchema>;
export type InsertApproval = z.infer<typeof insertApprovalSchema>;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// Data integration types
export type InsertDataSource = z.infer<typeof insertDataSourceSchema>;
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
export type InsertMappingTemplate = z.infer<typeof insertMappingTemplateSchema>;
export type InsertDataLineage = z.infer<typeof insertDataLineageSchema>;
export type InsertDataMergingConfig = z.infer<typeof insertDataMergingConfigSchema>;
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type InsertWorkflowExecution = z.infer<typeof insertWorkflowExecutionSchema>;
export type InsertConnection = z.infer<typeof insertConnectionSchema>;
export type InsertUpcAsinMapping = z.infer<typeof insertUpcAsinMappingSchema>;
export type InsertAmazonMarketData = z.infer<typeof insertAmazonMarketDataSchema>;
export type InsertAmazonSyncLog = z.infer<typeof insertAmazonSyncLogSchema>;
export type InsertAmazonCompetitiveAnalysis = z.infer<typeof insertAmazonCompetitiveAnalysisSchema>;

// Types for selects
export type User = typeof users.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductSupplier = typeof productSuppliers.$inferSelect;
export type Import = typeof imports.$inferSelect;
export type Export = typeof exportsTable.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

// Data integration select types
export type DataSource = typeof dataSources.$inferSelect;
export type Schedule = typeof schedules.$inferSelect;
export type MappingTemplate = typeof mappingTemplates.$inferSelect;
export type DataLineage = typeof dataLineage.$inferSelect;
export type DataMergingConfig = typeof dataMergingConfig.$inferSelect;
export type Workflow = typeof workflows.$inferSelect;
export type WorkflowExecution = typeof workflowExecutions.$inferSelect;
export type Connection = typeof connections.$inferSelect;
export type UpcAsinMapping = typeof upcAsinMappings.$inferSelect;
export type AmazonMarketData = typeof amazonMarketData.$inferSelect;
export type AmazonSyncLog = typeof amazonSyncLogs.$inferSelect;
export type AmazonCompetitiveAnalysis = typeof amazonCompetitiveAnalysis.$inferSelect;
