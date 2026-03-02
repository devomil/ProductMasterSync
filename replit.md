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
    - **Walmart Price Incentives**: Integration with Walmart /v3/price/incentives API to fetch and cache Walmart-funded incentive items for financial breakdown in order fulfillment.
    - **Inventory Management**: Automated data pull jobs, scheduling, and monitoring.
    - **Shipping Template System**: Supplier-specific, cost and weight-based shipping calculations.
    - **Field Mapping System**: Two-tier mapping with interactive walkthroughs and auto-mapping capabilities.
    - **AI-Powered Category Mapping**: Automated category mapping using Claude AI with an approval workflow.
    - **Purchasing AI**: Multi-select fulfillment preferences, bulk analysis for 1M+ product catalogs, with rate limiting and deduplication.
    - **Research Opportunities**: Upload CSV/Excel product lists for marketplace selling opportunity discovery, using multi-strategy Amazon ASIN matching (UPC, MPN/SKU, description/brand keywords) with confidence scores and opportunity/restriction highlighting.
    - **24/7 Automated Analysis System**: Infrastructure for continuous purchasing opportunity analysis with job scheduling and monitoring UI.
    - **Automated Order Sync**: Scheduled order synchronization (Amazon SP-API, Walmart API) every 4 hours, storing data in a `marketplace_orders` table for multi-channel reporting.
    - **Order Fulfillment Modal**: UI for order fulfillment, displaying order summary, financial breakdown (including referral fees and estimated payout), multi-vendor allocation comparison (e.g., Ingram Micro via API for real-time cost, availability, shipping), and dynamic margin recalculation. Saves vendor cost data upon fulfillment.
    - **Ingram Micro Async Order Management**: PO confirmation, creation via Ingram Micro API, tracking of PO number, vendor order status, and tracking information. Includes live status checking and graceful degradation for API failures.
    - **COGS Dashboard Integration**: Real-time COGS analysis (referral fees + vendor costs) and Gross Profit calculation, integrated into the main dashboard and orders page.
    - **Referral Fee SKU Matching**: 3-tier strategy (exact, prefix, fuzzy variant) for matching order item SKUs to product types.
    - **Flxpoint Integration**: API client for pushing product listings to marketplaces, pulling variants, pushing commission data, and enriching variants with marketplace data, including job history and progress monitoring.
    - **Dynamic Catalog Extension**: Allows users to add unmapped supplier fields to the master catalog as custom fields, which are then rendered on product detail tabs with attribution.
    - **Product Connection Visibility**: Product Details Supplier Info tab displays all data connections feeding each supplier, including type, purpose, automation status, and active state.
    - **Performance Optimization**: Intelligent caching and optimized queries.

## System Design
- **Architecture**: Module-based for clear separation of concerns.
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