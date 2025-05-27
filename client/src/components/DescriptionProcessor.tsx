import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wand2, Copy } from "lucide-react";

interface ProcessedDescription {
  cleanText: string;
  formattedText: string;
  bulletPoints: string[];
  features: string[];
  warnings: string[];
}

export function DescriptionProcessor() {
  const [htmlInput, setHtmlInput] = useState('');
  const [processed, setProcessed] = useState<ProcessedDescription | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Example CWR description for demonstration
  const exampleDescription = `<p><strong>Survival Res-Q&trade; Whistle with Lanyard&nbsp;</strong></p><p>Get attention when you need it with the ResQ&trade; Whistle. &nbsp;This compact survival whistle was specially developed to locate boaters who&rsquo;ve fallen overboard, but it can also aid in land rescues.&nbsp;</p><p>The ResQ issues a shrill dual-tone up to 100 decibels, which is audible over great distances. &nbsp;The unique, flat design of this whistle keeps it from holding water, and its 31.5" (80 cm) lanyard easily attaches to life jackets, rafts, and other weather gear.&nbsp;</p><p><strong>Features:</strong></p><ul><li>Loud, shrill, dual tone audible from great distance</li><li>Unique flat design</li><li>Meets USCG/SOLAS requirements</li><li>Aids in land or sea rescues</li></ul><p>*Sold as an Individual&nbsp;</p><p><img src="https://productimageserver.com/prop65/6pt.png" alt="Warning" /><strong>WARNING:</strong> This product can expose you to chemicals which are known to the State of California to cause cancer, birth defects or other reproductive harm. For more information go to <a href="http://P65Warnings.ca.gov">P65Warnings.ca.gov</a>.</p>`;

  const processDescription = async () => {
    if (!htmlInput.trim()) return;
    
    setIsProcessing(true);
    try {
      // Simulate processing (replace with actual API call when ready)
      const mockProcessed: ProcessedDescription = {
        cleanText: stripHtml(htmlInput),
        formattedText: formatForDisplay(htmlInput),
        bulletPoints: extractBullets(htmlInput),
        features: extractFeatures(htmlInput),
        warnings: extractWarnings(htmlInput)
      };
      
      setProcessed(mockProcessed);
    } catch (error) {
      console.error('Error processing description:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Simple HTML stripping function for demo
  const stripHtml = (html: string): string => {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&trade;/g, '™')
      .replace(/&rsquo;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  };

  const formatForDisplay = (html: string): string => {
    return html
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/p>/gi, '')
      .replace(/<strong[^>]*>/gi, '**')
      .replace(/<\/strong>/gi, '**')
      .replace(/<ul[^>]*>/gi, '')
      .replace(/<\/ul>/gi, '')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<img[^>]*>/gi, '')
      .replace(/<!--.*?-->/gs, '')
      .replace(/<[^>]*>WARNING:.*?<\/[^>]*>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&trade;/g, '™')
      .replace(/&rsquo;/g, "'")
      .replace(/\*\*\s*\*\*/g, '')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  };

  const extractBullets = (html: string): string[] => {
    const bullets: string[] = [];
    const liMatches = html.match(/<li[^>]*>(.*?)<\/li>/gi);
    if (liMatches) {
      liMatches.forEach(match => {
        const text = stripHtml(match);
        if (text.trim()) bullets.push(text.trim());
      });
    }
    return bullets;
  };

  const extractFeatures = (html: string): string[] => {
    const bullets = extractBullets(html);
    return bullets; // In a real implementation, this would be more sophisticated
  };

  const extractWarnings = (html: string): string[] => {
    const warnings: string[] = [];
    const warningMatches = html.match(/<[^>]*>WARNING:.*?<\/[^>]*>/gi);
    if (warningMatches) {
      warningMatches.forEach(match => {
        const text = stripHtml(match);
        if (text.trim()) warnings.push(text.trim());
      });
    }
    return warnings;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Description Processor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">HTML Description Input</label>
            <Textarea
              placeholder="Paste HTML description here..."
              value={htmlInput}
              onChange={(e) => setHtmlInput(e.target.value)}
              rows={6}
              className="font-mono text-sm"
            />
            <div className="flex gap-2">
              <Button onClick={processDescription} disabled={isProcessing || !htmlInput.trim()}>
                {isProcessing ? "Processing..." : "Process Description"}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setHtmlInput(exampleDescription)}
              >
                Load CWR Example
              </Button>
            </div>
          </div>

          {processed && (
            <Tabs defaultValue="formatted" className="mt-6">
              <TabsList>
                <TabsTrigger value="formatted">Formatted</TabsTrigger>
                <TabsTrigger value="clean">Clean Text</TabsTrigger>
                <TabsTrigger value="structured">Structured</TabsTrigger>
              </TabsList>

              <TabsContent value="formatted" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Formatted Description</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(processed.formattedText)}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <pre className="whitespace-pre-wrap text-sm">{processed.formattedText}</pre>
                </div>
              </TabsContent>

              <TabsContent value="clean" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Clean Text (No Formatting)</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(processed.cleanText)}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm">{processed.cleanText}</p>
                </div>
              </TabsContent>

              <TabsContent value="structured" className="space-y-4">
                {processed.features.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      Features 
                      <Badge variant="secondary">{processed.features.length}</Badge>
                    </h4>
                    <ul className="space-y-1">
                      {processed.features.map((feature, index) => (
                        <li key={index} className="text-sm flex items-start gap-2">
                          <span className="text-muted-foreground">•</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {processed.warnings.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      Warnings 
                      <Badge variant="destructive">{processed.warnings.length}</Badge>
                    </h4>
                    <div className="space-y-2">
                      {processed.warnings.map((warning, index) => (
                        <div key={index} className="bg-red-50 border border-red-200 p-3 rounded-lg">
                          <p className="text-sm text-red-800">{warning}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {processed.bulletPoints.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      All Bullet Points 
                      <Badge variant="outline">{processed.bulletPoints.length}</Badge>
                    </h4>
                    <ul className="space-y-1">
                      {processed.bulletPoints.map((bullet, index) => (
                        <li key={index} className="text-sm flex items-start gap-2">
                          <span className="text-muted-foreground">•</span>
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}