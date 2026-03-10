import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Brain,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  BarChart3
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

interface SupplierCategoryCode {
  code: string;
  count: number;
  sampleProducts: string[];
}

const AICategoryMapper = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [suggestions, setSuggestions] = useState<MappingResult[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number; phase: string } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: suppliers = [] } = useQuery({
    queryKey: ['/api/suppliers'],
  });

  const getSuggestionsMutation = useMutation({
    mutationFn: async (supplierId: number) => {
      setProgress({ current: 0, total: 1, phase: "Fetching category codes..." });

      const codesResponse = await fetch(`/api/categories/supplier-codes/${supplierId}`);
      if (!codesResponse.ok) throw new Error('Failed to fetch category codes');
      const codesData = await codesResponse.json();
      const categoryCodes: SupplierCategoryCode[] = codesData.categories || [];

      if (categoryCodes.length === 0) {
        throw new Error('No category codes found for this supplier. Run an SFTP import first to populate category data.');
      }

      const supplier = suppliers.find((s: any) => s.id === supplierId);
      const totalBatches = Math.ceil(categoryCodes.length / 30);
      setProgress({ current: 0, total: totalBatches, phase: `Mapping ${categoryCodes.length} categories...` });

      const aiResponse = await apiRequest('POST', '/api/categories/ai-suggest-batch', {
        supplierName: supplier?.name || 'Unknown Supplier',
        supplierId: supplierId,
        categoryCodes
      });

      setProgress(null);
      return aiResponse.json();
    },
    onSuccess: (data) => {
      const mappings = data.suggestions || [];
      setSuggestions(mappings);
      const totalProducts = mappings.reduce((sum: number, m: MappingResult) => sum + m.productCount, 0);
      toast({
        title: "AI Analysis Complete",
        description: `Mapped ${mappings.length} categories covering ${totalProducts.toLocaleString()} products`,
      });
    },
    onError: (error: any) => {
      setProgress(null);
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: error.message || "Failed to analyze categories",
      });
    }
  });

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

  const totalProducts = suggestions.reduce((sum, m) => sum + m.productCount, 0);
  const highConfidence = suggestions.filter(s => (s.suggestions[0]?.confidence || 0) >= 80).length;
  const medConfidence = suggestions.filter(s => {
    const c = s.suggestions[0]?.confidence || 0;
    return c >= 50 && c < 80;
  }).length;
  const lowConfidence = suggestions.filter(s => (s.suggestions[0]?.confidence || 0) < 50).length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
          <Brain className="mr-2 h-4 w-4" />
          AI Category Mapper
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <span>AI-Powered Category Mapping</span>
          </DialogTitle>
          <DialogDescription>
            Analyze all supplier category codes and map them to a clean category hierarchy using AI
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {suggestions.length === 0 && !progress && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Supplier</label>
                <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                  <SelectTrigger>
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
                        AI will analyze all distinct supplier category codes from the product catalog,
                        map them to a human-readable hierarchy (e.g., "ETHERN | CABL" becomes "Networking &gt; Ethernet Cables"),
                        and suggest Google Merchant categories. This processes all categories in batches.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={handleAnalyze}
                disabled={!selectedSupplier || getSuggestionsMutation.isPending}
                className="w-full"
              >
                {getSuggestionsMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="mr-2 h-4 w-4" />
                    Analyze All Categories
                  </>
                )}
              </Button>
            </div>
          )}

          {progress && (
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-600" />
                <p className="text-sm font-medium">{progress.phase}</p>
                {progress.total > 1 && (
                  <div className="space-y-1">
                    <Progress value={(progress.current / progress.total) * 100} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      Processing with AI... This may take a minute for large catalogs.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  AI Suggestions ({suggestions.length} categories)
                </h3>
                <Badge variant="outline" className="text-sm">
                  {totalProducts.toLocaleString()} products covered
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="pt-4 pb-3 text-center">
                    <div className="text-2xl font-bold text-green-700">{highConfidence}</div>
                    <div className="text-xs text-green-600">High Confidence (80%+)</div>
                  </CardContent>
                </Card>
                <Card className="bg-yellow-50 border-yellow-200">
                  <CardContent className="pt-4 pb-3 text-center">
                    <div className="text-2xl font-bold text-yellow-700">{medConfidence}</div>
                    <div className="text-xs text-yellow-600">Medium (50-79%)</div>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="pt-4 pb-3 text-center">
                    <div className="text-2xl font-bold text-red-700">{lowConfidence}</div>
                    <div className="text-xs text-red-600">Low (&lt;50%)</div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {suggestions.map((result, index) => (
                  <Card key={index} className="hover:bg-gray-50 transition-colors">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="text-xs font-mono shrink-0">
                              {result.supplierCategoryName}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {result.productCount.toLocaleString()} products
                            </span>
                          </div>
                          {result.suggestions[0] && (
                            <div>
                              <p className="text-sm font-medium truncate">
                                {result.suggestions[0].categoryName}
                              </p>
                              {result.suggestions[0].googleCategory && (
                                <p className="text-xs text-muted-foreground truncate">
                                  Google: {result.suggestions[0].googleCategory}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="w-32 shrink-0">
                          {result.suggestions[0] && (
                            <ConfidenceBar confidence={result.suggestions[0].confidence} />
                          )}
                        </div>
                        {result.suggestions[0]?.confidence >= 80 && (
                          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                        )}
                      </div>
                      {result.suggestions[0]?.reasoning && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          {result.suggestions[0].reasoning}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex space-x-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => { setSuggestions([]); setProgress(null); }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleApply(false)}
                  disabled={applySuggestionsMutation.isPending}
                  className="flex-1"
                >
                  <ThumbsDown className="mr-2 h-4 w-4" />
                  Apply for Review
                </Button>
                <Button
                  onClick={() => handleApply(true)}
                  disabled={applySuggestionsMutation.isPending}
                  className="flex-1"
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
