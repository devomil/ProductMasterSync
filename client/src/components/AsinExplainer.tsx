import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

export default function AsinExplainer() {
  return (
    <Alert className="mb-4">
      <Info className="h-4 w-4" />
      <AlertDescription>
        <strong>ASINs (Amazon Standard Identification Numbers)</strong> are 10-character alphanumeric codes that Amazon uses to identify products. 
        They typically start with "B" followed by 9 characters (e.g., B08N5WRWNW). Our system searches Amazon's catalog using UPC/MPN/Description 
        to find matching ASINs, which are different from our internal product IDs.
      </AlertDescription>
    </Alert>
  );
}