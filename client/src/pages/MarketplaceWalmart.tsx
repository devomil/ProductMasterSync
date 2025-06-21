import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export default function MarketplaceWalmart() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Walmart Marketplace Integration</h1>
          <p className="text-muted-foreground">API mapping and testing tools for Walmart Marketplace</p>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Walmart Marketplace integration coming soon. This will include similar cascading search logic with UPC/GTIN, WM Item ID, and product title matching with confidence scoring.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Search Strategy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>GTIN/UPC Search</span>
                <Badge variant="outline">Primary</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>WM Item ID</span>
                <Badge variant="outline">Secondary</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Title/Description</span>
                <Badge variant="outline">Fallback</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>• Product Search API</div>
              <div>• Inventory Management</div>
              <div>• Pricing API</div>
              <div>• Category Restrictions</div>
              <div>• Brand Authorization</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Confidence Scoring</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>GTIN + Title Match</span>
                <Badge>100%</Badge>
              </div>
              <div className="flex justify-between">
                <span>GTIN Only</span>
                <Badge variant="secondary">80%</Badge>
              </div>
              <div className="flex justify-between">
                <span>WM ID Only</span>
                <Badge variant="secondary">70%</Badge>
              </div>
              <div className="flex justify-between">
                <span>Title Match</span>
                <Badge variant="outline">50%</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}