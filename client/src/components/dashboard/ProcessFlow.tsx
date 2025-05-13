import { Card } from "@/components/ui/card";
import { Upload, ArrowLeftRight, GitCompare, CheckSquare, Share2 } from "lucide-react";

interface StepProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  borderColor: string;
}

const ProcessStep = ({ icon, title, description, color, borderColor }: StepProps) => {
  return (
    <div className={`flex flex-col items-center ${color} p-4 rounded-md border ${borderColor}`}>
      <div className="h-12 w-12 rounded-full bg-opacity-20 flex items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="text-sm font-medium text-neutral-900">{title}</h3>
      <p className="mt-1 text-xs text-center text-neutral-500">{description}</p>
    </div>
  );
};

interface PerformanceMetricProps {
  label: string;
  value: string;
}

const PerformanceMetric = ({ label, value }: PerformanceMetricProps) => {
  return (
    <div className="bg-neutral-50 rounded-md p-3">
      <div className="flex justify-between">
        <span className="text-sm text-neutral-500">{label}</span>
        <span className="text-sm font-medium text-neutral-900">{value}</span>
      </div>
    </div>
  );
};

const ProcessFlow = () => {
  return (
    <div className="mt-10">
      <h2 className="text-lg font-medium text-neutral-900">Data Processing Pipeline</h2>
      <Card className="mt-4">
        <div className="px-4 py-5 sm:p-6">
          <div className="relative">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 md:gap-4">
              <ProcessStep
                icon={<Upload className="text-green-600" />}
                title="Data Ingestion"
                description="Multiple sources and formats"
                color="bg-green-50"
                borderColor="border-green-200"
              />
              
              <ProcessStep
                icon={<ArrowLeftRight className="text-blue-600" />}
                title="Normalization"
                description="Schema mapping and cleaning"
                color="bg-blue-50"
                borderColor="border-blue-200"
              />
              
              <ProcessStep
                icon={<GitCompare className="text-purple-600" />}
                title="Matching"
                description="Entity resolution and deduplication"
                color="bg-purple-50"
                borderColor="border-purple-200"
              />
              
              <ProcessStep
                icon={<CheckSquare className="text-orange-600" />}
                title="Governance"
                description="Validation and approval workflows"
                color="bg-orange-50"
                borderColor="border-orange-200"
              />
              
              <ProcessStep
                icon={<Share2 className="text-teal-600" />}
                title="Syndication"
                description="Distribution to target systems"
                color="bg-teal-50"
                borderColor="border-teal-200"
              />
            </div>
            
            <div className="hidden md:block absolute top-1/2 left-[10%] w-[80%] h-0.5 bg-neutral-200 -z-10 transform -translate-y-1/2"></div>
          </div>
          
          <div className="mt-8">
            <h4 className="text-sm font-medium text-neutral-900">Pipeline Performance</h4>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-4">
              <PerformanceMetric label="Ingest Rate" value="8.5K/hour" />
              <PerformanceMetric label="Normalization" value="7.1K/hour" />
              <PerformanceMetric label="Match Rate" value="94.2%" />
              <PerformanceMetric label="Auto-Approval" value="78.5%" />
              <PerformanceMetric label="Sync Success" value="99.8%" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ProcessFlow;
