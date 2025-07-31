# Overview

This MDM/PIM (Master Data Management/Product Information Management) platform streamlines supplier relationship management, product catalog maintenance, and marketplace integrations. It ingests product data from diverse supplier sources (SFTP, FTP, API) and synchronizes it with marketplaces like Amazon, facilitating efficient data flow and market expansion. The platform aims to provide advanced features for pricing intelligence, AI-powered purchasing recommendations, and automated inventory synchronization to optimize operations and drive market potential.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
- **Framework**: React with TypeScript
- **UI Library**: Shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query
- **Build Tool**: Vite

## Backend
- **Primary API**: Node.js with Express and TypeScript
- **Secondary API**: FastAPI (Python) for supplier management and data connectors
- **Runtime**: Node.js 20 (ES modules)
- **Database ORM**: Drizzle ORM

## Database
- **Primary Database**: PostgreSQL 16 (Neon serverless with connection pooling)
- **Migration Tool**: Drizzle Kit

## Core Features & Design Decisions
- **Supplier Management**: Manages onboarding, data source configuration (SFTP, FTP, API, EDI), and connection testing with status tracking.
- **Data Ingestion**: Supports CSV, Excel, JSON, XML, EDI formats from various connection types.
- **Product Catalog Management**: Comprehensive schema including products, categories, suppliers, warehouses, and image management. Unique sequential EDC SKUs are generated, independent of supplier part numbers, which are stored as USINs.
- **Amazon Marketplace Integration**: Synchronizes product data, performs ASIN discovery via SP-API, offers pricing intelligence, and market opportunity analysis. Includes a robust bulk processing system with dynamic rate limiting and real-time progress tracking.
- **Warehouse Detail Modal System**: Displays comprehensive supplier-specific data across six tabs (Inventory, Pricing, Shipping, Compliance, Promotions, Documentation) with real-time field calculations and URL health validation.
- **Auto-Sync Status Persistence**: Manages persistent auto-sync status across sessions using `localStorage` for real-time tracking of job states (READY, ACTIVE, COMPLETE).
- **Data Validation and Quality**: Configurable validation rules, data enrichment, and conflict resolution strategies.
- **Automation Scheduling**: Comprehensive system for managing catalog and inventory data pulls with per-file path scheduling, dependency management, configurable frequencies, and error handling. Supports multiple file types (catalog, inventory, pricing, images, specifications).
- **Shipping Templates**: System for creating supplier-specific shipping templates with detailed cost and weight-based rule configurations, including oversized and hazmat surcharges.
- **Categories Management**: Hierarchical display with product counts and automatic category creation during data ingestion.
- **Performance Optimization**: Implemented caching, optimized queries, and bulk operations for sub-second API response times.
- **UI/UX**: Focus on clear navigation, detailed table views (compact, comfortable, spacious), quick filter chips, and intuitive dialogs for configuration and management.

# External Dependencies

## APIs and Services
- **Amazon SP-API**: For product catalog search, pricing data, and marketplace intelligence.
- **Anthropic AI**: For AI-powered data processing and enhancement.
- **SFTP/FTP Servers**: For supplier data source connections.

## Key Libraries
- **Database**: `drizzle-orm`, `@neondatabase/serverless`, `pg`, `psycopg2`
- **File Processing**: `csv-parse`, `xlsx`, `ssh2-sftp-client`
- **HTTP Clients**: `axios`, `requests` (Python)
- **UI Components**: Radix UI, Shadcn/ui
- **Validation**: `zod` (TypeScript), `pydantic` (Python)