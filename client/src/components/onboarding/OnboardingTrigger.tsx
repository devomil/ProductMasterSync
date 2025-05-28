import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface OnboardingTriggerProps {
  onTrigger: () => void;
}

export function OnboardingTrigger({ onTrigger }: OnboardingTriggerProps) {
  const handleReset = () => {
    localStorage.removeItem('mdm-onboarding-completed');
    onTrigger();
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleReset}
      className="gap-2"
    >
      <Sparkles size={16} />
      View Tour
    </Button>
  );
}