import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Package2, Building2, Upload, CheckSquare } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function MetricCard({ title, value, icon: Icon, color = "primary" }: any) {
  const colorClasses = {
    primary: "bg-blue-50 text-blue-700 border-blue-200",
    success: "bg-green-50 text-green-700 border-green-200",
    warning: "bg-yellow-50 text-yellow-700 border-yellow-200",
    info: "bg-purple-50 text-purple-700 border-purple-200"
  };

  return (
    <div className={`p-6 rounded-lg border-2 ${colorClasses[color as keyof typeof colorClasses]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className="p-3 rounded-full bg-white/50">
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const [statistics, setStatistics] = useState({
    totalProducts: 0,
    activeSuppliers: 0,
    successfulImports30d: 0,
    pendingApprovals: 0
  });

  useEffect(() => {
    fetch('/api/statistics')
      .then(res => res.json())
      .then(data => setStatistics(data))
      .catch(err => console.error('Failed to load statistics:', err));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">MDM/PIM System</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Dashboard</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Total Products"
              value={statistics.totalProducts.toLocaleString()}
              icon={Package2}
              color="primary"
            />
            <MetricCard
              title="Active Suppliers"
              value={statistics.activeSuppliers.toLocaleString()}
              icon={Building2}
              color="success"
            />
            <MetricCard
              title="Successful Imports (30d)"
              value={statistics.successfulImports30d.toLocaleString()}
              icon={Upload}
              color="info"
            />
            <MetricCard
              title="Pending Approvals"
              value={statistics.pendingApprovals.toLocaleString()}
              icon={CheckSquare}
              color="warning"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="font-medium">Add New Product</div>
              <div className="text-sm text-gray-600">Create a new product entry</div>
            </button>
            <button className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="font-medium">Import Data</div>
              <div className="text-sm text-gray-600">Upload supplier data files</div>
            </button>
            <button className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="font-medium">Manage Suppliers</div>
              <div className="text-sm text-gray-600">View and edit supplier information</div>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}