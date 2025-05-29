import React, { useState } from 'react';
import { HelpCircle, X, Lightbulb, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface HelpTip {
  id: string;
  title: string;
  content: string;
  type: 'tip' | 'warning' | 'info' | 'success';
  actions?: Array<{
    label: string;
    action: () => void;
    variant?: 'default' | 'outline';
  }>;
  learnMore?: string;
}

interface HelpBubbleProps {
  tips: HelpTip[];
  position?: 'top' | 'bottom' | 'left' | 'right';
  trigger?: 'hover' | 'click';
  contextTitle?: string;
  className?: string;
}

const typeStyles = {
  tip: 'border-blue-200 bg-blue-50 text-blue-900',
  warning: 'border-yellow-200 bg-yellow-50 text-yellow-900',
  info: 'border-gray-200 bg-gray-50 text-gray-900',
  success: 'border-green-200 bg-green-50 text-green-900'
};

const typeIcons = {
  tip: Lightbulb,
  warning: HelpCircle,
  info: HelpCircle,
  success: HelpCircle
};

export function HelpBubble({ 
  tips, 
  position = 'bottom', 
  trigger = 'hover',
  contextTitle,
  className = '' 
}: HelpBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTip, setCurrentTip] = useState(0);

  const handleTrigger = () => {
    if (trigger === 'click') {
      setIsOpen(!isOpen);
    }
  };

  const handleMouseEnter = () => {
    if (trigger === 'hover') {
      setIsOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (trigger === 'hover') {
      setIsOpen(false);
    }
  };

  const nextTip = () => {
    setCurrentTip((prev) => (prev + 1) % tips.length);
  };

  const prevTip = () => {
    setCurrentTip((prev) => (prev - 1 + tips.length) % tips.length);
  };

  if (!tips.length) return null;

  const tip = tips[currentTip];
  const Icon = typeIcons[tip.type];

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 text-gray-400 hover:text-blue-600 transition-colors"
        onClick={handleTrigger}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <HelpCircle className="h-4 w-4" />
      </Button>

      {/* Help Bubble */}
      {isOpen && (
        <div
          className={`absolute z-50 w-80 ${
            position === 'bottom' ? 'top-full mt-2' :
            position === 'top' ? 'bottom-full mb-2' :
            position === 'left' ? 'right-full mr-2 top-0' :
            'left-full ml-2 top-0'
          }`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <Card className={`shadow-lg border ${typeStyles[tip.type]} animate-in fade-in-0 zoom-in-95 duration-200`}>
            <CardContent className="p-4">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <div>
                    {contextTitle && (
                      <div className="text-xs font-medium opacity-70 mb-1">
                        {contextTitle}
                      </div>
                    )}
                    <h4 className="font-semibold text-sm">{tip.title}</h4>
                  </div>
                </div>
                {trigger === 'click' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 -mt-1 -mr-1"
                    onClick={() => setIsOpen(false)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Content */}
              <div className="text-sm mb-3 leading-relaxed">
                {tip.content}
              </div>

              {/* Actions */}
              {tip.actions && tip.actions.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {tip.actions.map((action, index) => (
                    <Button
                      key={index}
                      size="sm"
                      variant={action.variant || 'default'}
                      onClick={action.action}
                      className="text-xs h-7"
                    >
                      {action.label}
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  ))}
                </div>
              )}

              {/* Learn More */}
              {tip.learnMore && (
                <div className="text-xs opacity-70 mb-3">
                  💡 {tip.learnMore}
                </div>
              )}

              {/* Navigation */}
              {tips.length > 1 && (
                <div className="flex items-center justify-between pt-2 border-t border-current/20">
                  <div className="flex gap-1">
                    {tips.map((_, index) => (
                      <button
                        key={index}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          index === currentTip ? 'bg-current' : 'bg-current/30'
                        }`}
                        onClick={() => setCurrentTip(index)}
                      />
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-xs"
                      onClick={prevTip}
                      disabled={tips.length <= 1}
                    >
                      ←
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-xs"
                      onClick={nextTip}
                      disabled={tips.length <= 1}
                    >
                      →
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Arrow */}
          <div className={`absolute w-3 h-3 bg-inherit border-inherit transform rotate-45 ${
            position === 'bottom' ? 'top-0 left-4 -translate-y-1/2 border-b-0 border-r-0' :
            position === 'top' ? 'bottom-0 left-4 translate-y-1/2 border-t-0 border-l-0' :
            position === 'left' ? 'top-4 right-0 translate-x-1/2 border-l-0 border-b-0' :
            'top-4 left-0 -translate-x-1/2 border-r-0 border-t-0'
          }`} />
        </div>
      )}
    </div>
  );
}

// Context-specific help configurations
export const helpContexts = {
  dashboard: [
    {
      id: 'dashboard-overview',
      title: 'Dashboard Overview',
      content: 'This dashboard provides a real-time view of your product data management system. Monitor import status, data quality, and system health at a glance.',
      type: 'info' as const,
      learnMore: 'Click on any metric card to drill down into detailed views.'
    }
  ],
  
  dataSourcesList: [
    {
      id: 'data-sources-intro',
      title: 'Data Sources Management',
      content: 'Data sources are your connections to supplier systems. Each source can be configured for automated imports and inventory synchronization.',
      type: 'tip' as const,
      actions: [
        {
          label: 'Add New Source',
          action: () => {
            // Trigger the "Add Data Source" button click
            const addButton = document.querySelector('[data-testid="add-data-source-button"]') as HTMLButtonElement;
            if (addButton) {
              addButton.click();
            } else {
              // Fallback: try to find the button by text content
              const buttons = Array.from(document.querySelectorAll('button'));
              const addDataSourceButton = buttons.find(btn => btn.textContent?.includes('Add Data Source'));
              if (addDataSourceButton) {
                addDataSourceButton.click();
              }
            }
          },
          variant: 'default' as const
        }
      ]
    },
    {
      id: 'inventory-sync',
      title: 'Inventory Synchronization',
      content: 'Use the "Sync Inventory" action to update product stock levels from your supplier\'s inventory feed. This matches products by MPN or SKU.',
      type: 'success' as const,
      learnMore: 'Inventory sync runs automatically but can be triggered manually when needed.'
    }
  ],

  productsList: [
    {
      id: 'products-overview',
      title: 'Product Catalog',
      content: 'Your master product catalog consolidates data from all suppliers. Products are automatically deduplicated and enriched with marketplace intelligence.',
      type: 'info' as const
    },
    {
      id: 'product-matching',
      title: 'Smart Product Matching',
      content: 'Products are matched across suppliers using advanced algorithms that consider SKU, MPN, UPC, and product attributes to prevent duplicates.',
      type: 'tip' as const,
      learnMore: 'Matched products are automatically merged while preserving supplier-specific data.'
    }
  ],

  productDetails: [
    {
      id: 'warehouse-locations',
      title: 'Warehouse Stock Levels',
      content: 'View real-time inventory across all warehouse locations. Click supplier names in the vendor stock table to see detailed warehouse information.',
      type: 'tip' as const,
      actions: [
        {
          label: 'Update Inventory',
          action: () => console.log('Trigger inventory update'),
          variant: 'outline' as const
        }
      ]
    },
    {
      id: 'supplier-data',
      title: 'Multi-Supplier Intelligence',
      content: 'This product appears in multiple supplier catalogs. Use the Supplier Info tab to compare pricing, availability, and specifications across vendors.',
      type: 'success' as const
    }
  ],

  mappingTemplates: [
    {
      id: 'field-mapping',
      title: 'Field Mapping Intelligence',
      content: 'Smart mapping templates learn from your previous imports and suggest optimal field mappings for new data sources.',
      type: 'tip' as const,
      learnMore: 'AI analyzes field names, data types, and sample values to provide accurate suggestions.'
    },
    {
      id: 'template-reuse',
      title: 'Template Reusability',
      content: 'Save mapping templates to standardize imports across similar data sources. Templates can be shared and customized for different supplier formats.',
      type: 'info' as const,
      actions: [
        {
          label: 'Create Template',
          action: () => console.log('Create template'),
          variant: 'default' as const
        }
      ]
    }
  ]
};