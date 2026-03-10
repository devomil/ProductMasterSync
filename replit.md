# Overview

MultiChannelOS is a multi-channel business operating system designed for businesses managing extensive product catalogs across various online marketplaces (e.g., Amazon, Walmart, eBay, Newegg). Its primary purpose is to centralize product information, manage supplier relationships, and provide AI-driven business intelligence with real-time revenue tracking. The platform aims to streamline complex e-commerce operations, from data ingestion to order fulfillment, enhancing marketplace performance and market share through automation and AI.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX
- **Frontend Framework**: React with TypeScript.
- **UI Library**: Shadcn/ui built on Radix UI.
- **Styling**: Tailwind CSS with an emerald/teal accent theme.
- **State Management**: TanStack Query.
- **Navigation**: Collapsible sidebar with grouped sections.
- **Dashboard**: Monthly Business Intelligence dashboard featuring hero KPI cards, quick stats, COGS analysis, and detailed P&L.
- **Design Principles**: Responsive, professional, sidebar-first, cutting-edge BI patterns, F-pattern information hierarchy, production-ready theming.

## Technical Implementations
- **Backend API**: Node.js with Express and TypeScript, with secondary FastAPI (Python) for specific services.
- **Database ORM**: Drizzle ORM.
- **Database**: PostgreSQL 16 (Neon serverless).
- **Core Features**:
    - **Supplier Management**: Onboarding, data source configuration, and status tracking.
    - **Data Ingestion**: Supports various formats (CSV, Excel, JSON, XML, EDI, ZIP) via SFTP, FTP, API, or direct DB connections; automatic ZIP extraction.
    - **Product Catalog Management**: Comprehensive product schema, hierarchical categories, and inventory tracking.
    - **Marketplace Integrations**: Amazon (ASIN discovery, pricing intelligence, UPC to ASIN mapping, automated sync) and Walmart (UPC-based matching, taxonomy mapping, Pricing Insights API, cursor-based pagination).
    - **Active Listings Management**: Sync, track, and monitor existing marketplace listings with bulk sync and paginated views.
    - **Referral Fee Calculation**: Advanced tiered and portion-based fee structures based on marketplace contracts, with batch recalculation.
    - **Walmart Price Incentives**: Integration to fetch and cache Walmart-funded incentive items for financial reporting.
    - **Inventory Management**: Automated data pull jobs, scheduling, and monitoring.
    - **Shipping Template System**: Supplier-specific, cost and weight-based shipping calculations.
    - **Field Mapping System**: Purpose-driven mapping templates with interactive walkthroughs, AI auto-mapping, computed fields (SUM, CONCAT, FIRST_NON_EMPTY), and header detection.
    - **AI-Powered Category Mapping**: Automated category mapping using Claude AI with approval workflow.
    - **Purchasing AI**: Multi-select fulfillment preferences, bulk analysis for large catalogs with rate limiting and deduplication.
    - **Research Opportunities**: Product list upload for marketplace selling opportunity discovery using multi-strategy ASIN matching with confidence scores.
    - **24/7 Automated Analysis System**: Infrastructure for continuous purchasing opportunity analysis.
    - **Automated Order Sync**: Scheduled order synchronization (e.g., Amazon SP-API, Walmart API) for multi-channel reporting.
    - **Order Fulfillment**: UI for order fulfillment with multi-step progress, visual financial breakdowns, multi-vendor allocation comparison (e.g., Ingram Micro API), and dynamic margin recalculation.
    - **Ingram Micro Async Order Management**: PO confirmation, creation via API with animated progress, tracking of PO status and tracking info, live status checking, retry on failure, and graceful degradation.
    - **Data Source Purpose**: Each data source has a designated purpose (Catalog, Inventory & Pricing, Order Fulfillment, etc.) with auto-suggestion and color-coded badges.
    - **COGS Dashboard Integration**: Real-time COGS analysis and Gross Profit calculation integrated into dashboards and order pages.
    - **Referral Fee SKU Matching**: 3-tier strategy (exact, prefix, fuzzy variant) for matching order item SKUs.
    - **Flxpoint Integration**: API client for pushing listings, pulling variants, pushing commission data, and enriching variants with marketplace data.
    - **Catalog Data Enrichment**: UI-driven enrichment (AI Auto-Categorize with Claude, description enrichment, Amazon ASIN discovery, Walmart ID linking).
    - **Product Data Enrichment**: Multi-source enrichment for UPCs, GTINs, dimensions, and weight (Amazon SP-API, Walmart API, UPCitemdb.com, Claude AI), with GTIN checksum validation and source attribution.
    - **Dynamic Catalog Extension**: Allows users to add unmapped supplier fields as custom fields to the master catalog.
    - **Product Connection Visibility**: Product Details Supplier Info tab displays all data connections feeding each supplier.

## Performance Optimization (1M+ Product Scale)
- **Database Indexes**: GIN trigram for full-text search, B-tree for common lookups, composite indexes.
- **Estimated Counts**: Uses `pg_class.reltuples` for dashboard and unfiltered product list counts.
- **Query Cache**: LRU cache with varying TTLs for different data types.
- **Connection Pool**: Optimized PostgreSQL connection pooling.
- **Bulk Import Pipeline**: Batch upserts, streaming CSV parser, ETA progress tracking.
- **Product Filters**: Server-side filtering with indexed queries, multi-term server-side search with field targeting.
- **Manufacturers API**: Cached API endpoint for distinct manufacturer names.
- **Enhanced Pagination**: Jump-to-page, page size selector, approximate counts, keyboard navigation.

## System Design
- **Architecture**: Module-based for clear separation of concerns.
- **Scalability**: Designed for 1M+ product catalogs across multiple vendors.
- **Data Integrity**: Comprehensive validation, enrichment, and conflict resolution.
- **Deployment**: Replit for development, Replit Autoscale for production.

## Production Deployment Configuration
- **Environment**: Replit Autoscale with Node.js 20.
- **Build Process**: Vite for frontend, esbuild for backend.
- **Database**: Neon PostgreSQL with optimized connection pooling.
- **Performance**: Optimized for 1 million+ products.

# External Dependencies

## APIs and Services
- **Amazon SP-API**: Product catalog search and marketplace intelligence.
- **Ingram Micro Resellers API v6**: Product search, pricing, freight, order creation, tracking.
- **Anthropic AI**: AI-powered data processing.
- **SFTP/FTP Servers**: Secure supplier data connections.
- **Neon**: Serverless PostgreSQL hosting.
- **Walmart API**: For product data, pricing, and marketplace operations.
- **UPCitemdb.com**: Product data enrichment (UPC lookup).

## Key Libraries
- **Database**: `drizzle-orm`, `@neondatabase/serverless`, `pg`.
- **File Processing**: `csv-parse`, `xlsx`, `ssh2-sftp-client`, `adm-zip`.
- **HTTP Clients**: `axios`.
- **UI Components**: Radix UI, Shadcn/ui.
- **Validation**: `zod`.
- **Amazon SDK**: `@sp-api-sdk/auth`, `@sp-api-sdk/catalog-items-api-2022-04-01`.