import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

interface FieldMapping {
  sourceField: string;
  targetField: string;
  confidence: number;
  reasoning: string;
}

interface TargetField {
  id: string;
  targetField: string;
  description: string;
  example?: string;
  category: string;
}

interface AutoMappingResult {
  mappings: FieldMapping[];
  unmapped: string[];
  totalConfidence: number;
}

export class AIMappingService {
  private static instance: AIMappingService;

  public static getInstance(): AIMappingService {
    if (!AIMappingService.instance) {
      AIMappingService.instance = new AIMappingService();
    }
    return AIMappingService.instance;
  }

  async autoMapFields(
    sourceFields: string[],
    targetFields: TargetField[]
  ): Promise<AutoMappingResult> {
    try {
      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert data mapping assistant for e-commerce product data. Your task is to intelligently match source fields from supplier data feeds to target database fields.

You must analyze field names, descriptions, and examples to suggest the best mappings with confidence scores.

Rules:
1. Only suggest mappings with confidence >= 0.6 (60%)
2. Each source field can only map to one target field
3. Prioritize exact or near-exact field name matches
4. Consider semantic meaning and business context
5. Use field descriptions and examples to guide decisions
6. Provide clear reasoning for each mapping suggestion

Response format must be valid JSON:
{
  "mappings": [
    {
      "sourceField": "exact source field name",
      "targetField": "exact target field name", 
      "confidence": 0.95,
      "reasoning": "Clear explanation of why this mapping makes sense"
    }
  ],
  "unmapped": ["list", "of", "source", "fields", "with", "no", "good", "match"],
  "summary": "Brief overview of mapping results"
}`
          },
          {
            role: "user",
            content: `Please analyze and map these source fields to target fields:

SOURCE FIELDS:
${sourceFields.map(field => `- "${field}"`).join('\n')}

TARGET FIELDS:
${targetFields.map(field => 
  `- "${field.targetField}" (${field.category}): ${field.description}${field.example ? ` | Example: ${field.example}` : ''}`
).join('\n')}

Provide intelligent mapping suggestions with confidence scores.`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2000
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      // Validate and calculate total confidence
      const mappings: FieldMapping[] = (result.mappings || []).filter((mapping: any) => 
        mapping.confidence >= 0.6 && 
        sourceFields.includes(mapping.sourceField) &&
        targetFields.some(tf => tf.targetField === mapping.targetField)
      );

      const unmapped = sourceFields.filter(sf => 
        !mappings.some(m => m.sourceField === sf)
      );

      const totalConfidence = mappings.length > 0 
        ? mappings.reduce((sum, m) => sum + m.confidence, 0) / mappings.length 
        : 0;

      return {
        mappings,
        unmapped,
        totalConfidence: Math.round(totalConfidence * 100) / 100
      };

    } catch (error) {
      console.error('AI mapping error:', error);
      return {
        mappings: [],
        unmapped: sourceFields,
        totalConfidence: 0
      };
    }
  }

  async suggestBestMatch(
    sourceField: string,
    targetFields: TargetField[]
  ): Promise<FieldMapping | null> {
    try {
      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a data mapping expert. Find the best target field match for a given source field.

Respond with JSON:
{
  "targetField": "exact target field name or null",
  "confidence": 0.85,
  "reasoning": "explanation of the match"
}`
          },
          {
            role: "user",
            content: `Find the best match for source field "${sourceField}" from these targets:

${targetFields.map(field => 
  `- "${field.targetField}": ${field.description}${field.example ? ` | Example: ${field.example}` : ''}`
).join('\n')}

Return null if no good match (confidence < 0.6).`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 300
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      if (result.targetField && result.confidence >= 0.6) {
        return {
          sourceField,
          targetField: result.targetField,
          confidence: result.confidence,
          reasoning: result.reasoning || ''
        };
      }

      return null;
    } catch (error) {
      console.error('AI suggestion error:', error);
      return null;
    }
  }
}