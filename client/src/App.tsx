import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OnboardingManager } from "@/components/onboarding/OnboardingManager";
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
import MappingTemplates from "./pages/MappingTemplates";
import MappingTemplateEditor from "./pages/MappingTemplateEditor";
import MappingTemplateWorkspace from "./pages/MappingTemplateWorkspace";
import SimpleMappingDemo from "./pages/SimpleMappingDemo";
import DescriptionProcessor from "./pages/DescriptionProcessor";
import Connections from "@/pages/Connections";
import Approvals from "@/pages/Approvals";
import ValidationRules from "@/pages/ValidationRules";
import AuditLogs from "@/pages/AuditLogs";
import AmazonIntegration from "@/pages/AmazonIntegration";
import AmazonAnalyticsFixed from "@/pages/AmazonAnalyticsFixed";
import MultiASINSearch from "@/pages/MultiASINSearch";
import AmazonAnalytics from "@/pages/AmazonAnalyticsEnhanced";
import AIPurchasing from "@/pages/AIPurchasing";
import ASINDemo from "@/pages/ASINDemo";
import SystemMonitoring from "@/pages/SystemMonitoring";
import SystemAnalysis from "@/pages/SystemAnalysis";
import BatchProcessing from "@/pages/BatchProcessing";
import SampleDataTest from "@/pages/SampleDataTest";
import AdvancedDeduplication from "@/pages/AdvancedDeduplication";
import GamifiedMapping from "@/pages/GamifiedMapping";
import PurchasingAI from "@/pages/PurchasingAI";
import MarketplaceOverview from "@/pages/MarketplaceOverview";
import MarketplaceAmazon from "@/pages/MarketplaceAmazon";
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
      <Route path="/suppliers-advanced" component={Suppliers} />
      <Route path="/data-imports" component={DataImports} />
      <Route path="/data-exports" component={DataExports} />
      <Route path="/data-sources" component={DataSources} />
      <Route path="/mapping-templates" component={MappingTemplates} />
      <Route path="/mapping-workspace" component={MappingTemplateWorkspace} />
      <Route path="/mapping-editor" component={MappingTemplateEditor} />
      <Route path="/mapping-templates/new" component={MappingTemplateWorkspace} />
      <Route path="/mapping-templates/:id" component={MappingTemplateWorkspace} />
      <Route path="/mapping-template-workspace" component={MappingTemplateWorkspace} />
      <Route path="/mapping-demo" component={SimpleMappingDemo} />
      <Route path="/description-processor" component={DescriptionProcessor} />
      <Route path="/connections" component={Connections} />
      <Route path="/api-configuration" component={ApiConfiguration} />
      <Route path="/approvals" component={Approvals} />
      <Route path="/validation-rules" component={ValidationRules} />
      <Route path="/audit-logs" component={AuditLogs} />
      <Route path="/amazon-integration" component={AmazonIntegration} />
      <Route path="/amazon-analytics" component={AmazonAnalyticsFixed} />
      <Route path="/multi-asin" component={MultiASINSearch} />
      <Route path="/ai-purchasing" component={AIPurchasing} />
      <Route path="/asin-demo" component={ASINDemo} />
      <Route path="/batch-processing" component={BatchProcessing} />
      <Route path="/sample-data-test" component={SampleDataTest} />
      <Route path="/advanced-deduplication" component={AdvancedDeduplication} />
      <Route path="/gamified-mapping" component={GamifiedMapping} />
      <Route path="/system-monitoring" component={SystemMonitoring} />
      <Route path="/system-analysis" component={SystemAnalysis} />
      <Route path="/purchasing-ai" component={PurchasingAI} />
      <Route path="/marketplaces/overview" component={MarketplaceOverview} />
      <Route path="/marketplaces/amazon" component={MarketplaceAmazon} />
      <Route path="/marketplaces/:marketplace" component={() => <div className="container mx-auto p-6"><div className="text-center"><h1 className="text-2xl font-bold mb-4">Marketplace Integration</h1><p className="text-muted-foreground">This marketplace integration is coming soon...</p></div></div>} />
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
