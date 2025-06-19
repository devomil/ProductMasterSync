import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle, AlertTriangle, XCircle, HelpCircle } from "lucide-react";

interface ConfidenceIndicatorProps {
  score: number;
  level: string;
  color: string;
  description: string;
  matchReason: string;
  matchDetails: {
    upcMatch: boolean;
    mpnMatch: boolean;
    descriptionMatch: boolean;
    imageAvailable: boolean;
  };
  validationIssues: string[];
  size?: 'sm' | 'md' | 'lg';
}

export function ConfidenceIndicator({
  score,
  level,
  color,
  description,
  matchReason,
  matchDetails,
  validationIssues,
  size = 'md'
}: ConfidenceIndicatorProps) {
  const getIcon = () => {
    if (score >= 90) return <CheckCircle className="h-3 w-3" />;
    if (score >= 75) return <CheckCircle className="h-3 w-3" />;
    if (score >= 60) return <AlertTriangle className="h-3 w-3" />;
    return <XCircle className="h-3 w-3" />;
  };

  const getBadgeVariant = () => {
    if (color === 'green') return 'default';
    if (color === 'blue') return 'secondary';
    if (color === 'yellow') return 'outline';
    return 'destructive';
  };

  const getBadgeClass = () => {
    const baseClass = size === 'sm' ? 'text-xs px-1 py-0.5' : 
                     size === 'lg' ? 'text-sm px-3 py-1' : 'text-xs px-2 py-1';
    
    if (color === 'green') return `${baseClass} bg-green-100 text-green-800 border-green-200`;
    if (color === 'blue') return `${baseClass} bg-blue-100 text-blue-800 border-blue-200`;
    if (color === 'yellow') return `${baseClass} bg-yellow-100 text-yellow-800 border-yellow-200`;
    return `${baseClass} bg-red-100 text-red-800 border-red-200`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`inline-flex items-center gap-1 rounded border ${getBadgeClass()} cursor-help`}>
            {getIcon()}
            <span className="font-medium">{score}%</span>
            <span className="font-normal">{level}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm">
          <div className="space-y-2 text-sm">
            <div className="font-semibold">{description}</div>
            
            <div>
              <span className="font-medium">Match Details:</span>
              <div className="text-xs space-y-1 mt-1">
                <div className="flex items-center gap-2">
                  {matchDetails.upcMatch ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500" />
                  )}
                  <span>UPC Match</span>
                </div>
                <div className="flex items-center gap-2">
                  {matchDetails.mpnMatch ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500" />
                  )}
                  <span>MPN Match</span>
                </div>
                <div className="flex items-center gap-2">
                  {matchDetails.descriptionMatch ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500" />
                  )}
                  <span>Description Match</span>
                </div>
                <div className="flex items-center gap-2">
                  {matchDetails.imageAvailable ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500" />
                  )}
                  <span>Image Available</span>
                </div>
              </div>
            </div>

            <div>
              <span className="font-medium">Reason:</span>
              <div className="text-xs mt-1">{matchReason}</div>
            </div>

            {validationIssues.length > 0 && (
              <div>
                <span className="font-medium text-amber-600">Issues:</span>
                <ul className="text-xs mt-1 space-y-1">
                  {validationIssues.map((issue, index) => (
                    <li key={index} className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}