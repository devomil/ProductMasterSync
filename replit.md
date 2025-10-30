# Overview

This project is an MDM/PIM (Master Data Management/Product Information Management) platform designed to streamline supplier interactions, manage extensive product catalogs, and facilitate marketplace integrations. Its core purpose is to ingest product data from various suppliers and synchronize this information with major marketplaces like Amazon. The platform aims to enhance data quality, automate workflows, and provide market intelligence for improved purchasing decisions and expanded market reach.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX
- **Frontend Framework**: React with TypeScript.
- **UI Library**: Shadcn/ui components built on Radix UI.
- **Styling**: Tailwind CSS with custom design tokens.
- **State Management**: TanStack Query for server state.
- **Design Principles**: Responsive design, professional styling, intuitive navigation, and dynamic content presentation. Features include:
  - **Purchasing AI Catalog**: Professional table layout optimized for 100k+ products with client-side sorting, color-coded margin badges, and comprehensive filtering. Automatically filters restricted products and separates FBM/FBA costs.
  - **AI Setup Page**: Multi-select fulfillment preferences (FBM, FBA, Dropship, Warehouse) with margin thresholds and analysis filters.
  - **Table Views**: Optimization modes (compact, comfortable, spacious) with quick filter chips.
  - **Documentation**: Interactive field mapping reference with categorized fields.
  - **Data Modals**: Tabbed interfaces with real-time calculations.

## Technical Implementations
- **Backend API**: Node.js with Express and TypeScript (primary); FastAPI (Python) for supplier management and data connectors (secondary).
- **Database ORM**: Drizzle ORM.
- **Database**: PostgreSQL 16 (Neon serverless with connection pooling).
- **Key Features**:
    - **Supplier Management**: Onboarding, data source configuration, connection testing, and status tracking.
    - **Data Ingestion Engine**: Handles various formats (CSV, Excel, JSON, XML, EDI) via SFTP, FTP, API, direct DB.
    - **Product Catalog Management**: Comprehensive product schema, hierarchical categories, inventory tracking, image management.
    - **Amazon Marketplace Integration**: ASIN discovery via SP-API, pricing intelligence, market opportunity analysis, UPC to ASIN mapping. Includes bulk processing with dynamic rate limiting and database-first credential management.
      - **Credentials Management**: Stored in `marketplace_credentials` table with UI configuration, async loader checks database first, all 20+ API entry points updated
      - **Catalog API Rate Limiting**: Fixed 429 errors by configuring 2 req/sec limit (Amazon's strict Catalog Items API limit), achieving 100% success rate with automatic throttling
    - **Inventory Management**: Automated data pull jobs, scheduling, dependency management, error handling, and real-time monitoring.
    - **Shipping Template System**: Supplier-specific, cost and weight-based shipping calculations.
    - **EDC SKU Generation**: Unique sequential SKU system.
    - **Field Mapping System**: Two-tier mapping (Master Catalog and Product Details) with interactive walkthrough, auto-mapping, and dual editor interfaces. Tracks unmapped supplier columns.
    - **AI-Powered Category Mapping**: Automated category mapping using Claude AI for product overlap detection, category normalization, and Google Merchant taxonomy suggestions, with an approval workflow. Product category updates are scoped to specific suppliers.
    - **Product-Supplier Linking**: Automatically creates `product_suppliers` relationships during imports for proper supplier scoping.
    - **Purchasing AI Configuration**: Multi-select fulfillment preferences (FBM, FBA, Dropship, Warehouse) with separate margin thresholds.
    - **Purchasing AI UI**: User-friendly "Run Analysis" button to trigger bulk analysis with progress monitoring and toast notifications.
    - **Purchasing AI Rate Limiting**: Production-ready rate limiting for Amazon Product Fees API (0.5 req/sec) with batch processing, circuit breaker, retry logic, exponential backoff, and real-time monitoring.
    - **Purchasing AI Deduplication**: Database-level deduplication using unique constraints on `(productId, asin)` to prevent duplicate opportunity records.
    - **Performance Optimization**: Intelligent caching and optimized queries for sub-second API responses.

## System Design
- **Module-based Architecture**: Clear separation of concerns (supplier management, data ingestion, product catalog, marketplace integration).
- **Scalability**: Designed for large product catalogs (2,800+ products) and numerous suppliers, with Amazon bulk processing handling thousands of products.
- **Data Integrity**: Comprehensive validation rules, data enrichment, and conflict resolution.
- **Deployment**: Replit for development, Replit Autoscale for production.

## Production Deployment Configuration
- **Environment**: Replit Autoscale with Node.js 20 runtime.
- **Build Process**: Vite for frontend, esbuild for backend.
- **Database**: Neon PostgreSQL with optimized connection pooling.
- **Performance**: Optimized for 1 million+ products with intelligent caching and database indexes.

# External Dependencies

## APIs and Services
- **Amazon SP-API**: For product catalog search and marketplace intelligence (OAuth2 authentication, Product Pricing API v0, Catalog Items API, Listings Restrictions API).
- **Anthropic AI**: For AI-powered data processing and enhancement.
- **SFTP/FTP Servers**: For supplier data source connections.
- **Neon**: Serverless PostgreSQL hosting.

## Key Libraries
- **Database**: `drizzle-orm`, `@neondatabase/serverless`, `pg`, `psycopg2`.
- **File Processing**: `csv-parse`, `xlsx`, `ssh2-sftp-client`.
- **HTTP Clients**: `axios`, `requests` (Python).
- **UI Components**: Radix UI suite, Shadcn/ui.
- **Validation**: `zod` (TypeScript), `pydantic` (Python).
- **Amazon SDK**: `@sp-api-sdk/auth`, `@sp-api-sdk/catalog-items-api-2022-04-01`.