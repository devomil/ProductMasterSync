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
- **Navigation Structure**: Marketplace-organized navigation with nested dropdown submenus for scalability. Each marketplace (Amazon, Walmart, eBay, Newegg) has a consistent submenu structure with:
  - **Overview**: Main marketplace dashboard
  - **Integration**: API credentials and configuration
  - **Product Sync/Multi-ASIN Search**: Product synchronization tools
  - **Analytics/Sync Progress**: Performance metrics and monitoring
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

## Deployment Best Practices

### Route Module Imports
**CRITICAL: Always use static imports for route modules.** Dynamic imports work in development (TypeScript/tsx) but fail in production because esbuild bundles everything into a single `dist/index.js` file.

✅ **CORRECT - Static Imports:**
```typescript
import marketplaceRoutes from "./marketplace/routes";
import purchasingRoutes from "./purchasing/routes";

app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/purchasing", purchasingRoutes);
```

❌ **AVOID - Dynamic Imports:**
```typescript
const module = await import("./marketplace/routes");
app.use("/api/marketplace", module.default);
```

**Why:** In production, the build process bundles all TypeScript files into one JavaScript file. Dynamic imports try to load separate files that don't exist in the bundled output, causing 404 errors and returning HTML instead of JSON.

### Testing Production Builds
Before deploying to production, test the production build locally:

```bash
npm run build        # Build production bundle (creates dist/ directory)
npm run start        # Test production build locally
```

If it works with `npm run start`, it should work in production deployment.

### Database Migration Workflow

**Development to Production:**
1. **Development**: Make schema changes in `shared/schema.ts`
2. **Development**: Run `npm run db:push` (or `npm run db:push --force` if data-loss warnings)
3. **Development**: Test thoroughly with development database
4. **Production**: Deploy code to production (includes schema changes)
5. **Production**: Use Replit Database pane → Switch to "Production" → Push schema changes
   - Alternative: Let Drizzle auto-create tables on first use (safe for new tables)

**Important:** Development and production use separate databases:
- **Development DB**: `ep-round-bread-a6qf8xb1.us-west-2.aws.neon.tech` (US West)
- **Production DB**: `ep-dawn-bread-ady0zk97.c-2.us-east-1.aws.neon.tech` (US East)

### Preview Deployments
Always test major changes with preview deployments first:
1. Click **"Create preview deploy"** instead of "Approve and publish"
2. Test all functionality in preview environment
3. Verify API endpoints, database connections, and route loading
4. Once confirmed → Click "Approve and publish" for production

This prevents downtime and catches issues before affecting live users.

### Lessons Learned
- **October 2025**: Fixed production deployment issue where marketplace routes failed to load due to dynamic imports being incompatible with esbuild's bundling process. Solution: Converted all route module imports to static imports in `server/routes.ts`.
- **Route Loading**: The `loadRouteModule()` helper function was removed because production builds don't support dynamic file-based module loading.

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