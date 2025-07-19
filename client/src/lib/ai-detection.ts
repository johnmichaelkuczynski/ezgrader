// ai-detection.ts
interface AIDetectionResult {
  aiProbability: number;
  isAIGenerated: boolean;
}

export async function detectAI(text: string): Promise<AIDetectionResult> {
  try {
    const response = await fetch('/api/detect-ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
    
    if (!response.ok) {
      console.error('Failed to detect AI, using fallback');
      return { aiProbability: 0, isAIGenerated: false };
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error in AI detection:', error);
    // Return a fallback response instead of throwing
    return { aiProbability: 0, isAIGenerated: false };
  }
}
