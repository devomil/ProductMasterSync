import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import DataImports from "@/pages/DataImports";
import DataExports from "@/pages/DataExports";
import Categories from "@/pages/Categories";
import Suppliers from "@/pages/Suppliers";
import ApiConfiguration from "@/pages/ApiConfiguration";
import DataSources from "@/pages/DataSources";
import MappingTemplates from "./pages/MappingTemplatesUpdate";
import Connections from "@/pages/Connections";
import Approvals from "@/pages/Approvals";
import ValidationRules from "@/pages/ValidationRules";
import AuditLogs from "@/pages/AuditLogs";
import AmazonIntegration from "@/pages/AmazonIntegration";
import SampleDataTest from "@/pages/SampleDataTest";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/products" component={Products} />
      <Route path="/categories" component={Categories} />
      <Route path="/suppliers" component={Suppliers} />
      <Route path="/data-imports" component={DataImports} />
      <Route path="/data-exports" component={DataExports} />
      <Route path="/data-sources" component={DataSources} />
      <Route path="/mapping-templates" component={MappingTemplates} />
      <Route path="/connections" component={Connections} />
      <Route path="/api-configuration" component={ApiConfiguration} />
      <Route path="/approvals" component={Approvals} />
      <Route path="/validation-rules" component={ValidationRules} />
      <Route path="/audit-logs" component={AuditLogs} />
      <Route path="/amazon-integration" component={AmazonIntegration} />
      <Route path="/sample-data-test" component={SampleDataTest} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppLayout>
          <Router />
        </AppLayout>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
