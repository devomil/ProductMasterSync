import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";

interface QualityMetric {
  name: string;
  percentage: number;
  color: string;
}

interface DataQualityProps {
  overallScore: number;
  metrics: QualityMetric[];
}

const DataQuality = ({ overallScore, metrics }: DataQualityProps) => {
  const getColorClass = (color: string) => {
    switch (color) {
      case "success":
        return "bg-green-500";
      case "primary":
        return "bg-primary";
      case "warning":
        return "bg-amber-500";
      default:
        return "bg-primary";
    }
  };

  return (
    <Card>
      <div className="px-4 py-5 sm:px-6 border-b border-neutral-200">
        <h3 className="text-lg leading-6 font-medium text-neutral-900">Data Quality</h3>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">Product data completeness and quality</p>
      </div>
      <div className="px-4 py-5 sm:p-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center p-1 bg-neutral-100 rounded-full h-32 w-32">
            <div className="bg-white rounded-full h-28 w-28 flex items-center justify-center">
              <span className="text-4xl font-bold text-primary">{overallScore}%</span>
            </div>
          </div>
          <p className="mt-2 text-sm font-medium text-neutral-900">Overall Data Quality Score</p>
        </div>
        
        <div className="mt-6">
          <div className="space-y-4">
            {metrics.map((metric, index) => (
              <div key={index}>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-neutral-900">{metric.name}</div>
                  <div className="text-sm font-medium text-neutral-900">{metric.percentage}%</div>
                </div>
                <div className="mt-1 w-full">
                  <Progress 
                    value={metric.percentage} 
                    className="h-1.5 bg-neutral-200" 
                    indicatorClassName={getColorClass(metric.color)} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="px-4 py-4 sm:px-6 bg-neutral-50 rounded-b-lg">
        <Link href="/validation-rules">
          <span className="text-sm font-medium text-primary hover:text-primary-dark cursor-pointer">
            View detailed report <span aria-hidden="true">&rarr;</span>
          </span>
        </Link>
      </div>
    </Card>
  );
};

export default DataQuality;
