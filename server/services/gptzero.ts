import fetch from 'node-fetch';

interface GPTZeroResponse {
  documents: {
    completely_generated_prob: number;
    average_generated_prob: number;
    overall_burstiness: number;
    paragraphs: Array<{
      generated_prob: number;
      burstiness: number;
      text: string;
    }>;
  }[];
}

interface AIDetectionResult {
  aiProbability: number;
  isAIGenerated: boolean;
}

/**
 * Detect if text was AI-generated using GPTZero API
 */
export async function detectAIContent(text: string): Promise<AIDetectionResult> {
  const apiKey = process.env.GPTZERO_API_KEY;
  
  if (!apiKey) {
    throw new Error('GPTZERO_API_KEY environment variable is not set');
  }
  
  try {
    const response = await fetch('https://api.gptzero.me/v2/predict/text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        document: text,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`GPTZero API Error: ${response.status} - ${errorText}`);
      
      // If the API fails, return a fallback response for graceful degradation
      return {
        aiProbability: 0,
        isAIGenerated: false
      };
    }
    
    const data = await response.json() as GPTZeroResponse;
    
    // Extract the probability
    const aiProbability = Math.round(data.documents[0].completely_generated_prob * 100);
    
    // Determine if AI generated (>70% probability)
    const isAIGenerated = aiProbability > 70;
    
    return {
      aiProbability,
      isAIGenerated,
    };
  } catch (error) {
    console.error('Error detecting AI content:', error);
    // Return a fallback response instead of throwing the error
    return {
      aiProbability: 0,
      isAIGenerated: false
    };
  }
}
