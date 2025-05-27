import { DescriptionProcessor } from "@/components/DescriptionProcessor";

export default function DescriptionProcessorPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Description Processor</h1>
        <p className="text-muted-foreground mt-2">
          Clean up HTML-heavy product descriptions from suppliers like your CWR data.
          Remove tags, extract features, and format for better readability.
        </p>
      </div>
      
      <DescriptionProcessor />
    </div>
  );
}