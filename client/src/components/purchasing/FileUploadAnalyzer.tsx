import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface FileUpload {
  id: number;
  fileName: string;
  fileSize: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalRows: number;
  processedRows: number;
  successRows: number;
  failedRows: number;
  opportunitiesFound: number;
  dropshipThreshold: number;
  warehouseThreshold: number;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

interface FileAnalysisResult {
  id: number;
  asin: string;
  upc: string | null;
  description: string | null;
  brand: string | null;
  quantity: number | null;
  supplierPrice: number | null;
  buyBoxPrice: number | null;
  dropshipMargin: number | null;
  warehouseMargin: number | null;
  isOpportunity: boolean;
  opportunityType: string | null;
  isRestricted: boolean;
}

export function FileUploadAnalyzer() {
  const [uploadId, setUploadId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const { data: upload, isLoading: uploadLoading } = useQuery<FileUpload>({
    queryKey: ['/api/purchasing/uploads', uploadId],
    enabled: !!uploadId,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === 'running' ? 3000 : false;
    },
  });

  const { data: results = [] } = useQuery<FileAnalysisResult[]>({
    queryKey: ['/api/purchasing/uploads', uploadId, 'results'],
    enabled: !!uploadId && upload?.status === 'completed',
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    if (!file.name.endsWith('.csv')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a CSV file',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dropshipThreshold', '12');
      formData.append('warehouseThreshold', '25');

      const res = await fetch('/api/purchasing/upload-analyze', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Upload failed');
      }

      const response = await res.json();

      setUploadId(response.uploadId);
      queryClient.invalidateQueries({ queryKey: ['/api/purchasing/uploads'] });

      toast({
        title: 'File uploaded',
        description: `Analyzing ${response.totalRows} products...`,
      });
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload file',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
    disabled: isUploading || (upload?.status === 'running'),
  });

  const progress = upload ? (upload.processedRows / upload.totalRows) * 100 : 0;
  const opportunities = results.filter(r => r.isOpportunity);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload & Analyze Supplier Price List</CardTitle>
          <CardDescription>
            Upload a CSV file with ASINs and supplier prices to analyze profitability
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            } ${isUploading || upload?.status === 'running' ? 'opacity-50 cursor-not-allowed' : ''}`}
            data-testid="file-upload-dropzone"
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-lg font-medium">Drop the file here...</p>
            ) : (
              <>
                <p className="text-lg font-medium mb-2">Drag & drop a CSV file here, or click to browse</p>
                <p className="text-sm text-muted-foreground">
                  CSV should include: ASIN, Description, Retail Price (supplier cost)
                </p>
              </>
            )}
          </div>

          {isUploading && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4 animate-spin" />
              Uploading file...
            </div>
          )}
        </CardContent>
      </Card>

      {upload && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  {upload.fileName}
                </CardTitle>
                <CardDescription>
                  {upload.totalRows} products · {((upload.fileSize / 1024)).toFixed(1)} KB
                </CardDescription>
              </div>
              {upload.status === 'completed' && (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Completed
                </Badge>
              )}
              {upload.status === 'running' && (
                <Badge variant="secondary">
                  <Clock className="w-4 h-4 mr-1 animate-pulse" />
                  Analyzing...
                </Badge>
              )}
              {upload.status === 'failed' && (
                <Badge variant="destructive">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  Failed
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {upload.status === 'running' && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span className="text-muted-foreground">
                    {upload.processedRows} / {upload.totalRows} ({Math.round(progress)}%)
                  </span>
                </div>
                <Progress value={progress} className="h-2" data-testid="upload-progress" />
              </div>
            )}

            {upload.status === 'completed' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-muted rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600">{upload.opportunitiesFound}</div>
                  <div className="text-sm text-muted-foreground">Opportunities Found</div>
                </div>
                <div className="bg-muted rounded-lg p-4">
                  <div className="text-2xl font-bold">{upload.successRows}</div>
                  <div className="text-sm text-muted-foreground">Analyzed Successfully</div>
                </div>
                <div className="bg-muted rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600">{upload.dropshipThreshold}%</div>
                  <div className="text-sm text-muted-foreground">Dropship Threshold</div>
                </div>
                <div className="bg-muted rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-600">{upload.warehouseThreshold}%</div>
                  <div className="text-sm text-muted-foreground">Warehouse Threshold</div>
                </div>
              </div>
            )}

            {upload.errorMessage && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Analysis Error</p>
                  <p className="text-sm text-destructive/90">{upload.errorMessage}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {upload?.status === 'completed' && opportunities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Profitable Opportunities ({opportunities.length})
            </CardTitle>
            <CardDescription>Products meeting your profit margin thresholds</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ASIN</TableHead>
                    <TableHead>UPC</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Supplier Cost</TableHead>
                    <TableHead className="text-right">Buy Box</TableHead>
                    <TableHead className="text-right">Dropship Margin</TableHead>
                    <TableHead className="text-right">Warehouse Margin</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunities.map((result) => (
                    <TableRow key={result.id} data-testid={`result-row-${result.asin}`}>
                      <TableCell className="font-mono text-sm">{result.asin}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {result.upc || '-'}
                      </TableCell>
                      <TableCell className="max-w-md truncate">
                        {result.description || result.brand || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        ${result.supplierPrice?.toFixed(2) || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        ${result.buyBoxPrice?.toFixed(2) || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={result.dropshipMargin && result.dropshipMargin >= 12 ? 'text-green-600 font-medium' : ''}>
                          {result.dropshipMargin?.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={result.warehouseMargin && result.warehouseMargin >= 25 ? 'text-green-600 font-medium' : ''}>
                          {result.warehouseMargin?.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={result.opportunityType === 'both' ? 'default' : 'secondary'}>
                          {result.opportunityType}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
