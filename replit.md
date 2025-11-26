# Overview

This project is an MDM/PIM (Master Data Management/Product Information Management) platform designed to streamline supplier interactions, manage extensive product catalogs, and facilitate marketplace integrations. Its core purpose is to ingest product data from various suppliers and synchronize this information with major marketplaces like Amazon. The platform aims to enhance data quality, automate workflows, and provide market intelligence for improved purchasing decisions and expanded market reach.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX
- **Frontend Framework**: React with TypeScript.
- **UI Library**: Shadcn/ui components built on Radix UI.
- **Styling**: Tailwind CSS.
- **State Management**: TanStack Query for server state.
- **Navigation Structure**: Marketplace-organized navigation with nested dropdown submenus for Amazon, Walmart, eBay, Newegg, and Purchasing AI.
- **Design Principles**: Responsive design, professional styling, intuitive navigation, and dynamic content presentation with features like optimized table layouts, multi-select fulfillment preferences, and interactive documentation.

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