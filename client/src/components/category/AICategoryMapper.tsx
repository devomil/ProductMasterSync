import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Brain,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Loader2,
  ThumbsUp,
  ThumbsDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CategorySuggestion {
  categoryName: string;
  confidence: number;
  reasoning: string;
  googleCategory?: string;
}

interface MappingResult {
  supplierCategoryName: string;
  suggestions: CategorySuggestion[];
  detectedIndustry: string;
  productCount: number;
}

const AICategoryMapper = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [suggestions, setSuggestions] = useState<MappingResult[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ['/api/suppliers'],
  });

  // Fetch products for analysis
  const { data: products = [] } = useQuery({
    queryKey: ['/api/products'],
    enabled: false, // Only fetch when needed
  });

  // Get AI suggestions mutation
  const getSuggestionsMutation = useMutation({
    mutationFn: async (supplierId: number) => {
      // Fetch products for this supplier
      const productsResponse = await fetch(`/api/products?supplierId=${supplierId}&limit=100`);
      const productsData = await productsResponse.json();
      const supplierProducts = Array.isArray(productsData) ? productsData : (productsData.products || []);

      if (!supplierProducts || supplierProducts.length === 0) {
        throw new Error('No products found for this supplier. Please pull sample data first.');
      }

      // Get supplier info
      const supplier = suppliers.find((s: any) => s.id === supplierId);
      
      // Prepare product samples for AI analysis
      const productSamples = supplierProducts.slice(0, 20).map((p: any) => ({
        name: p.name,
        description: p.description,
        category: p.attributes?.supplier_category || 
                  p.attributes?.category ||
                  p.attributes?.customFields?.Category ||
                  (p.attributes?.customFields?.['Sub Category'] 
                    ? `${p.attributes?.customFields?.Category || ''} | ${p.attributes?.customFields?.['Sub Category']}`
                    : null),
        manufacturerName: p.manufacturerName,
        attributes: p.attributes
      }));

      // Call AI suggestion API
      const aiResponse = await apiRequest('POST', '/api/categories/ai-suggest', {
        supplierName: supplier?.name || 'Unknown Supplier',
        supplierId: supplierId,
        productSamples
      });
      return aiResponse.json();
    },
    onSuccess: (data) => {
      setSuggestions(data.suggestions || []);
      toast({
        title: "AI Analysis Complete",
        description: `Found ${data.suggestions?.length || 0} category mappings to review`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: error.message || "Failed to analyze categories",
      });
    }
  });

  // Apply suggestions mutation
  const applySuggestionsMutation = useMutation({
    mutationFn: async ({ autoApprove }: { autoApprove: boolean }) => {
      const response = await apiRequest('POST', '/api/categories/apply-suggestions', {
        supplierId: parseInt(selectedSupplier),
        suggestions: suggestions,
        autoApprove
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Mappings Applied",
        description: `Successfully created ${data.results?.filter((r: any) => r.created).length || 0} category mappings`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setSuggestions([]);
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to Apply",
        description: error.message || "Failed to apply category mappings",
      });
    }
  });

  const handleAnalyze = () => {
    if (!selectedSupplier) {
      toast({
        variant: "destructive",
        title: "Supplier Required",
        description: "Please select a supplier to analyze",
      });
      return;
    }
    getSuggestionsMutation.mutate(parseInt(selectedSupplier));
  };

  const handleApply = (autoApprove: boolean) => {
    applySuggestionsMutation.mutate({ autoApprove });
  };

  const ConfidenceBar = ({ confidence }: { confidence: number }) => {
    const percentage = Math.round(confidence);
    const color = confidence >= 80 ? 'bg-green-500' : confidence >= 60 ? 'bg-yellow-500' : 'bg-red-500';
    
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Confidence</span>
          <span className="font-medium">{percentage}%</span>
        </div>
        <Progress value={percentage} className="h-2" />
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
          <Brain className="mr-2 h-4 w-4" />
          AI Category Mapper
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <span>AI-Powered Category Mapping</span>
          </DialogTitle>
          <DialogDescription>
            Automatically analyze products and suggest category mappings using AI
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Supplier Selection */}
          {suggestions.length === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Supplier</label>
                <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                  <SelectTrigger data-testid="select-supplier">
                    <SelectValue placeholder="Choose a supplier to analyze" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier: any) => (
                      <SelectItem key={supplier.id} value={supplier.id.toString()}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-blue-900">How it works</p>
                      <p className="text-sm text-blue-700">
                        AI will analyze your product data to detect categories, handle naming variances,
                        and suggest Google Merchant categories. Make sure you've pulled sample data first.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button 
                onClick={handleAnalyze}
                disabled={!selectedSupplier || getSuggestionsMutation.isPending}
                className="w-full"
                data-testid="button-analyze"
              >
                {getSuggestionsMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing Products...
                  </>
                ) : (
                  <>
                    <Brain className="mr-2 h-4 w-4" />
                    Analyze Categories
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Suggestions Display */}
          {suggestions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  AI Suggestions ({suggestions.length} categories)
                </h3>
                <Badge variant="outline" className="text-sm">
                  Industry: {suggestions[0]?.detectedIndustry || 'N/A'}
                </Badge>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {suggestions.map((result, index) => (
                  <Card key={index}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-sm font-medium">
                            {result.supplierCategoryName}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {result.productCount} products
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {result.suggestions.slice(0, 1).map((suggestion, sIndex) => (
                        <div key={sIndex} className="space-y-3 p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <p className="font-medium text-sm">{suggestion.categoryName}</p>
                              {suggestion.googleCategory && (
                                <p className="text-xs text-muted-foreground">
                                  Google: {suggestion.googleCategory}
                                </p>
                              )}
                            </div>
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          </div>
                          
                          <ConfidenceBar confidence={suggestion.confidence} />
                          
                          <p className="text-xs text-muted-foreground italic">
                            {suggestion.reasoning}
                          </p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex space-x-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setSuggestions([])}
                  className="flex-1"
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleApply(false)}
                  disabled={applySuggestionsMutation.isPending}
                  className="flex-1"
                  data-testid="button-apply-review"
                >
                  <ThumbsDown className="mr-2 h-4 w-4" />
                  Apply for Review
                </Button>
                <Button
                  onClick={() => handleApply(true)}
                  disabled={applySuggestionsMutation.isPending}
                  className="flex-1"
                  data-testid="button-apply-auto"
                >
                  {applySuggestionsMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ThumbsUp className="mr-2 h-4 w-4" />
                  )}
                  Auto-Approve & Apply
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AICategoryMapper;
