import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/ui/theme-provider";
import Sidebar from "@/components/layout/Sidebar";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import ProductDetails from "@/pages/ProductDetails";
import Categories from "@/pages/Categories";
import Suppliers from "@/pages/Suppliers";
import MappingTemplateEditor from "@/pages/MappingTemplateEditor";
import DataImports from "@/pages/DataImports";
import DataExports from "@/pages/DataExports";
import Approvals from "@/pages/Approvals";
import AmazonIntegration from "@/pages/AmazonIntegration";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: (failureCount, error: any) => {
        if (error?.status === 404) return false;
        return failureCount < 3;
      },
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <div className="flex min-h-screen bg-background">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <div className="container mx-auto py-6 px-6">
              <Switch>
                <Route path="/" component={Dashboard} />
                <Route path="/products" component={Products} />
                <Route path="/products/:id" component={ProductDetails} />
                <Route path="/categories" component={Categories} />
                <Route path="/suppliers" component={Suppliers} />
                <Route path="/mapping-templates" component={MappingTemplateEditor} />
                <Route path="/mapping-templates/:id" component={MappingTemplateEditor} />
                <Route path="/imports" component={DataImports} />
                <Route path="/exports" component={DataExports} />
                <Route path="/approvals" component={Approvals} />
                <Route path="/amazon-integration" component={AmazonIntegration} />
                <Route>
                  <div className="text-center py-12">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">Page Not Found</h1>
                    <p className="text-gray-600">The page you're looking for doesn't exist.</p>
                  </div>
                </Route>
              </Switch>
            </div>
          </main>
        </div>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;