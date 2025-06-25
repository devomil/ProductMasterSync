import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OnboardingManager } from "@/components/onboarding/OnboardingManager";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import ProductsSimple from "@/pages/ProductsSimple";
import SuppliersSimple from "@/pages/SuppliersSimple";
import ProductDetails from "@/pages/ProductDetails";
import DataImports from "@/pages/DataImports";
import DataExports from "@/pages/DataExports";
import Categories from "@/pages/Categories";
import Suppliers from "@/pages/Suppliers";
import DataSources from "@/pages/DataSources";
import MappingTemplateEditor from "./pages/MappingTemplateEditor";
import Connections from "@/pages/Connections";
import Approvals from "@/pages/Approvals";
import AmazonIntegration from "@/pages/AmazonIntegration";
import AmazonAnalyticsFixed from "@/pages/AmazonAnalyticsFixed";
import MultiASINSearch from "@/pages/MultiASINSearch";
import AIPurchasing from "@/pages/AIPurchasing";
import ASINDemo from "@/pages/ASINDemo";
import NotFound from "@/pages/not-found";
import TopNavigation from "@/components/TopNavigation";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/products" component={Products} />
      <Route path="/products-simple" component={ProductsSimple} />
      <Route path="/products/:id" component={ProductDetails} />
      <Route path="/categories" component={Categories} />
      <Route path="/suppliers" component={SuppliersSimple} />
      <Route path="/data-imports" component={DataImports} />
      <Route path="/data-exports" component={DataExports} />
      <Route path="/data-sources" component={DataSources} />
      <Route path="/mapping-templates" component={MappingTemplateEditor} />
      <Route path="/mapping-templates/new" component={MappingTemplateEditor} />
      <Route path="/mapping-templates/:id" component={MappingTemplateEditor} />
      <Route path="/connections" component={Connections} />
      <Route path="/approvals" component={Approvals} />
      <Route path="/amazon-integration" component={AmazonIntegration} />
      <Route path="/amazon-analytics" component={AmazonAnalyticsFixed} />
      <Route path="/multi-asin" component={MultiASINSearch} />
      <Route path="/ai-purchasing" component={AIPurchasing} />
      <Route path="/asin-demo" component={ASINDemo} />
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