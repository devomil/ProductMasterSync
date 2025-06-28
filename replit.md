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
- **Authentic CSV Data Integration Complete (2025-06-28)**:
  - Successfully integrated real CWR catalog data with 13 authentic column headers (MFGPN, ITEM, DESCRIPTION, UPC, MFG, PRICE, COST, QTY, WEIGHT, DIMENSIONS, CASE_QTY, IMAGE_URL, LARGE_IMAGE)
  - Field mapping walkthrough now displays actual CSV headers instead of hardcoded samples
  - API endpoint serves real data from catalog.csv file with proper error handling
  - Confirmed working: logs show authentic field detection and dropdown displays real column headers
  - Users can now map authentic CWR fields to Master Catalog structure with live sample data preview
- **Dynamic Source Field Detection (2025-06-28)**:
  - Updated mapping walkthrough to show actual CWR data fields in dropdowns
  - Added visual display of 13 available source fields: Part Number, Product Name, Description, UPC, Manufacturer, Price, Cost, Inventory, Weight, Dimensions, Case Qty, Image URL, Large Image
  - Enhanced sample data preview with real values from user's files
  - Simplified mapping process to Master Catalog (9 essential fields) and Product Details (remaining fields)
- **Field Mapping Walkthrough System (2025-06-28)**:
  - Built comprehensive mapping checklist walkthrough component with step-by-step validation
  - Guides users through required field mappings for Master Catalog and product details pages
  - Six categorized mapping sections: Product Identification, Product Information, Pricing & Costs, Inventory & Stock, Images & Media, Specifications & Attributes
  - Real-time progress tracking with visual completion indicators and sample data preview
  - Automatic launch after successful data source creation with seamless workflow integration
  - Manual mapping walkthrough trigger available on existing data sources via "Field Mapping Walkthrough" button
  - Validates all required fields before allowing progression to next category
  - **EDC SKU Auto-Generation**: System automatically creates EDC prefixed SKUs from supplier part numbers (e.g., "010342" becomes "EDC010342")
  - Maintains original supplier part numbers separately while generating internal EDC identifiers
  - Saves mapping templates with transformation rules for consistent catalog imports
- **Intelligent Automation Scheduling System (2025-06-27)**:
  - Built comprehensive automation scheduler for catalog and inventory workflows
  - Catalog files process first (1-2 times daily, weekly, bi-weekly, monthly)
  - Inventory files process after catalog completion (1-12 times daily with configurable hours)
  - File type classification system (catalog, inventory, pricing, images, specifications)
  - Processing dependencies ensure proper workflow order
  - Configurable retry logic, error handling, and email notifications
  - Visual workflow representation showing processing steps and timing
- **Multiple File Paths Support (2025-06-26)**:
  - Enhanced Data Source wizard to support multiple file paths per supplier
  - Users can now add/remove labeled file paths for different product categories or time periods
  - Each path has customizable label (e.g., "Main Catalog", "Seasonal Products", "Clearance Items")
  - UI includes intuitive add/remove controls with proper validation
  - Backend updated to handle filePaths array instead of single path string
  - Fixed sample data pull to use configured file paths instead of root directory
- **Sample Pull UI Workflow Priority (2025-06-26)**:
  - User emphasized importance of UI-driven sample pull workflow for supplier onboarding
  - Users need to test sample data, mapping, and verification before full catalog loads
  - Enhanced category management confirmed working - navigation consolidated to single /categories page
- **Categories Page Complete Redesign (2025-06-26)**:
  - Created modern hierarchical category display with proper tree structure and visual hierarchy
  - Added comprehensive statistics dashboard showing total categories, parent/child breakdown, and product counts
  - Implemented dual view modes (hierarchy and grid) with real-time search functionality
  - Enhanced backend API to include actual product counts for each category using SQL joins
  - Designed clean card layouts with proper spacing and intuitive navigation
- **Complete Product Image Import (2025-06-26)**:
  - Imported comprehensive image data for all 30 products from authentic CWR catalog
  - All products now have both 300x300 and 1000x1000 resolution images from productimageserver.com
  - Fixed missing images for products like EDC010342 that were previously incomplete
  - 100% image coverage achieved across entire product catalog
- **Product Image Gallery Implementation (2025-06-26)**:
  - Successfully implemented authentic CWR image display in ProductDetails Gallery tab
  - Fixed database field mapping between snake_case DB columns and camelCase API responses
  - Gallery now displays Image (300x300) and Image (1000x1000) from authentic CWR sources
- **Category Management Navigation Fix (2025-06-26)**:
  - Fixed SelectItem empty value prop error that was causing React crashes
  - Moved Category Management from Products dropdown to Suppliers dropdown as requested
  - Added proper database parameter validation to prevent NaN errors
  - Implemented missing category mapping database methods
  - Added required created_at/updated_at columns to categories table
- **UI Data Display Improvements (2025-06-26)**: 
  - Removed "EDC" prefix from internal part number displays across all pages
  - Changed SKU column header to "EDC" throughout the application
  - Cleaned HTML tags from product descriptions for better readability
- **Mapping Template System Consolidation (2025-06-25)**: Eliminated duplicate mapping template systems causing field mapping save conflicts
- **Fixed Field Mapping Format**: Corrected sourceField -> targetField mapping structure for proper persistence
- **Removed Duplicate Files**: Consolidated MappingTemplates.tsx, MappingTemplatesUpdate.tsx, and MappingTemplateWorkspace.tsx into single MappingTemplateEditor
- **Enhanced Backend Compatibility**: Updated PUT endpoint to handle both old and new mapping formats with proper conversion
- **Advanced Supplier Management (2025-06-25)**: Created dedicated /suppliers-advanced page with comprehensive supplier KPIs, risk management, price history analysis, performance scorecards, and contract tracking
- **System Monitoring Dashboard**: Implemented real-time performance analysis, database monitoring, error detection, and system insights with auto-refresh capabilities
- **Performance Optimization (2025-06-25)**: Fixed database connection timeouts and slow queries

# Changelog
- June 25, 2025. Initial setup and CWR data recovery

# User Preferences

Preferred communication style: Simple, everyday language.