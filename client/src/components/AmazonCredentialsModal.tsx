import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface AmazonCredentialsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AmazonCredentialsModal({ open, onOpenChange }: AmazonCredentialsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);

  const saveCredentialsMutation = useMutation({
    mutationFn: async (credentials: any) => {
      const response = await apiRequest('POST', '/api/marketplace/credentials', credentials);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/amazon/config-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/credentials/amazon'] });
      
      toast({
        title: 'Credentials Saved',
        description: 'Your Amazon SP-API credentials have been saved successfully.',
      });
      
      // Clear form and close modal
      setClientId('');
      setClientSecret('');
      setRefreshToken('');
      setSellerId('');
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Save Credentials',
        description: error.message || 'An error occurred while saving your credentials.',
        variant: 'destructive'
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clientId || !clientSecret || !refreshToken || !sellerId) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields.',
        variant: 'destructive'
      });
      return;
    }

    saveCredentialsMutation.mutate({
      marketplace: 'amazon',
      clientId,
      clientSecret,
      refreshToken,
      sellerId,
      marketplaceId: 'ATVPDKIKX0DER',  // US marketplace
      endpoint: 'https://sellingpartnerapi-na.amazon.com',
      isActive: true
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Amazon SP-API Configuration</DialogTitle>
          <DialogDescription>
            Enter your Amazon Selling Partner API credentials. These will be saved securely and used for marketplace integration.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <Alert className="border-blue-200 bg-blue-50">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-900">
                <div className="space-y-2">
                  <p className="font-medium">To get your Amazon SP-API credentials:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Open the <a href="https://sellercentral.amazon.com/apps/manage" target="_blank" rel="noopener noreferrer" className="underline font-medium">Seller Central Apps page</a></li>
                    <li>Click "Develop apps" and create a new app (or select existing)</li>
                    <li>Under "LWA Credentials", copy your Client ID and Client Secret</li>
                    <li>Click "Authorize" and follow the OAuth flow to get your Refresh Token</li>
                    <li>Find your Seller ID in <a href="https://sellercentral.amazon.com/sw/AccountInfo/SellerProfileView/step/View" target="_blank" rel="noopener noreferrer" className="underline font-medium">Account Info</a> under "Merchant Token"</li>
                  </ol>
                </div>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="clientId">Client ID *</Label>
              <Input
                id="clientId"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="amzn1.application-oa2-client..."
                required
                data-testid="input-amazon-client-id"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientSecret">Client Secret *</Label>
              <div className="relative">
                <Input
                  id="clientSecret"
                  type={showSecrets ? 'text' : 'password'}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="Enter your client secret"
                  required
                  data-testid="input-amazon-client-secret"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowSecrets(!showSecrets)}
                  data-testid="button-toggle-secrets"
                >
                  {showSecrets ? (
                    <EyeOff className="h-4 w-4 text-gray-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-500" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="refreshToken">Refresh Token *</Label>
              <div className="relative">
                <Input
                  id="refreshToken"
                  type={showSecrets ? 'text' : 'password'}
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                  placeholder="Atzr|..."
                  required
                  data-testid="input-amazon-refresh-token"
                  className="pr-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sellerId">Seller ID / Merchant Token *</Label>
              <Input
                id="sellerId"
                value={sellerId}
                onChange={(e) => setSellerId(e.target.value)}
                placeholder="A10D4VTYI7RMZ2"
                required
                data-testid="input-amazon-seller-id"
              />
              <p className="text-xs text-muted-foreground">
                Also known as "Merchant Token" - find this in your Account Info
              </p>
            </div>

            {saveCredentialsMutation.isError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {saveCredentialsMutation.error?.message || 'Failed to save credentials. Please try again.'}
                </AlertDescription>
              </Alert>
            )}

            {saveCredentialsMutation.isSuccess && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-900">
                  Credentials saved successfully! You can now sync your products with Amazon.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saveCredentialsMutation.isPending}
              data-testid="button-cancel-credentials"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saveCredentialsMutation.isPending}
              data-testid="button-save-credentials"
            >
              {saveCredentialsMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Credentials
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
