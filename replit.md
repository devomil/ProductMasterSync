# Overview

MultiChannelOS is a multi-channel business operating system designed to provide key insights, operational transparency, and AI-driven decision-making for businesses managing extensive product catalogs across various online marketplaces (Amazon, Walmart, eBay, Newegg). It centralizes product information, manages supplier relationships, and offers business intelligence dashboards with real-time revenue tracking to enhance marketplace performance and market share. The platform aims to streamline complex e-commerce operations, from product data ingestion to order fulfillment, using advanced automation and AI.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX
- **Frontend Framework**: React with TypeScript.
- **UI Library**: Shadcn/ui components built on Radix UI.
- **Styling**: Tailwind CSS with an emerald/teal accent theme.
- **State Management**: TanStack Query for server state.
- **Navigation**: Collapsible sidebar navigation with grouped sections (Dashboard, Catalog, Supply Chain, Marketplaces, Data Management, AI & Analytics, System).
- **Dashboard**: Monthly Business Intelligence dashboard featuring hero KPI cards (Month-to-Date Performance, Today's Revenue, Projected Month-End), quick stats, COGS analysis, and detailed P&L.
- **Design Principles**: Responsive design, professional styling, sidebar-first layout, cutting-edge BI patterns, F-pattern information hierarchy, and production-ready theming.

## Technical Implementations
- **Backend API**: Primarily Node.js with Express and TypeScript; secondary FastAPI (Python) for supplier management and data connectors.
- **Database ORM**: Drizzle ORM.
- **Database**: PostgreSQL 16 (Neon serverless).
- **Core Features**:
    - **Supplier Management**: Onboarding, data source configuration, and status tracking.
    - **Data Ingestion Engine**: Supports various formats (CSV, Excel, JSON, XML, EDI, ZIP) via SFTP, FTP, API, or direct DB connections. ZIP files are automatically extracted.
    - **Product Catalog Management**: Comprehensive product schema, hierarchical categories, and inventory tracking.
    - **Marketplace Integrations**:
        - **Amazon**: ASIN discovery via SP-API, pricing intelligence, market opportunity analysis, UPC to ASIN mapping with bulk processing, dynamic rate limiting, and automated sync job scheduling.
        - **Walmart**: UPC-based product matching, taxonomy mapping, and Pricing Insights API integration (Buy Box, competitor prices, demand indicators, traffic levels, GMV). Supports cursor-based pagination for catalog sync.
    - **Active Listings Management**: Sync and track existing marketplace listings (e.g., Walmart), with bulk sync, paginated views, filtering, and sync job monitoring.
    - **Referral Fee Calculation**: Advanced tiered and portion-based fee structures based on Walmart's official contract categories, with product type-first mapping and batch recalculation.
    - **Walmart Price Incentives**: Integration with Walmart /v3/price/incentives API to fetch and cache Walmart-funded incentive items for financial breakdown in order fulfillment and dashboard revenue (seller price - customer price = Walmart-funded amount, added to total revenue with P&L line item).
    - **Inventory Management**: Automated data pull jobs, scheduling, and monitoring.
    - **Shipping Template System**: Supplier-specific, cost and weight-based shipping calculations.
    - **Field Mapping System**: Purpose-driven mapping templates with interactive walkthroughs and AI auto-mapping. Mapping workflow adapts based on data source purpose: Catalog Import shows all 60+ fields, Inventory & Pricing shows only ~13 fields (identifier + pricing + inventory), Order Fulfillment shows 5 fields, Catalog Search skips mapping entirely. Purpose stored on `mapping_templates` table and used by automation scheduler to determine update strategy. Mapping template lookup is supplier-aware: prefers templates matching both `sourceType` AND `supplierId`, falling back to type-only. Startup seeder ensures each supplier has its own SFTP mapping template.
    - **AI-Powered Category Mapping**: Automated category mapping using Claude AI with an approval workflow.
    - **Purchasing AI**: Multi-select fulfillment preferences, bulk analysis for 1M+ product catalogs, with rate limiting and deduplication.
    - **Research Opportunities**: Upload CSV/Excel product lists for marketplace selling opportunity discovery, using multi-strategy Amazon ASIN matching (UPC, MPN/SKU, description/brand keywords) with confidence scores and opportunity/restriction highlighting.
    - **24/7 Automated Analysis System**: Infrastructure for continuous purchasing opportunity analysis with job scheduling and monitoring UI.
    - **Automated Order Sync**: Scheduled order synchronization (Amazon SP-API, Walmart API) every 4 hours, storing data in a `marketplace_orders` table for multi-channel reporting.
    - **Order Fulfillment Modal**: UI for order fulfillment with multi-step progress indicator (Select Vendors → Review & Confirm → Submitting → Complete), visual financial breakdown cards (Revenue/Fees/Payout/COGS/Profit sections with colored borders), multi-vendor allocation comparison (e.g., Ingram Micro via API for real-time cost, availability, shipping), dynamic margin recalculation, and prominent net proceeds display.
    - **Ingram Micro Async Order Management**: PO confirmation with address validation indicators, creation via Ingram Micro API with animated phased progress ("Connecting..." → "Submitting..." → "Verifying..."), tracking of PO number, vendor order status, and tracking information. Includes live status checking from orders table and details view, tracking refresh, retry on failure, and graceful degradation for API failures.
    - **Data Source Purpose**: Each data source has a designated purpose (Catalog, Inventory & Pricing, Order Fulfillment, Catalog Search, Returns, General) with auto-suggestion based on connection type, editable after creation, and color-coded badges in the list view.
    - **COGS Dashboard Integration**: Real-time COGS analysis (referral fees + vendor costs) and Gross Profit calculation, integrated into the main dashboard and orders page.
    - **Referral Fee SKU Matching**: 3-tier strategy (exact, prefix, fuzzy variant) for matching order item SKUs to product types.
    - **Flxpoint Integration**: API client for pushing product listings to marketplaces, pulling variants, pushing commission data, and enriching variants with marketplace data, including job history and progress monitoring.
    - **Dynamic Catalog Extension**: Allows users to add unmapped supplier fields to the master catalog as custom fields, which are then rendered on product detail tabs with attribution.
    - **Product Connection Visibility**: Product Details Supplier Info tab displays all data connections feeding each supplier, including type, purpose, automation status, and active state.
    - **Performance Optimization**: Intelligent caching and optimized queries, 1M+ product scale support.

## Performance Optimization (1M+ Product Scale)
- **Database Indexes**: GIN trigram on `products.name` for fast ILIKE, B-tree on `manufacturer_name`, `upc`; composite `(product_id, supplier_id)` and `supplier_id` indexes on `product_suppliers` table.
- **Estimated Counts**: Dashboard and unfiltered product list use `pg_class.reltuples` for constant-time total count instead of `COUNT(*)`. Exact counts only used with active filters.
- **Query Cache**: LRU cache with hit/miss tracking, 60s TTL for unfiltered products, 15s for filtered, 5min for dashboard stats.
- **Connection Pool**: Max 20 connections, 30s statement timeout, slow query logging (>5s).
- **Bulk Import Pipeline**: 500-record batch upserts via raw SQL `INSERT ... ON CONFLICT`, streaming CSV parser for files >50MB, ETA progress tracking.
- **Product Filters**: Server-side supplier and manufacturer filtering with indexed queries, supplier/manufacturer dropdown filters in UI.
- **Multi-Term Server-Side Search**: `/api/products/search` endpoint with multi-term AND matching (e.g., "HP thin client i5" splits into 4 terms, each matched via ILIKE across name/sku/mpn/upc/description/manufacturer). Supports searchType targeting specific fields (sku, upc, title, mfgPart, description, manufacturer, or all). Combined with server-side filters for category, supplier, manufacturer, status, price range (min/max), boolean flags (isRemanufactured, isCloseout, isOnSale, hasRebate, hasFreeShipping), inventory status (inStock/lowStock/outOfStock), sorting, and pagination. Uses 15s query cache, estimated counts for unfiltered queries. Frontend uses debounced search (300ms) via `useProductSearch` hook.
- **Manufacturers API**: `/api/products/manufacturers` endpoint returns distinct manufacturer names from catalog with 60s cache.
- **Enhanced Pagination**: Jump-to-page input, page size selector (25/50/100/250), approximate counts for >10K products, keyboard navigation.

## System Design
- **Architecture**: Module-based for clear separation of concerns.
- **Scalability**: Designed for 1M+ product catalogs across 4+ vendors (200K-800K products each).
- **Data Integrity**: Comprehensive validation, enrichment, and conflict resolution.
- **Deployment**: Replit for development, Replit Autoscale for production.

## Production Deployment Configuration
- **Environment**: Replit Autoscale with Node.js 20.
- **Build Process**: Vite for frontend, esbuild for backend.
- **Database**: Neon PostgreSQL with optimized connection pooling.
- **Performance**: Optimized for 1 million+ products.

# External Dependencies

## APIs and Services
- **Amazon SP-API**: For product catalog search and marketplace intelligence.
- **Ingram Micro Resellers API v6**: For product search, price & availability, freight estimates, order creation, tracking, and invoice management.
- **Anthropic AI**: For AI-powered data processing.
- **SFTP/FTP Servers**: For secure supplier data connections.
- **Neon**: Serverless PostgreSQL hosting.

## Key Libraries
- **Database**: `drizzle-orm`, `@neondatabase/serverless`, `pg`.
- **File Processing**: `csv-parse`, `xlsx`, `ssh2-sftp-client`, `adm-zip`.
- **HTTP Clients**: `axios`.
- **UI Components**: Radix UI, Shadcn/ui.
- **Validation**: `zod`.
- **Amazon SDK**: `@sp-api-sdk/auth`, `@sp-api-sdk/catalog-items-api-2022-04-01`.

## Database Schema Notes
- **Enum alignment**: All `pgEnum` definitions in `shared/schema.ts` must exactly match the production database enum values to prevent destructive migrations. Enum values that differ between schema and production will cause Drizzle to generate DROP/CREATE statements that destroy data.
- **Column type alignment**: All column type definitions must match production exactly:
  - Use `jsonb()` (not `json()`) for all JSON columns — production uses `jsonb` throughout.
  - Use `text()` for columns where production has `text` or `varchar`, even if logically they hold enum-like values. Only use `pgEnum()` references if production actually has that enum type on the column.
  - When adding new columns to existing production tables, use `text()` for maximum safety.
- **Safe column types**: For columns that don't have a matching production enum, use `text()` instead of `pgEnum()`. This generates safe `ALTER TABLE ADD COLUMN` statements.
- **Data source purpose**: Uses `text("purpose")` (not enum) with app-level validation via `dataSourcePurposeValues` constant.
- **Tables in production but not schema**: ~27 legacy tables exist in production that aren't defined in `shared/schema.ts`. Drizzle ignores these during migrations.
- **Tables in schema but not production**: ~21 tables will be created as new tables during deployment (safe additive operation).