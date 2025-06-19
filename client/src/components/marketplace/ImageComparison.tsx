import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, ExternalLink, Copy } from 'lucide-react';

interface ImageComparisonProps {
  amazonImage?: string;
  amazonTitle?: string;
  amazonBrand?: string;
  supplierImage?: string;
  masterCatalogImage?: string;
  productName: string;
  sku: string;
  asin: string;
  canList: boolean;
  restrictionMessages?: string[];
  onListingAction?: (asin: string) => void;
}

export function ImageComparison({
  amazonImage,
  amazonTitle,
  amazonBrand,
  supplierImage,
  masterCatalogImage,
  productName,
  sku,
  asin,
  canList,
  restrictionMessages = [],
  onListingAction
}: ImageComparisonProps) {
  
  const copyAsin = () => {
    navigator.clipboard.writeText(asin);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{productName}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-600">SKU: {sku}</span>
              <span className="text-xs text-gray-400">•</span>
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-600">ASIN: {asin}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={copyAsin}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {canList ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="w-3 h-3 mr-1" />
                Can List
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Restricted
              </Badge>
            )}
            
            {onListingAction && (
              <Button
                variant={canList ? "default" : "secondary"}
                size="sm"
                disabled={!canList}
                onClick={() => onListingAction(asin)}
                className="flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                {canList ? "Create Listing" : "Restricted"}
              </Button>
            )}
          </div>
        </div>
        
        {amazonBrand && amazonTitle && (
          <div className="mt-2 p-2 bg-blue-50 rounded-lg">
            <p className="text-sm">
              <span className="font-medium">Amazon: </span>
              {amazonBrand} - {amazonTitle}
            </p>
          </div>
        )}
        
        {restrictionMessages.length > 0 && (
          <div className="mt-2 p-2 bg-red-50 rounded-lg">
            <p className="text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              Listing Restrictions:
            </p>
            <ul className="text-xs text-red-600 mt-1 ml-4">
              {restrictionMessages.map((msg, index) => (
                <li key={index} className="list-disc">{msg}</li>
              ))}
            </ul>
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <h4 className="font-medium text-center">Amazon Image</h4>
            {amazonImage ? (
              <img 
                src={amazonImage} 
                alt={amazonTitle || 'Amazon Product'}
                className="w-full h-48 object-contain bg-gray-50 rounded border"
                onError={(e) => {
                  console.error('Amazon image failed to load:', amazonImage);
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div className={`w-full h-48 bg-gray-100 rounded border flex flex-col items-center justify-center text-gray-500 ${amazonImage ? 'hidden' : ''}`}>
              <span>No Amazon image</span>
              <span className="text-xs mt-1">URL: {amazonImage || 'null'}</span>
            </div>
            <p className="text-xs text-center text-gray-600">{amazonTitle}</p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium text-center">Supplier Image</h4>
            {supplierImage ? (
              <img 
                src={supplierImage} 
                alt={productName}
                className="w-full h-48 object-contain bg-gray-50 rounded border"
                onError={(e) => {
                  console.error('Supplier image failed to load:', supplierImage);
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div className={`w-full h-48 bg-gray-100 rounded border flex items-center justify-center text-gray-500 ${supplierImage ? 'hidden' : ''}`}>
              <span>No supplier image</span>
            </div>
            <p className="text-xs text-center text-gray-600">{productName}</p>
          </div>
        </div>
        
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            Compare images to ensure accurate product matching for listing creation
          </p>
        </div>
      </CardContent>
    </Card>
  );
}