export interface GPTZeroResult {
  aiScore: number; // Percentage (0-100)
  isAI: boolean;
  confidence: number;
}

export class GPTZeroService {
  private readonly API_KEY = process.env.GPTZERO_API_KEY;
  private readonly API_URL = "https://api.gptzero.me/v2/predict/text";

  async analyzeText(text: string): Promise<GPTZeroResult> {
    if (!this.API_KEY) {
      throw new Error('GPTZero API key not configured');
    }

    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'x-api-key': this.API_KEY,
        },
        body: JSON.stringify({
          document: text,
          multilingual: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GPTZero API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      // Parse GPTZero response based on actual API format
      const document = data.documents[0];
      const aiProbability = document.class_probabilities?.ai || 0;
      const aiScore = Math.round(aiProbability * 100);
      const isHighConfidence = document.confidence_category === 'high';
      
      return {
        aiScore,
        isAI: document.document_classification === 'AI_ONLY' || document.document_classification === 'MIXED',
        confidence: isHighConfidence ? 0.9 : document.confidence_category === 'medium' ? 0.7 : 0.5,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('GPTZero API error:', errorMessage);
      throw new Error(`Failed to analyze text with GPTZero: ${errorMessage}`);
    }
  }

  async analyzeBatch(texts: string[]): Promise<GPTZeroResult[]> {
    const results = await Promise.all(
      texts.map(text => this.analyzeText(text))
    );
    return results;
  }
}

export const gptZeroService = new GPTZeroService();

// Legacy function for backward compatibility - maintains original API contract
interface AIDetectionResult {
  aiProbability: number;
  isAIGenerated: boolean;
}

export async function detectAIContent(text: string): Promise<AIDetectionResult> {
  const apiKey = process.env.GPTZERO_API_KEY;
  
  if (!apiKey) {
    console.error('GPTZERO_API_KEY environment variable is not set');
    // Return fallback response for graceful degradation
    return {
      aiProbability: 0,
      isAIGenerated: false
    };
  }

  try {
    const result = await gptZeroService.analyzeText(text);
    // Keep original scale: 0-100 (not 0-1)
    const aiProbability = result.aiScore;
    // Keep original threshold: >70%
    const isAIGenerated = aiProbability > 70;
    
    return {
      aiProbability,
      isAIGenerated,
    };
  } catch (error) {
    console.error('Error in detectAIContent:', error);
    // Return fallback response instead of throwing - maintains graceful degradation
    return {
      aiProbability: 0,
      isAIGenerated: false
    };
  }
}