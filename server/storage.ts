import {
  users, User, InsertUser,
  suppliers, Supplier, InsertSupplier,
  categories, Category, InsertCategory,
  products, Product, InsertProduct,
  productSuppliers, ProductSupplier, InsertProductSupplier,
  imports, Import, InsertImport,
  exports as exportsTable, Export, InsertExport, 
  approvals, Approval, InsertApproval,
  auditLogs, AuditLog, InsertAuditLog,
  // Data integration entities
  dataSources, DataSource, InsertDataSource,
  schedules, Schedule, InsertSchedule,
  mappingTemplates, MappingTemplate, InsertMappingTemplate,
  dataLineage, DataLineage, InsertDataLineage,
  dataMergingConfig, DataMergingConfig, InsertDataMergingConfig,
  workflows, Workflow, InsertWorkflow,
  workflowExecutions, WorkflowExecution, InsertWorkflowExecution
} from "@shared/schema";

// Storage interface for MDM application
export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Supplier management
  getSuppliers(): Promise<Supplier[]>;
  getSupplier(id: number): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: number, supplier: Partial<InsertSupplier>): Promise<Supplier | undefined>;

  // Category management
  getCategories(): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined>;

  // Product management
  getProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;

  // Product Supplier management
  getProductSuppliers(productId: number): Promise<ProductSupplier[]>;
  createProductSupplier(productSupplier: InsertProductSupplier): Promise<ProductSupplier>;
  updateProductSupplier(id: number, productSupplier: Partial<InsertProductSupplier>): Promise<ProductSupplier | undefined>;

  // Import management
  getImports(): Promise<Import[]>;
  getImport(id: number): Promise<Import | undefined>;
  createImport(importData: InsertImport): Promise<Import>;
  updateImport(id: number, importData: Partial<InsertImport>): Promise<Import | undefined>;

  // Export management
  getExports(): Promise<Export[]>;
  getExport(id: number): Promise<Export | undefined>;
  createExport(exportData: InsertExport): Promise<Export>;
  updateExport(id: number, exportData: Partial<InsertExport>): Promise<Export | undefined>;

  // Approval management
  getApprovals(): Promise<Approval[]>;
  getApproval(id: number): Promise<Approval | undefined>;
  createApproval(approval: InsertApproval): Promise<Approval>;
  updateApproval(id: number, approval: Partial<InsertApproval>): Promise<Approval | undefined>;

  // Audit logs
  getAuditLogs(): Promise<AuditLog[]>;
  createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog>;

  // Data source management
  getDataSources(): Promise<DataSource[]>;
  getDataSource(id: number): Promise<DataSource | undefined>;
  getDataSourcesByType(type: string): Promise<DataSource[]>;
  getDataSourcesBySupplier(supplierId: number): Promise<DataSource[]>;
  createDataSource(dataSource: InsertDataSource): Promise<DataSource>;
  updateDataSource(id: number, dataSource: Partial<InsertDataSource>): Promise<DataSource | undefined>;
  deleteDataSource(id: number): Promise<boolean>;
  
  // Schedule management
  getSchedules(): Promise<Schedule[]>;
  getSchedulesByDataSource(dataSourceId: number): Promise<Schedule[]>;
  getSchedule(id: number): Promise<Schedule | undefined>;
  createSchedule(schedule: InsertSchedule): Promise<Schedule>;
  updateSchedule(id: number, schedule: Partial<InsertSchedule>): Promise<Schedule | undefined>;
  deleteSchedule(id: number): Promise<boolean>;
  updateScheduleLastRun(id: number, lastRun: Date): Promise<Schedule | undefined>;
  updateScheduleNextRun(id: number, nextRun: Date): Promise<Schedule | undefined>;
  
  // Mapping template management
  getMappingTemplates(): Promise<MappingTemplate[]>;
  getMappingTemplate(id: number): Promise<MappingTemplate | undefined>;
  getMappingTemplatesBySourceType(sourceType: string): Promise<MappingTemplate[]>;
  createMappingTemplate(mappingTemplate: InsertMappingTemplate): Promise<MappingTemplate>;
  updateMappingTemplate(id: number, mappingTemplate: Partial<InsertMappingTemplate>): Promise<MappingTemplate | undefined>;
  deleteMappingTemplate(id: number): Promise<boolean>;
  
  // Data lineage
  getDataLineageByProduct(productId: number): Promise<DataLineage[]>;
  getDataLineageByField(productId: number, fieldName: string): Promise<DataLineage[]>;
  createDataLineage(dataLineage: InsertDataLineage): Promise<DataLineage>;
  
  // Data merging configuration
  getDataMergingConfigs(): Promise<DataMergingConfig[]>;
  getDataMergingConfig(id: number): Promise<DataMergingConfig | undefined>;
  getActiveDataMergingConfig(): Promise<DataMergingConfig | undefined>;
  createDataMergingConfig(dataMergingConfig: InsertDataMergingConfig): Promise<DataMergingConfig>;
  updateDataMergingConfig(id: number, dataMergingConfig: Partial<InsertDataMergingConfig>): Promise<DataMergingConfig | undefined>;
  
  // Workflow management
  getWorkflows(): Promise<Workflow[]>;
  getWorkflow(id: number): Promise<Workflow | undefined>;
  getActiveWorkflows(): Promise<Workflow[]>;
  createWorkflow(workflow: InsertWorkflow): Promise<Workflow>;
  updateWorkflow(id: number, workflow: Partial<InsertWorkflow>): Promise<Workflow | undefined>;
  
  // Workflow execution
  getWorkflowExecutions(workflowId: number): Promise<WorkflowExecution[]>;
  getWorkflowExecution(id: number): Promise<WorkflowExecution | undefined>;
  createWorkflowExecution(workflowExecution: InsertWorkflowExecution): Promise<WorkflowExecution>;
  updateWorkflowExecution(id: number, status: string, results?: any, error?: string): Promise<WorkflowExecution | undefined>;
  completeWorkflowExecution(id: number, results: any): Promise<WorkflowExecution | undefined>;
  failWorkflowExecution(id: number, error: string): Promise<WorkflowExecution | undefined>;
  
  // Warehouse management
  getWarehouses(): Promise<any[]>;
  
  // Product Fulfillment management
  getProductFulfillment(productId: number): Promise<any | undefined>;
  updateProductFulfillment(productId: number, fulfillment: any): Promise<any>;
  getProductStock(productId: number): Promise<any>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private suppliers: Map<number, Supplier>;
  private categories: Map<number, Category>;
  private products: Map<number, Product>;
  private productSuppliers: Map<number, ProductSupplier>;
  private imports: Map<number, Import>;
  private exports: Map<number, Export>;
  private approvals: Map<number, Approval>;
  private auditLogs: Map<number, AuditLog>;
  
  // Data integration storage
  private dataSources: Map<number, DataSource>;
  private schedules: Map<number, Schedule>;
  private mappingTemplates: Map<number, MappingTemplate>;
  private dataLineage: Map<number, DataLineage>;
  private dataMergingConfigs: Map<number, DataMergingConfig>;
  private workflows: Map<number, Workflow>;
  private workflowExecutions: Map<number, WorkflowExecution>;

  private userIdCounter = 1;
  private supplierIdCounter = 1;
  private categoryIdCounter = 1;
  private productIdCounter = 1;
  private productSupplierIdCounter = 1;
  private importIdCounter = 1;
  private exportIdCounter = 1;
  private approvalIdCounter = 1;
  private auditLogIdCounter = 1;
  
  // Data integration counters
  private dataSourceIdCounter = 1;
  private scheduleIdCounter = 1;
  private mappingTemplateIdCounter = 1;
  private dataLineageIdCounter = 1;
  private dataMergingConfigIdCounter = 1;
  private workflowIdCounter = 1;
  private workflowExecutionIdCounter = 1;

  constructor() {
    this.users = new Map();
    this.suppliers = new Map();
    this.categories = new Map();
    this.products = new Map();
    this.productSuppliers = new Map();
    this.imports = new Map();
    this.exports = new Map();
    this.approvals = new Map();
    this.auditLogs = new Map();
    
    // Initialize data integration maps
    this.dataSources = new Map();
    this.schedules = new Map();
    this.mappingTemplates = new Map();
    this.dataLineage = new Map();
    this.dataMergingConfigs = new Map();
    this.workflows = new Map();
    this.workflowExecutions = new Map();

    // Initialize with sample data
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Add sample suppliers
    const suppliers = [
      { name: "ABC Trading Co.", code: "ABC", contactName: "John Smith", contactEmail: "john@abc.com", active: true },
      { name: "XYZ Supplies Inc.", code: "XYZ", contactName: "Lisa Brown", contactEmail: "lisa@xyz.com", active: true },
      { name: "Global Supplies Ltd.", code: "GSL", contactName: "David Wilson", contactEmail: "david@gsl.com", active: true },
      { name: "West Coast Distributors", code: "WCD", contactName: "Alice Johnson", contactEmail: "alice@wcd.com", active: true },
      { name: "Eastern Merchandise Group", code: "EMG", contactName: "Robert Chen", contactEmail: "robert@emg.com", active: true }
    ];
    
    suppliers.forEach(supplier => this.createSupplier(supplier));

    // Add sample categories
    const categories = [
      { name: "Electronics", code: "ELEC", level: 0, path: "/ELEC" },
      { name: "Office Supplies", code: "OFFICE", level: 0, path: "/OFFICE" },
      { name: "Furniture", code: "FURN", level: 0, path: "/FURN" }
    ];
    
    categories.forEach(category => this.createCategory(category));
    
    // Add sample products with enhanced search fields
    const products = [
      { 
        sku: "ELC-1001", 
        manufacturerPartNumber: "MP-42857",
        upc: "736983452918",
        name: "Ultra HD 4K Smart TV 55-inch", 
        description: "Premium 4K Ultra HD Smart TV with built-in streaming apps and voice control",
        categoryId: 1, 
        manufacturerId: 1,
        manufacturerName: "TechVision",
        price: "699.99",
        cost: "450.00",
        weight: "42.5",
        dimensions: "48.5 x 28.3 x 3.1",
        status: "active",
        isRemanufactured: false,
        isCloseout: false,
        isOnSale: true,
        hasRebate: true,
        hasFreeShipping: true,
        inventoryQuantity: 58,
        reorderThreshold: 15,
        attributes: {
          resolution: "3840 x 2160",
          refreshRate: "120Hz",
          hdmiPorts: 4,
          smartFeatures: ["Netflix", "Hulu", "Prime Video", "Voice Control"]
        }
      },
      { 
        sku: "OFF-2001", 
        manufacturerPartNumber: "ERGO-5721",
        upc: "847392857103",
        name: "Ergonomic Office Chair", 
        description: "Adjustable ergonomic office chair with lumbar support and breathable mesh back",
        categoryId: 2, 
        manufacturerId: 3,
        manufacturerName: "OfficeMax",
        price: "249.99",
        cost: "125.00",
        weight: "32.0",
        dimensions: "25 x 25 x 42",
        status: "active",
        isRemanufactured: false,
        isCloseout: false,
        isOnSale: false,
        hasRebate: false,
        hasFreeShipping: true,
        inventoryQuantity: 120,
        reorderThreshold: 20,
        attributes: {
          maxWeight: "300lbs",
          material: "Mesh",
          adjustable: true,
          color: "Black"
        }
      },
      { 
        sku: "ELC-1245", 
        manufacturerPartNumber: "SNY-8765",
        upc: "654821765498",
        name: "Wireless Noise-Cancelling Headphones", 
        description: "Premium wireless headphones with active noise cancellation and 30-hour battery life",
        categoryId: 1, 
        manufacturerId: 2,
        manufacturerName: "AudioTech",
        price: "199.99",
        cost: "89.99",
        weight: "0.65",
        dimensions: "7.5 x 6.5 x 3.2",
        status: "active",
        isRemanufactured: false,
        isCloseout: false,
        isOnSale: true,
        hasRebate: false,
        hasFreeShipping: true,
        inventoryQuantity: 85,
        reorderThreshold: 25,
        attributes: {
          batteryLife: "30 hours",
          connectivity: "Bluetooth 5.0",
          noiseReduction: "Active",
          foldable: true
        }
      },
      { 
        sku: "FRN-3042", 
        manufacturerPartNumber: "DESK-PRO-72",
        upc: "932857610044",
        name: "Executive Office Desk", 
        description: "Large executive desk with mahogany finish and cable management system",
        categoryId: 3, 
        manufacturerId: 4,
        manufacturerName: "WoodWorks",
        price: "499.99",
        cost: "270.00",
        weight: "125.0",
        dimensions: "72 x 36 x 30",
        status: "active",
        isRemanufactured: false,
        isCloseout: true,
        isOnSale: true,
        hasRebate: false,
        hasFreeShipping: false,
        inventoryQuantity: 12,
        reorderThreshold: 5,
        attributes: {
          material: "Mahogany veneer",
          drawers: 4,
          assembled: false,
          style: "Executive"
        }
      },
      { 
        sku: "ELC-2078", 
        manufacturerPartNumber: "TBLT-RFB-102",
        upc: "654982374111",
        name: "10.2-inch Tablet (Refurbished)", 
        description: "Certified refurbished 10.2-inch tablet, like new condition with 1-year warranty",
        categoryId: 1, 
        manufacturerId: 1,
        manufacturerName: "TechVision",
        price: "179.99",
        cost: "100.00",
        weight: "1.2",
        dimensions: "9.8 x 6.8 x 0.29",
        status: "active",
        isRemanufactured: true,
        isCloseout: false,
        isOnSale: false,
        hasRebate: false,
        hasFreeShipping: true,
        inventoryQuantity: 35,
        reorderThreshold: 10,
        attributes: {
          screenSize: "10.2 inches",
          storage: "64GB",
          processor: "A13 Bionic",
          camera: "8MP"
        }
      },
      { 
        sku: "OFF-4561", 
        manufacturerPartNumber: "PRNTR-LZ-8432",
        upc: "743598237467",
        name: "Color Laser Printer", 
        description: "High-speed color laser printer for business with automatic duplex printing",
        categoryId: 2, 
        manufacturerId: 5,
        manufacturerName: "PrintTech",
        price: "349.99",
        cost: "225.00",
        weight: "45.2",
        dimensions: "19.5 x 17.2 x 15.3",
        status: "draft",
        isRemanufactured: false,
        isCloseout: false,
        isOnSale: false,
        hasRebate: true,
        hasFreeShipping: false,
        inventoryQuantity: 0,
        reorderThreshold: 8,
        attributes: {
          printSpeed: "28ppm",
          resolution: "2400 x 600 dpi",
          wireless: true,
          paperCapacity: 250
        }
      },
      { 
        sku: "FRN-1024", 
        manufacturerPartNumber: "BKC-MTRL-89",
        upc: "892347561044",
        name: "Modular Bookcase", 
        description: "Customizable modular bookcase that can be arranged in various configurations",
        categoryId: 3, 
        manufacturerId: 4,
        manufacturerName: "WoodWorks",
        price: "159.99",
        cost: "80.00",
        weight: "65.0",
        dimensions: "35 x 12 x 72",
        status: "active",
        isRemanufactured: false,
        isCloseout: false,
        isOnSale: false,
        hasRebate: false,
        hasFreeShipping: true,
        inventoryQuantity: 42,
        reorderThreshold: 10,
        attributes: {
          material: "Engineered wood",
          shelves: 6,
          color: "Espresso",
          maxWeight: "25 lbs per shelf"
        }
      },
      { 
        sku: "ELC-3782", 
        manufacturerPartNumber: "SMWT-8765-XR",
        upc: "654321098765",
        name: "Smartwatch with GPS", 
        description: "Advanced smartwatch with GPS, heart rate monitoring, and 5-day battery life",
        categoryId: 1, 
        manufacturerId: 2,
        manufacturerName: "AudioTech",
        price: "299.99",
        cost: "175.00",
        weight: "0.15",
        dimensions: "1.5 x 1.7 x 0.4",
        status: "active",
        isRemanufactured: false,
        isCloseout: false,
        isOnSale: false,
        hasRebate: false,
        hasFreeShipping: true,
        inventoryQuantity: 28,
        reorderThreshold: 15,
        attributes: {
          batteryLife: "5 days",
          waterproof: "50m",
          display: "AMOLED",
          sensors: ["GPS", "Heart rate", "Accelerometer", "Gyroscope"]
        }
      }
    ];
    
    products.forEach(product => this.createProduct(product));

    // Add sample imports
    const imports = [
      { 
        filename: "Supplier_XYZ_Product_Catalog.csv", 
        supplierId: 2, 
        status: "success", 
        type: "csv", 
        recordCount: 834, 
        processedCount: 834, 
        errorCount: 0,
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        completedAt: new Date(Date.now() - 2.8 * 60 * 60 * 1000),
        mappingTemplate: "Standard Product Catalog",
      },
      { 
        filename: "ABC_Vendor_Full_Catalog.xlsx", 
        supplierId: 1, 
        status: "success", 
        type: "excel", 
        recordCount: 1256, 
        processedCount: 1256, 
        errorCount: 0,
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
        completedAt: new Date(Date.now() - 5.8 * 60 * 60 * 1000),
        mappingTemplate: "Standard Product Catalog",
      },
      { 
        filename: "GlobalSupplier_API_Sync", 
        supplierId: 3, 
        status: "processing", 
        type: "api", 
        recordCount: 2400, 
        processedCount: 1560, 
        errorCount: 0,
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        sourceData: { apiEndpoint: "https://api.globalsupplies.com/products" },
        mappingTemplate: "Standard Product Catalog",
      },
      { 
        filename: "WestCoast_SKU_Update.csv", 
        supplierId: 4, 
        status: "error", 
        type: "csv", 
        recordCount: 345, 
        processedCount: 0, 
        errorCount: 1,
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
        completedAt: new Date(Date.now() - 11.9 * 60 * 60 * 1000),
        mappingTemplate: "Price & Inventory Update",
        importErrors: [{ message: "Schema validation error", line: 1 }],
      }
    ];
    
    imports.forEach(importData => this.createImport(importData));

    // Add sample approvals
    const approvals = [
      {
        type: "product",
        title: "New Product Categorization",
        description: "153 new products from Acme Inc. require category assignment",
        status: "pending",
        requestedBy: 1,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        entityType: "product_batch",
      },
      {
        type: "product",
        title: "Product Data Conflicts",
        description: "28 products with conflicting attribute values from multiple suppliers",
        status: "pending",
        requestedBy: 1,
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
        entityType: "product_batch",
      },
      {
        type: "category",
        title: "Attribute Schema Update",
        description: "Electronic category needs 6 new attributes for compliance",
        status: "pending",
        requestedBy: 1,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        entityType: "category",
        entityId: 1,
      },
    ];
    
    approvals.forEach(approval => this.createApproval(approval));

    // Add sample data sources for various integration types
    const dataSources = [
      {
        name: "XYZ Supplies Product CSV",
        type: "csv",
        supplierId: 2, // XYZ Supplies Inc.
        active: true,
        config: {
          delimiter: ",",
          hasHeader: true,
          encoding: "utf-8"
        }
      },
      {
        name: "ABC Trading EDI Feed",
        type: "edi_x12",
        supplierId: 1, // ABC Trading Co.
        active: true,
        config: {
          standard: "X12",
          version: "4010",
          transactionSet: "832", // Price/Sales Catalog
          segmentSeparator: "~",
          elementSeparator: "*"
        }
      },
      {
        name: "Global Supplies API",
        type: "api",
        supplierId: 3, // Global Supplies Ltd.
        active: true,
        config: {
          url: "https://api.globalsupplies.com/v1/products",
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          authType: "apiKey",
          apiKeyName: "X-API-KEY",
          responseFormat: "json",
          pagination: {
            type: "offset",
            limitParam: "limit",
            offsetParam: "offset",
            limitValue: 100
          }
        }
      },
      {
        name: "West Coast SFTP Feed",
        type: "sftp",
        supplierId: 4, // West Coast Distributors
        active: true,
        config: {
          host: "sftp.westcoastdist.com",
          port: 22,
          username: "mdm_client",
          remotePath: "/exports/daily",
          filePattern: "inventory_*.csv",
          protocol: "sftp"
        }
      }
    ];

    // Add sample mapping templates
    const mappingTemplates = [
      {
        name: "XYZ CSV Standard Format",
        description: "Mapping for XYZ Supplies CSV product catalog",
        sourceType: "csv",
        mappings: [
          { sourceField: "SKU", destinationField: "sku", required: true },
          { sourceField: "ITEM_NAME", destinationField: "name", required: true },
          { sourceField: "DESCRIPTION", destinationField: "description" },
          { sourceField: "CATEGORY", destinationField: "categoryId" },
          { sourceField: "PRICE", destinationField: "price" },
          { sourceField: "COST", destinationField: "cost" },
          { sourceField: "UPC", destinationField: "upc" },
          { sourceField: "MFR_PART_NUM", destinationField: "manufacturerPartNumber" },
          { sourceField: "STOCK_QTY", destinationField: "inventoryQuantity" }
        ],
        transformations: [
          { 
            type: "numberFormat", 
            sourceField: "PRICE", 
            parameters: { decimalPlaces: 2, removeSymbols: true } 
          },
          { 
            type: "trim", 
            sourceField: "ITEM_NAME" 
          }
        ],
        validationRules: [
          { 
            field: "SKU", 
            type: "required", 
            errorMessage: "SKU is required", 
            severity: "error" 
          },
          { 
            field: "PRICE", 
            type: "format", 
            parameters: { pattern: "numeric" }, 
            errorMessage: "Price must be numeric", 
            severity: "error" 
          }
        ]
      },
      {
        name: "EDI X12 832 Mapping",
        description: "Mapping for EDI X12 832 Price/Sales Catalog",
        sourceType: "edi_x12",
        mappings: [
          { sourceField: "LIN.03", destinationField: "sku", required: true },
          { sourceField: "LIN.05", destinationField: "upc" },
          { sourceField: "PID.05", destinationField: "name", required: true },
          { sourceField: "CTP.03", destinationField: "price" }
        ],
        transformations: [],
        validationRules: []
      },
      {
        name: "Global API Standard Format",
        description: "Mapping for Global Supplies API response",
        sourceType: "api",
        mappings: [
          { sourceField: "product_id", destinationField: "sku", required: true },
          { sourceField: "product_name", destinationField: "name", required: true },
          { sourceField: "product_description", destinationField: "description" },
          { sourceField: "retail_price", destinationField: "price" },
          { sourceField: "wholesale_price", destinationField: "cost" },
          { sourceField: "barcode", destinationField: "upc" },
          { sourceField: "manufacturer_id", destinationField: "manufacturerPartNumber" },
          { sourceField: "stock_level", destinationField: "inventoryQuantity" }
        ],
        transformations: [],
        validationRules: []
      }
    ];

    // Add the data sources and mapping templates to the database
    dataSources.forEach(dataSource => this.createDataSource(dataSource));
    mappingTemplates.forEach(template => this.createMappingTemplate(template));
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const newUser = { ...user, id };
    this.users.set(id, newUser);
    return newUser;
  }

  // Supplier methods
  async getSuppliers(): Promise<Supplier[]> {
    return Array.from(this.suppliers.values());
  }

  async getSupplier(id: number): Promise<Supplier | undefined> {
    return this.suppliers.get(id);
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const id = this.supplierIdCounter++;
    const newSupplier = { ...supplier, id };
    this.suppliers.set(id, newSupplier);
    return newSupplier;
  }

  async updateSupplier(id: number, supplier: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const existingSupplier = this.suppliers.get(id);
    if (!existingSupplier) return undefined;
    
    const updatedSupplier = { ...existingSupplier, ...supplier };
    this.suppliers.set(id, updatedSupplier);
    return updatedSupplier;
  }

  // Category methods
  async getCategories(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }

  async getCategory(id: number): Promise<Category | undefined> {
    return this.categories.get(id);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const id = this.categoryIdCounter++;
    const newCategory = { ...category, id };
    this.categories.set(id, newCategory);
    return newCategory;
  }

  async updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined> {
    const existingCategory = this.categories.get(id);
    if (!existingCategory) return undefined;
    
    const updatedCategory = { ...existingCategory, ...category };
    this.categories.set(id, updatedCategory);
    return updatedCategory;
  }

  // Product methods
  async getProducts(): Promise<Product[]> {
    return Array.from(this.products.values()).map(product => {
      const category = this.categories.get(product.categoryId);
      
      // Calculate aggregate stock quantity across all suppliers and warehouses
      // In a real implementation, this would query the warehouse inventory table
      let stockQuantity = product.inventoryQuantity || 0;
      
      // Add stock from suppliers (simulating multiple warehouses)
      const productSuppliersList = Array.from(this.productSuppliers.values())
        .filter(ps => ps.productId === product.id);
      
      // Each supplier might have inventory in multiple warehouses
      productSuppliersList.forEach(ps => {
        // In a real implementation, this would be from a warehouse_inventory table
        // For now, we'll simulate by adding a random amount per supplier (1-25 units)
        const supplierStock = Math.floor(Math.random() * 25) + 1;
        stockQuantity += supplierStock;
      });
      
      return {
        ...product,
        categoryName: category ? category.name : null,
        stockQuantity: stockQuantity
      };
    });
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;
    
    const category = this.categories.get(product.categoryId);
    
    // Calculate aggregate stock quantity across all suppliers and warehouses
    let stockQuantity = product.inventoryQuantity || 0;
    
    // Add stock from suppliers (simulating multiple warehouses)
    const productSuppliersList = Array.from(this.productSuppliers.values())
      .filter(ps => ps.productId === product.id);
    
    productSuppliersList.forEach(ps => {
      // Simulate warehouse inventory
      const supplierStock = Math.floor(Math.random() * 25) + 1;
      stockQuantity += supplierStock;
    });
    
    return {
      ...product,
      categoryName: category ? category.name : null,
      stockQuantity: stockQuantity
    };
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    return Array.from(this.products.values()).find(product => product.sku === sku);
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const id = this.productIdCounter++;
    const now = new Date();
    const newProduct = { 
      ...product, 
      id, 
      createdAt: now, 
      updatedAt: now 
    };
    this.products.set(id, newProduct);
    return newProduct;
  }

  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const existingProduct = this.products.get(id);
    if (!existingProduct) return undefined;
    
    const updatedProduct = { 
      ...existingProduct, 
      ...product, 
      updatedAt: new Date() 
    };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }

  async deleteProduct(id: number): Promise<boolean> {
    return this.products.delete(id);
  }

  // ProductSupplier methods
  async getProductSuppliers(productId: number): Promise<ProductSupplier[]> {
    return Array.from(this.productSuppliers.values())
      .filter(ps => ps.productId === productId);
  }

  async createProductSupplier(productSupplier: InsertProductSupplier): Promise<ProductSupplier> {
    const id = this.productSupplierIdCounter++;
    const newProductSupplier = { ...productSupplier, id };
    this.productSuppliers.set(id, newProductSupplier);
    return newProductSupplier;
  }

  async updateProductSupplier(id: number, productSupplier: Partial<InsertProductSupplier>): Promise<ProductSupplier | undefined> {
    const existingProductSupplier = this.productSuppliers.get(id);
    if (!existingProductSupplier) return undefined;
    
    const updatedProductSupplier = { ...existingProductSupplier, ...productSupplier };
    this.productSuppliers.set(id, updatedProductSupplier);
    return updatedProductSupplier;
  }

  // Import methods
  async getImports(): Promise<Import[]> {
    return Array.from(this.imports.values());
  }

  async getImport(id: number): Promise<Import | undefined> {
    return this.imports.get(id);
  }

  async createImport(importData: InsertImport): Promise<Import> {
    const id = this.importIdCounter++;
    const newImport = { 
      ...importData, 
      id,
      createdAt: importData.createdAt || new Date(),
      completedAt: importData.completedAt
    };
    this.imports.set(id, newImport);
    return newImport;
  }

  async updateImport(id: number, importData: Partial<InsertImport>): Promise<Import | undefined> {
    const existingImport = this.imports.get(id);
    if (!existingImport) return undefined;
    
    const updatedImport = { ...existingImport, ...importData };
    this.imports.set(id, updatedImport);
    return updatedImport;
  }

  // Export methods
  async getExports(): Promise<Export[]> {
    return Array.from(this.exports.values());
  }

  async getExport(id: number): Promise<Export | undefined> {
    return this.exports.get(id);
  }

  async createExport(exportData: InsertExport): Promise<Export> {
    const id = this.exportIdCounter++;
    const newExport = { 
      ...exportData, 
      id,
      createdAt: new Date()
    };
    this.exports.set(id, newExport);
    return newExport;
  }

  async updateExport(id: number, exportData: Partial<InsertExport>): Promise<Export | undefined> {
    const existingExport = this.exports.get(id);
    if (!existingExport) return undefined;
    
    const updatedExport = { ...existingExport, ...exportData };
    this.exports.set(id, updatedExport);
    return updatedExport;
  }

  // Approval methods
  async getApprovals(): Promise<Approval[]> {
    return Array.from(this.approvals.values());
  }

  async getApproval(id: number): Promise<Approval | undefined> {
    return this.approvals.get(id);
  }

  async createApproval(approval: InsertApproval): Promise<Approval> {
    const id = this.approvalIdCounter++;
    const now = new Date();
    const newApproval = { 
      ...approval, 
      id,
      createdAt: now,
      updatedAt: now,
      completedAt: null
    };
    this.approvals.set(id, newApproval);
    return newApproval;
  }

  async updateApproval(id: number, approval: Partial<InsertApproval>): Promise<Approval | undefined> {
    const existingApproval = this.approvals.get(id);
    if (!existingApproval) return undefined;
    
    const updatedApproval = { 
      ...existingApproval, 
      ...approval,
      updatedAt: new Date() 
    };
    this.approvals.set(id, updatedApproval);
    return updatedApproval;
  }

  // Audit log methods
  async getAuditLogs(): Promise<AuditLog[]> {
    return Array.from(this.auditLogs.values());
  }

  async createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog> {
    const id = this.auditLogIdCounter++;
    const newAuditLog = { 
      ...auditLog, 
      id,
      timestamp: new Date()
    };
    this.auditLogs.set(id, newAuditLog);
    return newAuditLog;
  }

  // Data source management
  async getDataSources(): Promise<DataSource[]> {
    return Array.from(this.dataSources.values());
  }

  async getDataSource(id: number): Promise<DataSource | undefined> {
    return this.dataSources.get(id);
  }

  async getDataSourcesByType(type: string): Promise<DataSource[]> {
    return Array.from(this.dataSources.values()).filter(ds => ds.type === type);
  }

  async getDataSourcesBySupplier(supplierId: number): Promise<DataSource[]> {
    return Array.from(this.dataSources.values()).filter(ds => ds.supplierId === supplierId);
  }

  async createDataSource(dataSource: InsertDataSource): Promise<DataSource> {
    const id = this.dataSourceIdCounter++;
    const createdAt = new Date();
    const updatedAt = new Date();
    const newDataSource = { 
      ...dataSource,
      id, 
      createdAt, 
      updatedAt 
    };
    this.dataSources.set(id, newDataSource);
    return newDataSource;
  }

  async updateDataSource(id: number, dataSource: Partial<InsertDataSource>): Promise<DataSource | undefined> {
    const existingDataSource = this.dataSources.get(id);
    if (!existingDataSource) return undefined;
    
    const updatedDataSource = { 
      ...existingDataSource, 
      ...dataSource, 
      updatedAt: new Date() 
    };
    this.dataSources.set(id, updatedDataSource);
    return updatedDataSource;
  }

  async deleteDataSource(id: number): Promise<boolean> {
    return this.dataSources.delete(id);
  }

  // Schedule management
  async getSchedules(): Promise<Schedule[]> {
    return Array.from(this.schedules.values());
  }

  async getSchedulesByDataSource(dataSourceId: number): Promise<Schedule[]> {
    return Array.from(this.schedules.values()).filter(s => s.dataSourceId === dataSourceId);
  }

  async getSchedule(id: number): Promise<Schedule | undefined> {
    return this.schedules.get(id);
  }

  async createSchedule(schedule: InsertSchedule): Promise<Schedule> {
    const id = this.scheduleIdCounter++;
    const createdAt = new Date();
    const updatedAt = new Date();
    const newSchedule = { 
      ...schedule,
      id, 
      createdAt, 
      updatedAt, 
      lastRun: null, 
      nextRun: null 
    };
    this.schedules.set(id, newSchedule);
    return newSchedule;
  }

  async updateSchedule(id: number, schedule: Partial<InsertSchedule>): Promise<Schedule | undefined> {
    const existingSchedule = this.schedules.get(id);
    if (!existingSchedule) return undefined;
    
    const updatedSchedule = { 
      ...existingSchedule, 
      ...schedule, 
      updatedAt: new Date() 
    };
    this.schedules.set(id, updatedSchedule);
    return updatedSchedule;
  }

  async deleteSchedule(id: number): Promise<boolean> {
    return this.schedules.delete(id);
  }

  async updateScheduleLastRun(id: number, lastRun: Date): Promise<Schedule | undefined> {
    const schedule = this.schedules.get(id);
    if (!schedule) return undefined;
    
    const updatedSchedule = { ...schedule, lastRun, updatedAt: new Date() };
    this.schedules.set(id, updatedSchedule);
    return updatedSchedule;
  }

  async updateScheduleNextRun(id: number, nextRun: Date): Promise<Schedule | undefined> {
    const schedule = this.schedules.get(id);
    if (!schedule) return undefined;
    
    const updatedSchedule = { ...schedule, nextRun, updatedAt: new Date() };
    this.schedules.set(id, updatedSchedule);
    return updatedSchedule;
  }

  // Mapping template management
  async getMappingTemplates(): Promise<MappingTemplate[]> {
    return Array.from(this.mappingTemplates.values());
  }

  async getMappingTemplate(id: number): Promise<MappingTemplate | undefined> {
    return this.mappingTemplates.get(id);
  }

  async getMappingTemplatesBySourceType(sourceType: string): Promise<MappingTemplate[]> {
    return Array.from(this.mappingTemplates.values()).filter(mt => mt.sourceType === sourceType);
  }

  async createMappingTemplate(mappingTemplate: InsertMappingTemplate): Promise<MappingTemplate> {
    const id = this.mappingTemplateIdCounter++;
    const createdAt = new Date();
    const updatedAt = new Date();
    const newMappingTemplate = { 
      ...mappingTemplate,
      id, 
      createdAt, 
      updatedAt 
    };
    this.mappingTemplates.set(id, newMappingTemplate);
    return newMappingTemplate;
  }

  async updateMappingTemplate(id: number, mappingTemplate: Partial<InsertMappingTemplate>): Promise<MappingTemplate | undefined> {
    const existingTemplate = this.mappingTemplates.get(id);
    if (!existingTemplate) return undefined;
    
    const updatedTemplate = { 
      ...existingTemplate, 
      ...mappingTemplate, 
      updatedAt: new Date() 
    };
    this.mappingTemplates.set(id, updatedTemplate);
    return updatedTemplate;
  }

  async deleteMappingTemplate(id: number): Promise<boolean> {
    return this.mappingTemplates.delete(id);
  }

  // Data lineage
  async getDataLineageByProduct(productId: number): Promise<DataLineage[]> {
    return Array.from(this.dataLineage.values()).filter(dl => dl.productId === productId);
  }

  async getDataLineageByField(productId: number, fieldName: string): Promise<DataLineage[]> {
    return Array.from(this.dataLineage.values()).filter(
      dl => dl.productId === productId && dl.fieldName === fieldName
    );
  }

  async createDataLineage(dataLineage: InsertDataLineage): Promise<DataLineage> {
    const id = this.dataLineageIdCounter++;
    const timestamp = new Date();
    const newDataLineage = { 
      ...dataLineage,
      id, 
      timestamp 
    };
    this.dataLineage.set(id, newDataLineage);
    return newDataLineage;
  }

  // Data merging configuration
  async getDataMergingConfigs(): Promise<DataMergingConfig[]> {
    return Array.from(this.dataMergingConfigs.values());
  }

  async getDataMergingConfig(id: number): Promise<DataMergingConfig | undefined> {
    return this.dataMergingConfigs.get(id);
  }

  async getActiveDataMergingConfig(): Promise<DataMergingConfig | undefined> {
    return Array.from(this.dataMergingConfigs.values()).find(config => config.active);
  }

  async createDataMergingConfig(dataMergingConfig: InsertDataMergingConfig): Promise<DataMergingConfig> {
    const id = this.dataMergingConfigIdCounter++;
    const createdAt = new Date();
    const updatedAt = new Date();
    const newConfig = { 
      ...dataMergingConfig,
      id, 
      createdAt, 
      updatedAt 
    };
    this.dataMergingConfigs.set(id, newConfig);
    return newConfig;
  }

  async updateDataMergingConfig(id: number, dataMergingConfig: Partial<InsertDataMergingConfig>): Promise<DataMergingConfig | undefined> {
    const existingConfig = this.dataMergingConfigs.get(id);
    if (!existingConfig) return undefined;
    
    const updatedConfig = { 
      ...existingConfig, 
      ...dataMergingConfig, 
      updatedAt: new Date() 
    };
    this.dataMergingConfigs.set(id, updatedConfig);
    return updatedConfig;
  }

  // Workflow management
  async getWorkflows(): Promise<Workflow[]> {
    return Array.from(this.workflows.values());
  }

  async getWorkflow(id: number): Promise<Workflow | undefined> {
    return this.workflows.get(id);
  }

  async getActiveWorkflows(): Promise<Workflow[]> {
    return Array.from(this.workflows.values()).filter(w => w.active);
  }

  async createWorkflow(workflow: InsertWorkflow): Promise<Workflow> {
    const id = this.workflowIdCounter++;
    const createdAt = new Date();
    const updatedAt = new Date();
    const newWorkflow = { 
      ...workflow,
      id, 
      createdAt, 
      updatedAt 
    };
    this.workflows.set(id, newWorkflow);
    return newWorkflow;
  }

  async updateWorkflow(id: number, workflow: Partial<InsertWorkflow>): Promise<Workflow | undefined> {
    const existingWorkflow = this.workflows.get(id);
    if (!existingWorkflow) return undefined;
    
    const updatedWorkflow = { 
      ...existingWorkflow, 
      ...workflow, 
      updatedAt: new Date() 
    };
    this.workflows.set(id, updatedWorkflow);
    return updatedWorkflow;
  }

  // Workflow execution
  async getWorkflowExecutions(workflowId: number): Promise<WorkflowExecution[]> {
    return Array.from(this.workflowExecutions.values()).filter(we => we.workflowId === workflowId);
  }

  async getWorkflowExecution(id: number): Promise<WorkflowExecution | undefined> {
    return this.workflowExecutions.get(id);
  }

  async createWorkflowExecution(workflowExecution: InsertWorkflowExecution): Promise<WorkflowExecution> {
    const id = this.workflowExecutionIdCounter++;
    const startedAt = new Date();
    const newExecution = { 
      ...workflowExecution,
      id, 
      startedAt, 
      completedAt: null 
    };
    this.workflowExecutions.set(id, newExecution);
    return newExecution;
  }

  async updateWorkflowExecution(id: number, status: string, results?: any, error?: string): Promise<WorkflowExecution | undefined> {
    const execution = this.workflowExecutions.get(id);
    if (!execution) return undefined;
    
    const updatedExecution = { 
      ...execution, 
      status,
      results: results || execution.results,
      error: error || execution.error
    };
    this.workflowExecutions.set(id, updatedExecution);
    return updatedExecution;
  }

  async completeWorkflowExecution(id: number, results: any): Promise<WorkflowExecution | undefined> {
    const execution = this.workflowExecutions.get(id);
    if (!execution) return undefined;
    
    const completedAt = new Date();
    const updatedExecution = { 
      ...execution, 
      status: 'completed',
      completedAt,
      results
    };
    this.workflowExecutions.set(id, updatedExecution);
    return updatedExecution;
  }

  async failWorkflowExecution(id: number, error: string): Promise<WorkflowExecution | undefined> {
    const execution = this.workflowExecutions.get(id);
    if (!execution) return undefined;
    
    const completedAt = new Date();
    const updatedExecution = { 
      ...execution, 
      status: 'failed',
      completedAt,
      error
    };
    this.workflowExecutions.set(id, updatedExecution);
    return updatedExecution;
  }

  // Warehouse management
  private warehousesData: any[] = [
    { id: "WH1", name: "Main Warehouse", code: "MAIN", address: { street: "123 Logistics Way", city: "Commerce", state: "CA", postal_code: "90001", country: "USA" }, active: true },
    { id: "WH2", name: "East Coast DC", code: "EASTDC", address: { street: "456 Distribution Ave", city: "Edison", state: "NJ", postal_code: "08817", country: "USA" }, active: true },
    { id: "WH3", name: "Midwest Fulfillment", code: "MIDWEST", address: { street: "789 Supply Chain Blvd", city: "Chicago", state: "IL", postal_code: "60642", country: "USA" }, active: true }
  ];
  
  async getWarehouses(): Promise<any[]> {
    return this.warehousesData;
  }
  
  // Product Fulfillment and Stock management
  private productFulfillment: Map<number, any> = new Map();
  
  async getProductFulfillment(productId: number): Promise<any | undefined> {
    return this.productFulfillment.get(productId);
  }
  
  async updateProductFulfillment(productId: number, fulfillment: any): Promise<any> {
    // Ensure the product exists
    const product = await this.getProduct(productId);
    if (!product) throw new Error("Product not found");
    
    // Store the fulfillment data
    this.productFulfillment.set(productId, fulfillment);
    
    return fulfillment;
  }
  
  async getProductStock(productId: number): Promise<any> {
    // Ensure the product exists
    const product = await this.getProduct(productId);
    if (!product) throw new Error("Product not found");
    
    // Get the current fulfillment settings to determine stock sources
    const fulfillment = await this.getProductFulfillment(productId);
    
    // Initialize response structure
    const stockData = {
      total: 0,
      internal: {
        enabled: fulfillment?.internal_stock?.enabled || false,
        total: 0,
        warehouses: []
      },
      dropship: {
        enabled: fulfillment?.dropship?.enabled || false,
        supplier: null,
        stock: 0
      }
    };
    
    // If we have fulfillment data, use it to calculate stock
    if (fulfillment) {
      // Process internal stock
      if (fulfillment.internal_stock && fulfillment.internal_stock.enabled) {
        const internalWarehouses = fulfillment.internal_stock.warehouses || [];
        
        stockData.internal.warehouses = internalWarehouses;
        stockData.internal.total = internalWarehouses.reduce((sum: number, wh: any) => sum + (wh.stock || 0), 0);
      }
      
      // Process dropship stock
      if (fulfillment.dropship && fulfillment.dropship.enabled) {
        const supplier = fulfillment.dropship.supplier_id ? 
          await this.getSupplier(Number(fulfillment.dropship.supplier_id)) : null;
          
        stockData.dropship.supplier = supplier ? { 
          id: supplier.id, 
          name: supplier.name 
        } : null;
        
        stockData.dropship.stock = fulfillment.dropship.stock || 0;
      }
      
      // Calculate total stock from all sources
      stockData.total = stockData.internal.total + stockData.dropship.stock;
    }
    
    return stockData;
  }
}

export const storage = new MemStorage();
