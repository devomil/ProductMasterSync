import { useState, useEffect } from "react";
import { Package2, Building2, Upload, CheckSquare, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import MetricCard from "@/components/dashboard/MetricCard";
import ImportActivity from "@/components/dashboard/ImportActivity";
import DataQuality from "@/components/dashboard/DataQuality";
import PendingApprovals from "@/components/dashboard/PendingApprovals";
import QuickActions from "@/components/dashboard/QuickActions";
import ProcessFlow from "@/components/dashboard/ProcessFlow";
import ImportModal from "@/components/imports/ImportModal";
import { useOnboarding } from "@/components/onboarding/OnboardingManager";
import { InventorySyncTester } from "@/components/InventorySyncTester";

// Data quality metrics
const dataQualityMetrics = [
  { name: "Completeness", percentage: 91, color: "success" },
  { name: "Consistency", percentage: 82, color: "primary" },
  { name: "Accuracy", percentage: 79, color: "warning" },
  { name: "Timeliness", percentage: 95, color: "success" },
];

const Dashboard = () => {
  const [showImportModal, setShowImportModal] = useState(false);
  const { triggerOnboarding } = useOnboarding();
  const [statistics, setStatistics] = useState({
    totalProducts: 23456,
    activeSuppliers: 156,
    successfulImports30d: 248,
    pendingApprovals: 42,
    dataQuality: {
      overall: 86
    }
  });

  useEffect(() => {
    // Fetch dashboard statistics
    const fetchStatistics = async () => {
      try {
        const response = await fetch("/api/statistics");
        if (response.ok) {
          const data = await response.json();
          setStatistics(data);
        }
      } catch (error) {
        console.error("Failed to fetch statistics:", error);
      }
    };

    fetchStatistics();
  }, []);

  return (
    <>
      <div className="pb-5 border-b border-neutral-200 sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
        <div className="mt-3 sm:mt-0 sm:ml-4 flex gap-3">
          <Button 
            variant="outline" 
            onClick={triggerOnboarding}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            View Tour
          </Button>
          <Button onClick={() => setShowImportModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Import
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="mt-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Products"
            value={statistics.totalProducts.toLocaleString()}
            icon={Package2}
            color="primary"
            linkUrl="/products"
            linkText="View all"
          />
          
          <MetricCard
            title="Active Suppliers"
            value={statistics.activeSuppliers.toLocaleString()}
            icon={Building2}
            color="accent"
            linkUrl="/suppliers"
            linkText="View all"
          />
          
          <MetricCard
            title="Successful Imports (30d)"
            value={statistics.successfulImports30d.toLocaleString()}
            icon={Upload}
            color="success"
            linkUrl="/data-imports"
            linkText="View logs"
          />
          
          <MetricCard
            title="Pending Approvals"
            value={statistics.pendingApprovals.toLocaleString()}
            icon={CheckSquare}
            color="warning"
            linkUrl="/approvals"
            linkText="Review"
          />
        </div>
      </div>

      {/* Import Activity */}
      <ImportActivity />

      {/* Data Management Overview */}
      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <PendingApprovals />
        <DataQuality overallScore={statistics.dataQuality.overall} metrics={dataQualityMetrics} />
        <QuickActions />
      </div>

      {/* Inventory Synchronization Testing */}
      <div className="mt-10 flex justify-center">
        <InventorySyncTester />
      </div>

      {/* Process Visualization */}
      <ProcessFlow />

      {/* Import Modal */}
      <ImportModal open={showImportModal} onOpenChange={setShowImportModal} />
    </>
  );
};

export default Dashboard;
