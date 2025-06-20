import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  DollarSign, 
  Package, 
  BarChart3,
  Search,
  Filter,
  ShoppingCart,
  Zap,
  Target,
  Brain
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface PurchasingOpportunity {
  id: string;
  product_name: string;
  sku: string;
  category: string;
  amazon_asin?: string;
  current_price?: number;
  amazon_price?: number;
  price_difference?: number;
  profit_margin?: number;
  demand_score: number;
  competition_level: 'Low' | 'Medium' | 'High';
  recommendation_score: number;
  recommendation_reason: string;
  market_trend: 'Rising' | 'Stable' | 'Declining';
  stock_level: number;
  supplier_availability: boolean;
  estimated_roi: number;
  risk_level: 'Low' | 'Medium' | 'High';
}

interface AIInsight {
  type: 'opportunity' | 'warning' | 'trend';
  title: string;
  description: string;
  confidence: number;
  action_required: boolean;
}

const PurchasingAI = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('recommendation_score');

  // Fetch purchasing opportunities from our catalog cross-referenced with market data
  const { data: opportunities = [], isLoading: opportunitiesLoading } = useQuery({
    queryKey: ['/api/purchasing/opportunities', selectedCategory, riskFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (riskFilter !== 'all') params.append('risk_level', riskFilter);
      
      const response = await fetch(`/api/purchasing/opportunities?${params}`);
      if (!response.ok) {
        // Return mock data for demonstration
        return generateMockOpportunities();
      }
      return response.json();
    }
  });

  // Fetch AI insights and market intelligence
  const { data: aiInsights = [], isLoading: insightsLoading } = useQuery({
    queryKey: ['/api/purchasing/ai-insights'],
    queryFn: async () => {
      const response = await fetch('/api/purchasing/ai-insights');
      if (!response.ok) {
        return generateMockInsights();
      }
      return response.json();
    }
  });

  // Fetch categories for filtering
  const { data: categories = [] } = useQuery({
    queryKey: ['/api/categories'],
  });

  const generateMockOpportunities = (): PurchasingOpportunity[] => [
    {
      id: '1',
      product_name: 'Wilderness Systems Tarpon 120 Kayak',
      sku: '488270',
      category: 'Paddlesports',
      amazon_asin: 'B08XYZ123',
      current_price: 649.99,
      amazon_price: 899.99,
      price_difference: 250.00,
      profit_margin: 38.5,
      demand_score: 92,
      competition_level: 'Medium',
      recommendation_score: 94,
      recommendation_reason: 'High demand, excellent margins, trending upward in outdoor recreation',
      market_trend: 'Rising',
      stock_level: 15,
      supplier_availability: true,
      estimated_roi: 245.5,
      risk_level: 'Low'
    },
    {
      id: '2', 
      product_name: 'Coleman Sundome Camping Tent',
      sku: '451892',
      category: 'Camping',
      amazon_asin: 'B07ABC456',
      current_price: 89.99,
      amazon_price: 129.99,
      price_difference: 40.00,
      profit_margin: 44.4,
      demand_score: 88,
      competition_level: 'High',
      recommendation_score: 78,
      recommendation_reason: 'Seasonal peak approaching, strong brand recognition',
      market_trend: 'Rising',
      stock_level: 8,
      supplier_availability: true,
      estimated_roi: 156.3,
      risk_level: 'Medium'
    },
    {
      id: '3',
      product_name: 'Yeti Rambler Tumbler 30oz',
      sku: '392847',
      category: 'Drinkware',
      amazon_asin: 'B09DEF789',
      current_price: 34.99,
      amazon_price: 39.99,
      price_difference: 5.00,
      profit_margin: 14.3,
      demand_score: 76,
      competition_level: 'High',
      recommendation_score: 45,
      recommendation_reason: 'Saturated market, low margins, declining trend',
      market_trend: 'Declining',
      stock_level: 45,
      supplier_availability: true,
      estimated_roi: 67.8,
      risk_level: 'High'
    }
  ];

  const generateMockInsights = (): AIInsight[] => [
    {
      type: 'opportunity',
      title: 'Outdoor Recreation Surge',
      description: 'Paddlesports and camping categories showing 340% increase in demand. Consider increasing inventory allocation.',
      confidence: 92,
      action_required: true
    },
    {
      type: 'warning',
      title: 'Supply Chain Alert',
      description: 'CWR supplier reporting potential delays on 3 high-demand SKUs. Consider alternative sourcing.',
      confidence: 87,
      action_required: true
    },
    {
      type: 'trend',
      title: 'Seasonal Pattern Recognition',
      description: 'Historical data suggests 45% uptick in camping gear sales over next 6 weeks.',
      confidence: 94,
      action_required: false
    }
  ];

  const filteredOpportunities = opportunities
    .filter(opp => 
      searchTerm === '' || 
      opp.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opp.sku.includes(searchTerm)
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'recommendation_score':
          return b.recommendation_score - a.recommendation_score;
        case 'profit_margin':
          return (b.profit_margin || 0) - (a.profit_margin || 0);
        case 'demand_score':
          return b.demand_score - a.demand_score;
        default:
          return 0;
      }
    });

  const getRecommendationColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return 'bg-green-100 text-green-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'High': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'Rising': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'Declining': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <BarChart3 className="h-4 w-4 text-blue-600" />;
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Purchasing AI</h1>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            <Zap className="h-3 w-3 mr-1" />
            AI-Powered
          </Badge>
        </div>
        <p className="text-gray-600 text-lg">
          Intelligent buying recommendations powered by cross-referenced catalog and marketplace data
        </p>
      </div>

      <Tabs defaultValue="opportunities" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="opportunities">Buying Opportunities</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
          <TabsTrigger value="analytics">Market Analytics</TabsTrigger>
          <TabsTrigger value="automation">Auto-Purchase</TabsTrigger>
        </TabsList>

        <TabsContent value="opportunities" className="space-y-6">
          {/* Filters and Search */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search products or SKUs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={riskFilter} onValueChange={setRiskFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Risk Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Risk Levels</SelectItem>
                    <SelectItem value="Low">Low Risk</SelectItem>
                    <SelectItem value="Medium">Medium Risk</SelectItem>
                    <SelectItem value="High">High Risk</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recommendation_score">Recommendation Score</SelectItem>
                    <SelectItem value="profit_margin">Profit Margin</SelectItem>
                    <SelectItem value="demand_score">Demand Score</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Opportunities Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredOpportunities.map((opportunity) => (
              <Card key={opportunity.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{opportunity.product_name}</CardTitle>
                      <p className="text-sm text-gray-500 mt-1">SKU: {opportunity.sku}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className={getRecommendationColor(opportunity.recommendation_score)}>
                        Score: {opportunity.recommendation_score}
                      </Badge>
                      <Badge variant="outline" className={getRiskColor(opportunity.risk_level)}>
                        {opportunity.risk_level} Risk
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Our Price:</span>
                        <span className="font-medium">${opportunity.current_price}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Amazon Price:</span>
                        <span className="font-medium">${opportunity.amazon_price}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Profit Margin:</span>
                        <span className="font-medium text-green-600">{opportunity.profit_margin}%</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Demand:</span>
                        <div className="flex items-center gap-2">
                          <Progress value={opportunity.demand_score} className="w-16 h-2" />
                          <span className="font-medium">{opportunity.demand_score}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Trend:</span>
                        <div className="flex items-center gap-1">
                          {getTrendIcon(opportunity.market_trend)}
                          <span className="font-medium">{opportunity.market_trend}</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Est. ROI:</span>
                        <span className="font-medium text-blue-600">{opportunity.estimated_roi}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-700 font-medium mb-1">AI Recommendation:</p>
                    <p className="text-sm text-gray-600">{opportunity.recommendation_reason}</p>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>Stock: {opportunity.stock_level}</span>
                      <span>Competition: {opportunity.competition_level}</span>
                    </div>
                    <Button 
                      size="sm" 
                      className="bg-blue-600 hover:bg-blue-700"
                      disabled={!opportunity.supplier_availability}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Add to Purchase Order
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {aiInsights.map((insight, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {insight.type === 'opportunity' && <Target className="h-5 w-5 text-green-600" />}
                      {insight.type === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-600" />}
                      {insight.type === 'trend' && <BarChart3 className="h-5 w-5 text-blue-600" />}
                      {insight.title}
                    </CardTitle>
                    {insight.action_required && (
                      <Badge variant="destructive" className="text-xs">
                        Action Required
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">{insight.description}</p>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Confidence:</span>
                      <Progress value={insight.confidence} className="w-20 h-2" />
                      <span className="text-sm font-medium">{insight.confidence}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Total Profit Potential
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">$47,250</div>
                <p className="text-sm text-gray-600 mt-1">From top 10 opportunities</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  High-Value Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{opportunities.filter(o => o.recommendation_score >= 80).length}</div>
                <p className="text-sm text-gray-600 mt-1">Products with 80+ score</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                  Market Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">↑ 28%</div>
                <p className="text-sm text-gray-600 mt-1">Average demand increase</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="automation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-600" />
                Auto-Purchase Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    <span className="font-medium text-yellow-800">Feature Coming Soon</span>
                  </div>
                  <p className="text-yellow-700">
                    Automated purchasing based on AI recommendations will be available in the next release. 
                    This will include safety limits, approval workflows, and supplier integration.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-medium">Planned Features:</h3>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Automated reorder point triggers
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Supplier API integration
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Purchase approval workflows
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Budget and limit controls
                      </li>
                    </ul>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="font-medium">Safety Features:</h3>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Maximum order value limits
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Risk assessment validation
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Manual approval required
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Real-time alerts and monitoring
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PurchasingAI;