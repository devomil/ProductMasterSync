import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, AlertTriangle, Eye, ShoppingCart } from "lucide-react";

interface ProductCardProps {
  productGroup: {
    productName: string;
    sku: string;
    upc: string;
    category: string;
    asins: any[];
  };
  onViewDetails: (opportunity: any) => void;
}

export function ProductCard({ productGroup, onViewDetails }: ProductCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const bestScore = Math.max(...productGroup.asins.map((a: any) => a.opportunityScore));

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="font-semibold text-lg">{productGroup.productName}</h3>
              <Badge variant="outline">{productGroup.category}</Badge>
              <Badge 
                variant={bestScore >= 90 ? 'default' : bestScore >= 70 ? 'secondary' : 'outline'}
              >
                Score: {bestScore}
              </Badge>
            </div>
            
            <div className="grid grid-cols-4 gap-4 text-sm text-gray-600 mb-4">
              <div>
                <span className="font-medium">ASIN:</span> {productGroup.asins.length} Found
              </div>
              <div>
                <span className="font-medium">MPN:</span> {productGroup.sku.split('-')[1] || 'N/A'}
              </div>
              <div>
                <span className="font-medium">SKU:</span> {productGroup.sku}
              </div>
              <div>
                <span className="font-medium">UPC:</span> {productGroup.upc || 'Retrieved from Amazon'}
              </div>
            </div>
            
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center space-x-2"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    <span>Hide ASINs</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    <span>Show {productGroup.asins.length} ASINs</span>
                  </>
                )}
              </Button>
            </div>

            {isExpanded && (
              <div className="space-y-4 border-t pt-4">
                {productGroup.asins.map((opportunity: any, asinIndex: number) => (
                  <div key={asinIndex} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium">{opportunity.productName}</h4>
                        <Badge variant="outline">{opportunity.category}</Badge>
                        <Badge 
                          variant={opportunity.opportunityScore >= 90 ? 'default' : opportunity.opportunityScore >= 70 ? 'secondary' : 'outline'}
                        >
                          Score: {opportunity.opportunityScore}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-4">
                      <div>ASIN: {opportunity.asin}</div>
                      <div>SKU: {opportunity.sku}</div>
                      <div>UPC: {opportunity.upc || 'Retrieved from Amazon'}</div>
                      <div>Sales Rank: #{opportunity.salesRank?.toLocaleString()}</div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm font-medium text-gray-500">Buy Box Price</p>
                        <p className="text-lg font-bold text-blue-600">
                          {opportunity.amazon_buy_box_price ? `$${parseFloat(opportunity.amazon_buy_box_price).toFixed(2)}` : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Lowest Price</p>
                        <p className="text-lg font-bold text-orange-600">
                          {opportunity.amazon_lowest_price ? `$${parseFloat(opportunity.amazon_lowest_price).toFixed(2)}` : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Our Cost</p>
                        <p className="text-lg font-bold text-gray-700">${parseFloat(opportunity.ourCost || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Profit Margin</p>
                        <p className="text-lg font-bold text-green-600">{parseFloat(opportunity.profitMargin || 0).toFixed(1)}%</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-sm font-medium text-gray-500">Offer Count</p>
                        <p className="text-sm text-gray-700">{opportunity.amazon_offer_count || 0} sellers</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Fulfillment</p>
                        <p className="text-sm text-gray-700">{opportunity.amazon_fulfillment_channel || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Net Profit</p>
                        <p className="text-sm font-bold text-blue-600">${parseFloat(opportunity.netProfit || 0).toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Listing Restrictions Section */}
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-gray-900">Amazon Listing Status</h4>
                        {opportunity.listing_restrictions && Object.keys(opportunity.listing_restrictions).length > 0 ? (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Restricted
                          </Badge>
                        ) : (
                          <Badge variant="default" className="text-xs bg-green-600">
                            ✓ Can List
                          </Badge>
                        )}
                      </div>
                      
                      {opportunity.listing_restrictions && Object.keys(opportunity.listing_restrictions).length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-xs font-medium text-red-800 mb-2">Listing Restrictions Found:</p>
                          <div className="space-y-1">
                            {Object.entries(opportunity.listing_restrictions).map(([key, value], idx) => (
                              <div key={idx} className="flex justify-between text-xs">
                                <span className="text-red-700 font-medium">{key}:</span>
                                <span className="text-red-600">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {opportunity.listingRestrictions && opportunity.listingRestrictions.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-500 mb-1">Listing Restrictions</p>
                        <div className="flex flex-wrap gap-1">
                          {opportunity.listingRestrictions.map((restriction: string, idx: number) => (
                            <Badge key={idx} variant="destructive" className="text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              {restriction}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onViewDetails(opportunity)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => window.open(`https://amazon.com/dp/${opportunity.asin}`, '_blank')}
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        View on Amazon
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}