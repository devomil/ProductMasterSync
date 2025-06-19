import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface ConfidenceOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: number;
  asin: string;
  currentConfidence: number;
  productName: string;
  amazonTitle: string;
  validationIssues: string[];
}

export function ConfidenceOverrideDialog({
  open,
  onOpenChange,
  productId,
  asin,
  currentConfidence,
  productName,
  amazonTitle,
  validationIssues
}: ConfidenceOverrideDialogProps) {
  const [overrideReason, setOverrideReason] = useState("");
  const [setPrimary, setSetPrimary] = useState(true);
  const [userConfidence, setUserConfidence] = useState([currentConfidence]);
  const [overrideFlags, setOverrideFlags] = useState<string[]>([]);
  const [reasonTemplate, setReasonTemplate] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const overrideMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/asin-confidence-override/manual-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error('Failed to apply override');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Override Applied",
        description: "ASIN confidence override has been applied successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/multi-asin-display/products-with-candidates'] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Override Failed",
        description: error instanceof Error ? error.message : "Failed to apply override",
        variant: "destructive"
      });
    }
  });

  const reasonTemplates = [
    { value: "verified_match", label: "Verified - This ASIN is correct despite low confidence" },
    { value: "category_exception", label: "Category mismatch acceptable for this product type" },
    { value: "image_quality", label: "Image quality sufficient for our requirements" },
    { value: "manual_research", label: "Manual research confirms this is the correct ASIN" },
    { value: "supplier_confirmation", label: "Supplier confirmed this ASIN mapping" },
    { value: "custom", label: "Custom reason (specify below)" }
  ];

  const overrideFlagOptions = [
    { id: "ignore_category_mismatch", label: "Ignore category mismatch" },
    { id: "ignore_image_quality", label: "Ignore image quality issues" },
    { id: "ignore_mpn_mismatch", label: "Ignore MPN mismatch" },
    { id: "ignore_description_mismatch", label: "Ignore description mismatch" },
    { id: "manual_verification_done", label: "Manual verification completed" },
    { id: "supplier_approved", label: "Supplier approved mapping" }
  ];

  const handleSubmit = () => {
    if (!overrideReason.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a reason for the override.",
        variant: "destructive"
      });
      return;
    }

    const finalReason = reasonTemplate === "custom" ? overrideReason : 
                       reasonTemplates.find(t => t.value === reasonTemplate)?.label + 
                       (overrideReason ? ` - ${overrideReason}` : '');

    overrideMutation.mutate({
      productId,
      asin,
      overrideReason: finalReason,
      setPrimary,
      userConfidenceScore: userConfidence[0],
      overrideFlags
    });
  };

  const resetForm = () => {
    setOverrideReason("");
    setSetPrimary(true);
    setUserConfidence([currentConfidence]);
    setOverrideFlags([]);
    setReasonTemplate("");
  };

  const handleFlagChange = (flagId: string, checked: boolean) => {
    if (checked) {
      setOverrideFlags([...overrideFlags, flagId]);
    } else {
      setOverrideFlags(overrideFlags.filter(f => f !== flagId));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Override ASIN Confidence Score
          </DialogTitle>
          <DialogDescription>
            Manually override the confidence score for this ASIN match. Use this when you've verified 
            the match is correct despite the system's low confidence assessment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Product Information */}
          <div className="rounded-lg bg-gray-50 p-4">
            <h4 className="font-medium mb-2">Product Information</h4>
            <div className="space-y-2 text-sm">
              <div><strong>Product:</strong> {productName}</div>
              <div><strong>ASIN:</strong> <span className="font-mono">{asin}</span></div>
              <div><strong>Amazon Title:</strong> {amazonTitle}</div>
              <div className="flex items-center gap-2">
                <strong>Current Confidence:</strong>
                <Badge variant={currentConfidence >= 75 ? "default" : currentConfidence >= 50 ? "secondary" : "destructive"}>
                  {currentConfidence}%
                </Badge>
              </div>
            </div>
          </div>

          {/* Validation Issues */}
          {validationIssues.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <h4 className="font-medium mb-2 text-amber-800">Current Issues</h4>
              <ul className="space-y-1">
                {validationIssues.map((issue, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-amber-700">
                    <XCircle className="h-4 w-4" />
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Override Reason Template */}
          <div className="space-y-2">
            <Label htmlFor="reason-template">Override Reason Template</Label>
            <Select value={reasonTemplate} onValueChange={setReasonTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason template..." />
              </SelectTrigger>
              <SelectContent>
                {reasonTemplates.map((template) => (
                  <SelectItem key={template.value} value={template.value}>
                    {template.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Reason */}
          <div className="space-y-2">
            <Label htmlFor="override-reason">
              {reasonTemplate === "custom" ? "Override Reason" : "Additional Details (Optional)"}
            </Label>
            <Textarea
              id="override-reason"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder={reasonTemplate === "custom" ? 
                "Explain why this ASIN is correct despite the low confidence score..." :
                "Add any additional context or details..."}
              className="min-h-[80px]"
            />
          </div>

          {/* New Confidence Score */}
          <div className="space-y-3">
            <Label>New Confidence Score: {userConfidence[0]}%</Label>
            <Slider
              value={userConfidence}
              onValueChange={setUserConfidence}
              max={100}
              min={0}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>0% (No Confidence)</span>
              <span>50% (Medium)</span>
              <span>100% (Certain)</span>
            </div>
          </div>

          {/* Override Flags */}
          <div className="space-y-3">
            <Label>Override Flags</Label>
            <div className="grid grid-cols-2 gap-3">
              {overrideFlagOptions.map((flag) => (
                <div key={flag.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={flag.id}
                    checked={overrideFlags.includes(flag.id)}
                    onCheckedChange={(checked) => handleFlagChange(flag.id, checked as boolean)}
                  />
                  <Label htmlFor={flag.id} className="text-sm">{flag.label}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Primary ASIN Setting */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="set-primary"
              checked={setPrimary}
              onCheckedChange={setSetPrimary}
            />
            <Label htmlFor="set-primary" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Set as Primary ASIN for this product
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={overrideMutation.isPending}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {overrideMutation.isPending ? "Applying..." : "Apply Override"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}