# Overview

This project is an MDM/PIM (Master Data Management/Product Information Management) platform designed to streamline supplier interactions, manage extensive product catalogs, and facilitate marketplace integrations. Its core purpose is to ingest product data from various suppliers using diverse protocols (SFTP, FTP, API) and synchronize this information with major marketplaces like Amazon. The platform aims to enhance data quality, automate workflows, and provide market intelligence for improved purchasing decisions and expanded market reach.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX
- **Frontend Framework**: React with TypeScript.
- **UI Library**: Shadcn/ui components built on Radix UI.
- **Styling**: Tailwind CSS with custom design tokens.
- **State Management**: TanStack Query for server state.
- **Build Tool**: Vite.
- **Design Principles**: Responsive design, professional styling, intuitive navigation, and dynamic content presentation. Features include:
  - **Purchasing AI Catalog**: Modern grid layout (1-4 columns) with server-side pagination, Amazon images, ROI badges, and accessibility features
  - **Table Views**: Optimization modes (compact, comfortable, spacious) with quick filter chips
  - **Documentation**: Interactive field mapping reference with categorized fields, type badges, and usage examples
  - **Data Modals**: Tabbed interfaces for logical organization with real-time calculations

## Technical Implementations
- **Backend API (Primary)**: Node.js with Express and TypeScript (Node.js 20, ES modules).
- **Backend API (Secondary)**: FastAPI (Python) for supplier management and data connectors.
- **Database ORM**: Drizzle ORM for type-safe operations.
- **Database**: PostgreSQL 16 (Neon serverless with connection pooling).
- **Migration Tool**: Drizzle Kit.
- **Key Features**:
    - **Supplier Management**: Onboarding, data source configuration, connection testing, and status tracking.
    - **Data Ingestion Engine**: Handles CSV, Excel, JSON, XML, EDI via SFTP, FTP, API, direct DB connections.
    - **Product Catalog Management**: Comprehensive product schema, hierarchical categories, inventory tracking, image management.
    - **Amazon Marketplace Integration**: ASIN discovery via SP-API, pricing intelligence, market opportunity analysis, UPC to ASIN mapping. Includes robust bulk processing with dynamic rate limiting and auto-sync status persistence.
    - **Inventory Management**: Automated data pull jobs, scheduling (catalog, inventory files), dependency management, error handling, and real-time monitoring. Supports per-file path automation with individual scheduling controls.
    - **Shipping Template System**: Supplier-specific, cost and weight-based shipping calculations, editor with detailed rule configuration.
    - **EDC SKU Generation**: Unique sequential SKU system independent of supplier part numbers.
    - **Field Mapping System**: Comprehensive two-tier mapping structure with Master Catalog (core listing fields) and Product Details (extended information). Includes interactive walkthrough, auto-mapping, and comprehensive documentation.
      - **Dual Editor Interfaces**: Full-page editor (`/mapping-templates/:id`) with dropdown selectors, sample data preview, and unmapped field tracking; Quick-edit modal (on `/mapping-templates`) for viewing and minor edits
      - **Unmapped CSV Column Tracking**: Displays which supplier columns haven't been mapped across both catalog and detail views
      - **Database Format**: Mappings stored as `{targetField: sourceField}` in JSONB column (e.g., `{"image_url": "Image (300x300) Url"}`)
    - **AI-Powered Category Mapping**: Automated category mapping using Claude AI to handle product overlap and category name variances when onboarding new vendors.
      - **Intelligent Analysis**: Analyzes product samples to detect categories, industry patterns, and suggest master category mappings with confidence scores
      - **Google Merchant Integration**: Automatically suggests Google Merchant category taxonomy for marketplace listings
      - **Product Overlap Detection**: Identifies duplicate products across suppliers with different naming conventions
      - **Category Normalization**: Handles category name variances between suppliers (e.g., "Marine Navigation" vs "Nav Equipment")
      - **Approval Workflow**: Two-tier approval system - auto-approve high-confidence mappings or flag for manual review
      - **UI Integration**: Accessible via "AI Category Mapper" button on `/categories` page
      - **Supplier Isolation**: Product category updates are scoped to specific suppliers via `product_suppliers` junction table to prevent cross-contamination
    - **Product-Supplier Linking**: All product imports now automatically create `product_suppliers` relationships to track which products come from which suppliers. This enables proper supplier scoping for category mapping and other multi-supplier operations.
    - **Field Mapping Documentation**: Complete reference guide (`/field-mapping-docs`) documenting all 35+ catalog fields and 25+ detail fields organized by category with field types, requirements, descriptions, and examples.
    - **Performance Optimization**: Implemented intelligent caching and optimized queries for sub-second API responses.

## System Design
- **Module-based Architecture**: Clear separation of concerns (supplier management, data ingestion, product catalog, marketplace integration).
- **Scalability**: Designed for large product catalogs (2,800+ products) and numerous suppliers. Amazon bulk processing system handles thousands of products with intelligent rate limiting and concurrency control.
- **Data Integrity**: Comprehensive validation rules, data enrichment, and conflict resolution strategies.
- **Deployment**: Replit for development (Nix, Node.js 20, Python 3.10), Replit Autoscale for production.

## Performance Optimizations (September 2025)
- **Database Indexing**: 23 critical indexes for million+ product scale, including composite indexes for search and marketplace sync.
- **API Pagination**: Database-level pagination with LIMIT/OFFSET, 50-100 record limits, backward compatibility for legacy components.
- **Query Optimization**: COUNT aggregations instead of full dataset retrieval (statistics: 2,676ms → 21ms, 127x improvement).
- **Advanced Caching**: LRU cache with 10,000 entry limits, access tracking, automatic cleanup, and performance monitoring.
- **Response Times**: Sub-100ms API responses, products API from 2,000ms+ to 71ms (30x improvement).

## Production Deployment Configuration
- **Environment**: Replit Autoscale with Node.js 20 runtime.
- **Build Process**: Vite for frontend, esbuild for backend bundling.
- **Database**: Neon PostgreSQL with optimized connection pooling (max: 10, min: 2).
- **Performance**: Optimized for 1 million+ products with intelligent caching and database indexes.
- **Monitoring**: Built-in performance metrics and cache statistics.

## Development vs Production Environment
**Critical Differences** between development and production environments on Replit:
- **Separate Databases**: Development and production each have their own PostgreSQL database instances. Schema changes sync automatically when publishing, but data does NOT transfer between environments.
- **Credentials Security**: 
  - **Production**: Sensitive credentials (SFTP passwords, API keys) are stored ONLY in environment secrets, NOT in the database
  - **Development**: Credentials may be stored in database config for testing, but production code must fallback to environment variables
  - **Implementation**: All SFTP connection endpoints (`test-connection`, `sample-data`, automation scheduler) check for `process.env.SFTP_PASSWORD` before using database-stored passwords to ensure production compatibility
- **Testing**: Always test features in both environments, as connection tests may work in dev but fail in production if environment variables aren't properly configured

# External Dependencies

## APIs and Services
- **Amazon SP-API**: For product catalog search, pricing data, and marketplace intelligence.
  - **OAuth2 Authentication** (catalog/batch sync): Requires only Client ID, Client Secret, Refresh Token for product search and ASIN matching
  - **AWS Signature V4** (pricing APIs): Requires AWS Access Key ID and Secret Key for competitive pricing analysis (optional)
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