import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, ExternalLink, Copy, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [imageLoadErrors, setImageLoadErrors] = useState<Record<string, boolean>>({});
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleImageError = (imageType: string) => {
    setImageLoadErrors(prev => ({ ...prev, [imageType]: true }));
  };

  const handleImageClick = (imageSrc: string) => {
    setSelectedImage(imageSrc);
  };

  const closeModal = () => {
    setSelectedImage(null);
  };

  const copyAsin = () => {
    navigator.clipboard.writeText(asin);
  };

  const ImageCard = ({ 
    src, 
    title, 
    type, 
    isAmazon = false 
  }: { 
    src?: string; 
    title: string; 
    type: string; 
    isAmazon?: boolean; 
  }) => (
    <div className="flex flex-col space-y-2">
      <div className="relative">
        <div className={cn(
          "aspect-square border-2 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center cursor-pointer hover:border-blue-500 transition-colors",
          isAmazon && canList ? "border-green-200" : isAmazon && !canList ? "border-red-200" : "border-gray-200"
        )}>
          {src && !imageLoadErrors[type] ? (
            <img
              src={src}
              alt={title}
              className="w-full h-full object-cover"
              onError={() => handleImageError(type)}
              onClick={() => handleImageClick(src)}
            />
          ) : (
            <div className="text-gray-400 text-center p-4">
              <div className="w-12 h-12 mx-auto mb-2 bg-gray-200 rounded-lg flex items-center justify-center">
                <Eye className="w-6 h-6" />
              </div>
              <span className="text-sm">No image available</span>
            </div>
          )}
        </div>
        
        {isAmazon && (
          <div className="absolute top-2 right-2">
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
          </div>
        )}
      </div>
      
      <div className="text-center">
        <h4 className="font-medium text-sm">{title}</h4>
        <p className="text-xs text-gray-500 mt-1">{type}</p>
      </div>
    </div>
  );

  return (
    <>
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
            
            {onListingAction && (
              <Button
                variant={canList ? "default" : "outline"}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ImageCard
              src={amazonImage}
              title="Amazon Product Image"
              type="Amazon Authentic"
              isAmazon={true}
            />
            
            <ImageCard
              src={supplierImage}
              title="Supplier Image"
              type="Supplier Catalog"
            />
            
            <ImageCard
              src={masterCatalogImage}
              title="Master Catalog Image"
              type="Internal Catalog"
            />
          </div>
          
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              Compare images to ensure accurate product matching for listing creation
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Image Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div className="relative max-w-4xl max-h-full">
            <img
              src={selectedImage}
              alt="Enlarged view"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              variant="outline"
              size="sm"
              className="absolute top-2 right-2 bg-white"
              onClick={closeModal}
            >
              ✕
            </Button>
          </div>
        </div>
      )}
    </>
  );
}