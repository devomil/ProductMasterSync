# Overview

This is a comprehensive MDM/PIM (Master Data Management/Product Information Management) platform built to manage supplier relationships, product catalogs, and marketplace integrations. The system facilitates data ingestion from multiple suppliers through various protocols (SFTP, FTP, API) and synchronizes product information with marketplaces like Amazon.

# System Architecture

## Frontend
- **Framework**: React with TypeScript
- **UI Library**: Shadcn/ui components built on Radix UI
- **Styling**: Tailwind CSS with custom design tokens
- **State Management**: TanStack Query for server state management
- **Build Tool**: Vite for development and bundling

## Backend
- **Primary API**: Node.js with Express and TypeScript
- **Secondary API**: FastAPI (Python) for supplier management and data connectors
- **Runtime**: Node.js 20 with ES modules
- **Database ORM**: Drizzle ORM for type-safe database operations

## Database
- **Primary Database**: PostgreSQL 16
- **Migration Tool**: Drizzle Kit for schema migrations
- **Connection**: Neon serverless PostgreSQL with connection pooling

# Key Components

## 1. Supplier Management System
- **Location**: `app.py`, `models.py`, `database.py`
- **Purpose**: Manages supplier onboarding, data source configurations, and connection testing
- **Features**: 
  - Multiple data source types (SFTP, FTP, API, EDI)
  - Connection validation and testing
  - Supplier status tracking (pending, active, inactive, probation)

## 2. Data Ingestion Engine
- **Location**: `connectors.py`, `shared/ingest/types.ts`
- **Purpose**: Handles data import from various supplier sources
- **Supported Formats**: CSV, Excel, JSON, XML, EDI (X12, EDIFACT)
- **Connection Types**: SFTP, FTP, API endpoints, direct database connections

## 3. Product Catalog Management
- **Database Schema**: Comprehensive product schema in `shared/schema.ts`
- **Key Entities**:
  - Products with full attribute support
  - Categories with hierarchical structure
  - Suppliers and product-supplier relationships
  - Warehouses and inventory tracking
  - Image management with multiple URL formats

## 4. Amazon Marketplace Integration
- **Purpose**: Synchronizes product data with Amazon marketplace
- **Features**:
  - ASIN discovery via SP-API
  - Product pricing intelligence
  - Market opportunity analysis
  - UPC to ASIN mapping system

## 5. Data Validation and Quality
- **Validation Rules**: Configurable validation system with error/warning levels
- **Data Enrichment**: Automatic field population and data enhancement
- **Conflict Resolution**: Multiple strategies for handling data conflicts

# Data Flow

## 1. Supplier Onboarding
1. Supplier registration with contact information
2. Data source configuration (SFTP credentials, file paths, schedules)
3. Connection testing and validation
4. Mapping template creation for data transformation

## 2. Product Data Ingestion
1. Scheduled or manual data pulls from supplier sources
2. Data validation and transformation using mapping templates
3. Conflict detection and resolution
4. Product catalog updates with change tracking

## 3. Marketplace Synchronization
1. Product enrichment with additional attributes
2. ASIN discovery for Amazon marketplace
3. Pricing intelligence gathering
4. Opportunity identification for marketplace expansion

## 4. Data Export and Distribution
1. Product data formatting for various channels
2. Inventory synchronization across warehouses
3. Pricing updates and promotional campaigns
4. Analytics and reporting

# External Dependencies

## APIs and Services
- **Amazon SP-API**: Product catalog search, pricing data, marketplace intelligence
- **Anthropic AI**: AI-powered data processing and enhancement
- **SFTP/FTP Servers**: Supplier data source connections

## Key Libraries
- **Database**: `drizzle-orm`, `@neondatabase/serverless`, `pg`, `psycopg2`
- **File Processing**: `csv-parse`, `xlsx`, `ssh2-sftp-client`
- **HTTP Clients**: `axios`, `requests` (Python)
- **UI Components**: Complete Radix UI suite with Shadcn styling
- **Validation**: `zod` for TypeScript validation, `pydantic` for Python validation

# Deployment Strategy

## Development Environment
- **Platform**: Replit with Nix package management
- **Database**: Neon PostgreSQL with automatic provisioning
- **Port Configuration**: 
  - Frontend/API: Port 5000 (external port 80)
  - Python API: Port 8000 (external port 8000)

## Production Deployment
- **Target**: Replit Autoscale deployment
- **Build Process**: Vite build for frontend, esbuild for backend
- **Environment**: Node.js production environment with optimized bundles

## Database Management
- **Schema Evolution**: Drizzle migrations with version control
- **Performance**: Optimized indexes for product searches and supplier queries
- **Backup Strategy**: Automated backups through Neon platform

# Recent Changes
- **Authentic Data Import (2025-06-25)**: Successfully importing real CWR products from SFTP server
- **Zero Mock Data**: Eliminated all test/synthetic products, using only genuine supplier data
- **SFTP Connection**: Working connection to edi.cwrdistribution.com pulling authentic product catalog
- **Frontend Fix**: Resolved "Failed to load files" error in mapping template workspace

# Changelog
- June 25, 2025. Initial setup and CWR data recovery

# User Preferences

Preferred communication style: Simple, everyday language.