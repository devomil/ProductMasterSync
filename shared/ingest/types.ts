/**
 * Data Ingestion Types
 * Defines types for various data import formats and connectors
 */

export enum DataSourceType {
  CSV = 'csv',
  EXCEL = 'excel',
  JSON = 'json',
  XML = 'xml',
  EDI_X12 = 'edi_x12',
  EDIFACT = 'edifact',
  API = 'api',
  SFTP = 'sftp',
  FTP = 'ftp',
  MANUAL = 'manual'
}

export enum ScheduleFrequency {
  ONCE = 'once',
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  CUSTOM = 'custom'
}

export interface DataSourceConfig {
  name: string;
  type: DataSourceType;
  supplierId: number;
  active: boolean;
  config: DataSourceTypeConfig;
  schedule?: ScheduleConfig;
  mappingTemplateId?: number;
}

export interface ScheduleConfig {
  frequency: ScheduleFrequency;
  startDate?: Date;
  endDate?: Date;
  dayOfWeek?: number;  // 0-6, Sunday to Saturday
  dayOfMonth?: number; // 1-31
  hour?: number;       // 0-23
  minute?: number;     // 0-59
  customCron?: string; // For custom CRON expressions
}

// Type-specific configurations
export type DataSourceTypeConfig = 
  | FileConfig 
  | ApiConfig 
  | FtpConfig 
  | EdiConfig;

export interface FileConfig {
  delimiter?: string;       // For CSV
  hasHeader?: boolean;      // For CSV/Excel
  sheetName?: string;       // For Excel
  encoding?: string;        // Default: 'utf-8'
}

export interface ApiConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  body?: string;
  authType?: 'none' | 'basic' | 'oauth' | 'apiKey';
  username?: string;        // For basic auth
  password?: string;        // For basic auth
  apiKeyName?: string;      // For API key auth
  apiKeyValue?: string;     // For API key auth
  oauthConfig?: OAuthConfig;
  pagination?: PaginationConfig;
  responseFormat?: 'json' | 'xml' | 'csv';
}

export interface OAuthConfig {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
  grantType: 'client_credentials' | 'password' | 'authorization_code';
}

export interface PaginationConfig {
  type: 'offset' | 'page' | 'cursor';
  limitParam?: string;     // Parameter name for limit/per_page
  offsetParam?: string;    // Parameter name for offset/page
  cursorParam?: string;    // Parameter name for cursor-based pagination
  cursorPath?: string;     // JSON path to cursor value in response
  limitValue?: number;     // Items per page
  maxPages?: number;       // Maximum pages to fetch
}

export interface FtpConfig {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  remotePath: string;
  filePattern?: string;    // Regex or glob pattern
  protocol: 'ftp' | 'sftp';
  passive?: boolean;       // For FTP
}

export interface EdiConfig {
  standard: 'X12' | 'EDIFACT';
  version?: string;
  transactionSet?: string; // For X12, e.g., '850' for Purchase Order
  messageType?: string;    // For EDIFACT, e.g., 'ORDERS'
  segmentSeparator?: string;
  elementSeparator?: string;
  subElementSeparator?: string;
}

// Mapping templates to normalize data from sources
export interface MappingTemplate {
  id: number;
  name: string;
  description?: string;
  sourceType: DataSourceType;
  mappings: FieldMapping[];
  transformations: Transformation[];
  validationRules: ValidationRule[];
}

export interface FieldMapping {
  sourceField: string;         // Path or column name in source data
  destinationField: string;    // Field name in our schema
  required?: boolean;
  defaultValue?: any;
}

export type TransformationType = 
  | 'dateFormat' 
  | 'numberFormat' 
  | 'trim' 
  | 'uppercase' 
  | 'lowercase' 
  | 'replace' 
  | 'split' 
  | 'join' 
  | 'concatenate'
  | 'mapValue'
  | 'extractRegex'
  | 'custom';

export interface Transformation {
  type: TransformationType;
  sourceField: string;
  destinationField?: string;  // If different from sourceField
  parameters?: Record<string, any>;
  condition?: string;         // Expression to determine if transformation applies
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'format' | 'range' | 'enum' | 'regex' | 'custom';
  parameters?: Record<string, any>;
  errorMessage?: string;
  severity: 'warning' | 'error';
}

// Data lineage for tracking origins of product data
export interface DataLineage {
  productId: number;
  fieldName: string;
  sourceId: number;      // ID of the import or data source
  sourceType: string;    // 'import', 'manual', 'api', etc.
  timestamp: Date;
  userId?: number;       // User who created/modified if applicable
  previousValue?: any;
  confidence?: number;   // Confidence score for data matching/merging
}

// Conflict resolution strategies for data merging
export enum ConflictResolutionStrategy {
  NEWEST_WINS = 'newest_wins',
  HIGHEST_CONFIDENCE_WINS = 'highest_confidence_wins',
  SPECIFIC_SOURCE_WINS = 'specific_source_wins',
  MANUAL_RESOLUTION = 'manual_resolution',
  KEEP_ALL = 'keep_all'  // Store all conflicting values
}

export interface DataMergingConfig {
  strategy: ConflictResolutionStrategy;
  preferredSourceId?: number;  // For SPECIFIC_SOURCE_WINS
  confidenceThreshold?: number; // Minimum confidence score to accept
  fields?: Record<string, ConflictResolutionStrategy>; // Field-specific strategies
}