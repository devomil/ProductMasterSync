import { LucideIcon } from "lucide-react";
import { Link } from "wouter";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: "primary" | "accent" | "success" | "warning" | "error";
  linkUrl: string;
  linkText: string;
}

const MetricCard = ({ title, value, icon: Icon, color, linkUrl, linkText }: MetricCardProps) => {
  const getColorClass = (color: string) => {
    switch (color) {
      case "primary":
        return "bg-primary-light";
      case "accent":
        return "bg-accent";
      case "success":
        return "bg-green-500";
      case "warning":
        return "bg-amber-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-primary-light";
    }
  };

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center">
          <div className={`flex-shrink-0 ${getColorClass(color)} rounded-md p-3`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-neutral-500 truncate">{title}</dt>
              <dd>
                <div className="text-lg font-semibold text-neutral-900">{value}</div>
              </dd>
            </dl>
          </div>
        </div>
      </div>
      <div className="bg-neutral-50 px-4 py-4 sm:px-6">
        <div className="text-sm">
          <Link href={linkUrl}>
            <span className="font-medium text-primary hover:text-primary-dark cursor-pointer">
              {linkText}<span className="sr-only"> {linkText.toLowerCase()}</span>
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MetricCard;
