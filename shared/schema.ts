import { pgTable, text, serial, integer, boolean, timestamp, json, uniqueIndex, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const importStatusEnum = pgEnum('import_status', ['pending', 'processing', 'success', 'error']);
export const approvalStatusEnum = pgEnum('approval_status', ['pending', 'approved', 'rejected']);
export const exportStatusEnum = pgEnum('export_status', ['pending', 'processing', 'success', 'error']);

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
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  categoryId: integer("category_id").references(() => categories.id),
  attributes: json("attributes").default({}),
  status: text("status").default("draft"),
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
export const exports = pgTable("exports", {
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

// Schemas for insertions
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductSupplierSchema = createInsertSchema(productSuppliers).omit({ id: true });
export const insertImportSchema = createInsertSchema(imports).omit({ id: true, createdAt: true, completedAt: true });
export const insertExportSchema = createInsertSchema(exports).omit({ id: true, createdAt: true, completedAt: true });
export const insertApprovalSchema = createInsertSchema(approvals).omit({ id: true, createdAt: true, updatedAt: true, completedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, timestamp: true });

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

// Types for selects
export type User = typeof users.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductSupplier = typeof productSuppliers.$inferSelect;
export type Import = typeof imports.$inferSelect;
export type Export = typeof exports.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
