import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OnboardingManager } from "@/components/onboarding/OnboardingManager";
import { lazy, Suspense } from "react";
import Dashboard from "@/pages/Dashboard";
import SimpleTest from "@/pages/SimpleTest";
import Products from "@/pages/Products";
import ProductsSimple from "@/pages/ProductsSimple";
import SuppliersSimple from "@/pages/SuppliersSimple";
import ProductDetails from "@/pages/ProductDetails";
import DataImports from "@/pages/DataImports";
import DataExports from "@/pages/DataExports";
import Categories from "@/pages/Categories";

import Suppliers from "@/pages/Suppliers";
import SupplierDetails from "@/pages/SupplierDetails";
import ApiConfiguration from "@/pages/ApiConfiguration";
import DataSources from "@/pages/DataSources";
import MappingTemplateEditor from "./pages/MappingTemplateEditor";
import MappingTemplates from "./pages/MappingTemplates";
import SimpleMappingDemo from "./pages/SimpleMappingDemo";
import DescriptionProcessor from "./pages/DescriptionProcessor";
import Connections from "@/pages/Connections";
import Approvals from "@/pages/Approvals";
import ValidationRules from "@/pages/ValidationRules";
import AuditLogs from "@/pages/AuditLogs";
import AmazonIntegration from "@/pages/AmazonIntegration";
import WalmartIntegration from "@/pages/WalmartIntegration";
import AmazonAnalyticsFixed from "@/pages/AmazonAnalyticsFixed";
import MultiASINSearch from "@/pages/MultiASINSearch";
import AmazonAnalytics from "@/pages/AmazonAnalyticsEnhanced";
import AIPurchasing from "@/pages/AIPurchasing";
import ASINDemo from "@/pages/ASINDemo";
import SystemAnalysis from "@/pages/SystemAnalysis";
import BatchProcessing from "@/pages/BatchProcessing";
import SampleDataTest from "@/pages/SampleDataTest";
import AdvancedDeduplication from "@/pages/AdvancedDeduplication";
import GamifiedMapping from "@/pages/GamifiedMapping";
import PurchasingAI from "@/pages/PurchasingAI";
import AISetup from "@/pages/AISetup";
import MarketplaceOverview from "@/pages/MarketplaceOverview";
import MarketplaceAmazon from "@/pages/MarketplaceAmazon";
import MarketplaceWalmart from "@/pages/MarketplaceWalmart";
import MarketplaceComparison from "@/pages/MarketplaceComparison";
import ShippingTemplates from "@/pages/ShippingTemplates";
import InventoryManagement from "@/pages/InventoryManagement";
import FieldMappingDocs from "@/pages/FieldMappingDocs";

