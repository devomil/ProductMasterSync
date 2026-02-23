# Overview

**MultiChannelOS** (Multi-Channel Operating System) is a multi-channel business operating system providing key insights, operational transparency, AI-driven decision-making, and marketplace integrations. Previously known as MDM/PIM, the platform manages extensive product catalogs across multiple marketplaces (Amazon, Walmart, eBay, Newegg), supplier relationships, and provides business intelligence dashboards with real-time revenue tracking.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX
- **Frontend Framework**: React with TypeScript.
- **UI Library**: Shadcn/ui components built on Radix UI.
- **Styling**: Tailwind CSS with emerald/teal accent theme.
- **State Management**: TanStack Query for server state.
- **Navigation Structure**: Collapsible sidebar navigation (AppSidebar component) with grouped sections: Dashboard, Catalog, Supply Chain, Marketplaces, Data Management, AI & Analytics, System. Replaced previous top navigation tabs.
- **Dashboard**: Monthly Business Intelligence dashboard with hero KPI cards (Month-to-Date Performance, Today's Revenue, Projected Month-End), quick stat cards, COGS analysis section, and detailed P&L panel. Revenue data sourced from database (marketplace_orders table) covering all channels (Amazon + Walmart).
- **Design Principles**: Responsive design, professional styling, sidebar-first layout, cutting-edge BI dashboard patterns, F-pattern information hierarchy, and production-ready gradients/theming.

## Technical Implementations
- **Backend API**: Node.js with Express and TypeScript (primary); FastAPI (Python) for supplier management and data connectors (secondary).
- **Database ORM**: Drizzle ORM.
- **Database**: PostgreSQL 16 (Neon serverless).
- **Key Features**:
    - **Supplier Management**: Onboarding, data source configuration, and status tracking.
    - **Data Ingestion Engine**: Handles various formats (CSV, Excel, JSON, XML, EDI) via SFTP, FTP, API, direct DB.
    - **Product Catalog Management**: Comprehensive product schema, hierarchical categories, inventory tracking.
    - **Amazon Marketplace Integration**: ASIN discovery via SP-API, pricing intelligence, market opportunity analysis, UPC to ASIN mapping, including bulk processing with dynamic rate limiting and automated scheduling for sync jobs. Features credential management and rate-limited market data fetching (buy box, fees, restrictions) with retry logic.
    - **Walmart Marketplace Integration**: UPC-based product matching, taxonomy mapping, and Pricing Insights API integration. Features Buy Box pricing, competitor prices, price competitiveness scores (0-100), demand indicators, traffic levels, and GMV (30-day) data. Supports cursor-based pagination for full catalog sync with rate limiting.
    - **Active Listings Management**: Sync and track existing marketplace listings (~182k Walmart listings). Features include bulk sync from Walmart API v3/items endpoint, paginated listing views with filters (marketplace, status), sync job tracking with progress monitoring, and stats dashboard showing total/active/zero-quantity/matched listings. Database schema: `marketplace_listings` (core table) + `walmart_listing_details` + `walmart_listing_sync_jobs`.
    - **Referral Fee Calculation**: Advanced tiered and portion-based fee structures based on Walmart's official contract categories. Product type-first mapping with 100+ product types mapped to contract categories (Electronics Accessories, Personal Computers, Automotive & Powersports, etc.). Features include:
      - Tiered rates: 15% up to $100, 8% above for Electronics Accessories
      - Flat rates: 6% for Personal Computers, 12% for Automotive, 8% for Consumer Electronics
      - Portion-based rates: Watches (15% up to $1,500, 3% above)
      - Case-insensitive product type matching with normalization
      - Batch recalculation endpoint: POST /api/marketplace/walmart/listings/recalculate-fees
    - **Pricing Insights Integration**: Walmart /v3/price/getPricingInsights API integration for competitive analysis. Database fields: buyBoxBasePriceInCents, buyBoxTotalPriceInCents, competitorPriceInCents, priceCompetitive, priceCompetitiveScore, inDemand, trafficLevel, gmv30InCents, pricingInsightsFetchedAt.
    - **Inventory Management**: Automated data pull jobs, scheduling, and monitoring.
    - **Shipping Template System**: Supplier-specific, cost and weight-based shipping calculations.
    - **Field Mapping System**: Two-tier mapping with interactive walkthroughs and auto-mapping.
    - **AI-Powered Category Mapping**: Automated category mapping using Claude AI with an approval workflow.
    - **Purchasing AI**: Multi-select fulfillment preferences, bulk analysis triggering with progress monitoring, and production-ready rate limiting with deduplication.
    - **24/7 Automated Analysis System**: Infrastructure for continuous purchasing opportunity analysis with a job scheduler, database schema for tracking jobs and runs, business logic for comprehensive product analysis, and a monitoring UI.
    - **Automated Order Sync**: Scheduler (server/marketplace/order-sync-scheduler.ts) that syncs Amazon + Walmart orders every 4 hours. Runs initial sync on server start. Amazon sync uses SP-API with NextToken pagination. Walmart sync delegates to existing syncWalmartOrders(). Both store orders in marketplace_orders table. Dashboard and orders page both query from database for accurate multi-channel reporting.
    - **Flxpoint Integration**: Bridge for pushing product listings to Amazon, Walmart, eBay until native listing module is complete. Features include:
      - Rate-limited API client (2 req/sec, 40-request pool with Leaky Bucket algorithm)
      - Pull variants from Flxpoint catalog
      - Push commission data to Flxpoint (stored as 1 + rate/100, e.g., 6% = 1.06)
      - Enrich variants with marketplace data (Buy Box prices, product types)
      - Sync tracking with job history and progress monitoring
      - Database tables: `flxpoint_variants`, `flxpoint_sync_runs`
      - UI page at /marketplaces/flxpoint
    - **Performance Optimization**: Intelligent caching and optimized queries.

## System Design
- **Module-based Architecture**: Clear separation of concerns.
- **Scalability**: Designed for large product catalogs and numerous suppliers.
- **Data Integrity**: Comprehensive validation, enrichment, and conflict resolution.
- **Deployment**: Replit for development, Replit Autoscale for production.

## Production Deployment Configuration
- **Environment**: Replit Autoscale with Node.js 20.
- **Build Process**: Vite for frontend, esbuild for backend.
- **Database**: Neon PostgreSQL with optimized connection pooling.
- **Performance**: Optimized for 1 million+ products.

# External Dependencies

## APIs and Services
- **Amazon SP-API**: Product catalog search and marketplace intelligence (OAuth2, Product Pricing API v0, Catalog Items API, Listings Restrictions API).
- **Anthropic AI**: AI-powered data processing.
- **SFTP/FTP Servers**: Supplier data connections.
- **Neon**: Serverless PostgreSQL hosting.

## Key Libraries
- **Database**: `drizzle-orm`, `@neondatabase/serverless`, `pg`.
- **File Processing**: `csv-parse`, `xlsx`, `ssh2-sftp-client`.
- **HTTP Clients**: `axios`.
- **UI Components**: Radix UI, Shadcn/ui.
- **Validation**: `zod`.
- **Amazon SDK**: `@sp-api-sdk/auth`, `@sp-api-sdk/catalog-items-api-2022-04-01`.