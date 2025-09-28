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
- **Design Principles**: Responsive design, professional styling, intuitive navigation, and dynamic content presentation. Features like table view optimization (compact, comfortable, spacious modes) and quick filter chips enhance user interaction. Warehouse Detail Modal uses a tabbed interface for logical data organization and real-time calculations.

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
    - **Field Mapping Walkthrough**: Guides users through required field mappings for Master Catalog and product details, including EDC SKU auto-generation.
    - **Performance Optimization**: Implemented intelligent caching and optimized queries for sub-second API responses.

## System Design
- **Module-based Architecture**: Clear separation of concerns (supplier management, data ingestion, product catalog, marketplace integration).
- **Scalability**: Designed for large product catalogs (2,800+ products) and numerous suppliers. Amazon bulk processing system handles thousands of products with intelligent rate limiting and concurrency control.
- **Data Integrity**: Comprehensive validation rules, data enrichment, and conflict resolution strategies.
- **Deployment**: Replit for development (Nix, Node.js 20, Python 3.10), Replit Autoscale for production.

# External Dependencies

## APIs and Services
- **Amazon SP-API**: For product catalog search, pricing data, and marketplace intelligence.
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