// Lazy load AmazonScalingProgress
const AmazonScalingProgress = lazy(() => import('./pages/AmazonScalingProgress'));
import NotFound from "@/pages/not-found";
import TopNavigation from "@/components/TopNavigation";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/products" component={Products} />
      <Route path="/products-simple" component={ProductsSimple} />
      <Route path="/products/:id" component={ProductDetails} />
      <Route path="/categories" component={Categories} />

      <Route path="/suppliers" component={SuppliersSimple} />
      <Route path="/shipping-templates" component={ShippingTemplates} />
      <Route path="/inventory-management" component={InventoryManagement} />
      <Route path="/data-imports" component={DataImports} />
      <Route path="/data-exports" component={DataExports} />
      <Route path="/data-sources" component={DataSources} />
      <Route path="/mapping-templates" component={MappingTemplates} />
      <Route path="/mapping-templates/new" component={MappingTemplateEditor} />
      <Route path="/mapping-templates/:id" component={MappingTemplateEditor} />
      <Route path="/mapping-demo" component={SimpleMappingDemo} />
      <Route path="/description-processor" component={DescriptionProcessor} />
      <Route path="/connections" component={Connections} />
      <Route path="/api-configuration" component={ApiConfiguration} />
      <Route path="/approvals" component={Approvals} />
      <Route path="/validation-rules" component={ValidationRules} />
      <Route path="/audit-logs" component={AuditLogs} />
      <Route path="/ai-purchasing" component={AIPurchasing} />
      <Route path="/asin-demo" component={ASINDemo} />
      <Route path="/batch-processing" component={BatchProcessing} />
      <Route path="/sample-data-test" component={SampleDataTest} />
      <Route path="/advanced-deduplication" component={AdvancedDeduplication} />
      <Route path="/gamified-mapping" component={GamifiedMapping} />
      <Route path="/amazon-analytics" component={AmazonAnalyticsFixed} />

      <Route path="/system-analysis" component={SystemAnalysis} />
      <Route path="/purchasing-ai" component={PurchasingAI} />
      <Route path="/ai-setup" component={AISetup} />
      
      {/* Marketplaces */}
      <Route path="/marketplaces/overview" component={MarketplaceOverview} />
      <Route path="/marketplace-overview" component={MarketplaceOverview} />
      
      {/* Amazon Marketplace Routes */}
      <Route path="/marketplaces/amazon" component={MarketplaceAmazon} />
      <Route path="/marketplace-amazon" component={MarketplaceAmazon} />
      <Route path="/marketplaces/amazon/integration" component={AmazonIntegration} />
      <Route path="/marketplaces/amazon/multi-asin" component={MultiASINSearch} />
      
      {/* Purchasing AI Analysis Progress */}
      <Route path="/purchasing-ai/analysis-progress" component={() => (
        <Suspense fallback={<div className="container mx-auto py-8"><div className="flex items-center justify-center space-x-2 py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div><span>Loading Analysis Progress...</span></div></div>}>
          <AmazonScalingProgress />
        </Suspense>
      )} />
      
      {/* Legacy route redirects for backwards compatibility */}
      <Route path="/amazon-integration" component={AmazonIntegration} />
      <Route path="/multi-asin" component={MultiASINSearch} />
      <Route path="/amazon-scaling-progress" component={() => (
        <Suspense fallback={<div className="container mx-auto py-8"><div className="flex items-center justify-center space-x-2 py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div><span>Loading Analysis Progress...</span></div></div>}>
          <AmazonScalingProgress />
        </Suspense>
      )} />
      <Route path="/marketplaces/amazon/sync-progress" component={() => (
        <Suspense fallback={<div className="container mx-auto py-8"><div className="flex items-center justify-center space-x-2 py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div><span>Loading Analysis Progress...</span></div></div>}>
          <AmazonScalingProgress />
        </Suspense>
      )} />
      
      {/* Walmart Marketplace Routes */}
      <Route path="/marketplaces/walmart" component={MarketplaceWalmart} />
      <Route path="/marketplaces/walmart/integration" component={WalmartIntegration} />
      
      {/* Legacy route for Walmart integration */}
      <Route path="/walmart-integration" component={WalmartIntegration} />
      
      {/* Cross-Marketplace Comparison */}
      <Route path="/marketplaces/comparison" component={MarketplaceComparison} />
      <Route path="/marketplace-comparison" component={MarketplaceComparison} />
      <Route path="/marketplaces/walmart/product-sync" component={() => (
        <div className="container mx-auto p-6">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold">Walmart Product Sync</h1>
            <p className="text-muted-foreground">Sync your products to Walmart Marketplace.</p>
            <p className="text-sm text-muted-foreground">This feature is coming soon...</p>
          </div>
        </div>
      )} />
      <Route path="/marketplaces/walmart/analytics" component={() => (
        <div className="container mx-auto p-6">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold">Walmart Analytics</h1>
            <p className="text-muted-foreground">View performance metrics and insights for your Walmart listings.</p>
            <p className="text-sm text-muted-foreground">This feature is coming soon...</p>
          </div>
        </div>
      )} />
      
      {/* eBay Marketplace Routes */}
      <Route path="/marketplaces/ebay" component={() => (
        <div className="container mx-auto p-6">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold">eBay Marketplace</h1>
            <p className="text-muted-foreground">Manage your eBay marketplace integration.</p>
            <p className="text-sm text-muted-foreground">This feature is coming soon...</p>
          </div>
        </div>
      )} />
      <Route path="/marketplaces/ebay/integration" component={() => (
        <div className="container mx-auto p-6">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold">eBay Integration</h1>
            <p className="text-muted-foreground">Configure your eBay API credentials and settings.</p>
            <p className="text-sm text-muted-foreground">This feature is coming soon...</p>
          </div>
        </div>
      )} />
      <Route path="/marketplaces/ebay/product-sync" component={() => (
        <div className="container mx-auto p-6">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold">eBay Product Sync</h1>
            <p className="text-muted-foreground">Sync your products to eBay.</p>
            <p className="text-sm text-muted-foreground">This feature is coming soon...</p>
          </div>
        </div>
      )} />
      <Route path="/marketplaces/ebay/analytics" component={() => (
        <div className="container mx-auto p-6">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold">eBay Analytics</h1>
            <p className="text-muted-foreground">View performance metrics and insights for your eBay listings.</p>
            <p className="text-sm text-muted-foreground">This feature is coming soon...</p>
          </div>
        </div>
      )} />
      
      {/* Newegg Marketplace Routes */}
      <Route path="/marketplaces/newegg" component={() => (
        <div className="container mx-auto p-6">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold">Newegg Marketplace</h1>
            <p className="text-muted-foreground">Manage your Newegg marketplace integration.</p>
            <p className="text-sm text-muted-foreground">This feature is coming soon...</p>
          </div>
        </div>
      )} />
      <Route path="/marketplaces/newegg/integration" component={() => (
        <div className="container mx-auto p-6">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold">Newegg Integration</h1>
            <p className="text-muted-foreground">Configure your Newegg API credentials and settings.</p>
            <p className="text-sm text-muted-foreground">This feature is coming soon...</p>
          </div>
        </div>
      )} />
      <Route path="/marketplaces/newegg/product-sync" component={() => (
        <div className="container mx-auto p-6">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold">Newegg Product Sync</h1>
            <p className="text-muted-foreground">Sync your products to Newegg.</p>
            <p className="text-sm text-muted-foreground">This feature is coming soon...</p>
          </div>
        </div>
      )} />
      <Route path="/marketplaces/newegg/analytics" component={() => (
        <div className="container mx-auto p-6">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold">Newegg Analytics</h1>
            <p className="text-muted-foreground">View performance metrics and insights for your Newegg listings.</p>
            <p className="text-sm text-muted-foreground">This feature is coming soon...</p>
          </div>
        </div>
      )} />
      
      {/* Fallback for other marketplaces */}
      <Route path="/marketplaces/:marketplace" component={() => <div className="container mx-auto p-6"><div className="text-center"><h1 className="text-2xl font-bold mb-4">Marketplace Integration</h1><p className="text-muted-foreground">This marketplace integration is coming soon...</p></div></div>} />
      <Route path="/field-mapping-docs" component={FieldMappingDocs} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <OnboardingManager>
          <Toaster />
          <div className="min-h-screen bg-background">
            <TopNavigation />
            <main className="container mx-auto px-4 py-6">
              <Router />
            </main>
          </div>
        </OnboardingManager>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
