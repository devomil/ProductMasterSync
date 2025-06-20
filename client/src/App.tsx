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
import NotFound from "@/pages/not-found";

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
            <header className="border-b bg-white shadow-sm">
              <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">MDM/PIM System</h1>
                <nav className="flex space-x-6">
                  <a href="/" className="text-gray-600 hover:text-gray-900">Dashboard</a>
                  <div className="relative group">
                    <button className="text-gray-600 hover:text-gray-900 flex items-center">
                      Products <span className="ml-1">▼</span>
                    </button>
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white border shadow-lg rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                      <a href="/products" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Product Catalog</a>
                      <a href="/categories" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Categories</a>
                      <a href="/advanced-deduplication" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Deduplication</a>
                      <hr className="my-1" />
                      <a href="/amazon-integration" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Amazon Integration</a>
                      <a href="/multi-asin" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Multi-ASIN Search</a>
                    </div>
                  </div>
                  <div className="relative group">
                    <button className="text-gray-600 hover:text-gray-900 flex items-center">
                      Suppliers <span className="ml-1">▼</span>
                    </button>
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white border shadow-lg rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                      <a href="/suppliers" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Supplier Management</a>
                      <hr className="my-1" />
                      <a href="/data-sources" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Data Sources</a>
                      <a href="/connections" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Connection Testing</a>
                      <a href="/mapping-templates" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Mapping Templates</a>
                    </div>
                  </div>
                  <div className="relative group">
                    <button className="text-gray-600 hover:text-gray-900 flex items-center">
                      Data <span className="ml-1">▼</span>
                    </button>
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white border shadow-lg rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                      <a href="/data-imports" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Data Imports</a>
                      <a href="/data-exports" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Data Exports</a>
                      <hr className="my-1" />
                      <a href="/approvals" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Approvals</a>
                      <a href="/audit-logs" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Audit Logs</a>
                    </div>
                  </div>
                  <a href="/amazon-analytics" className="text-gray-600 hover:text-gray-900">Analytics</a>
                  <div className="relative group">
                    <button className="text-gray-600 hover:text-gray-900 flex items-center">
                      System <span className="ml-1">▼</span>
                    </button>
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white border shadow-lg rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                      <a href="/system-analysis" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">System Analysis</a>
                      <a href="/system-monitoring" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">System Monitoring</a>
                      <hr className="my-1" />
                      <a href="/validation-rules" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Validation Rules</a>
                      <a href="/api-configuration" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">API Configuration</a>
                    </div>
                  </div>
                </nav>
              </div>
            </header>
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
