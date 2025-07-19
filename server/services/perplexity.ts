import fetch from 'node-fetch';

// List of currently available Perplexity models
export const PERPLEXITY_MODELS = {
  // Sonar models - most up-to-date
  SONAR_SMALL: 'llama-3.1-sonar-small-128k-online',   // Most reliable, good for general use
  SONAR_MEDIUM: 'llama-3.1-sonar-medium-128k-online', // Medium capability model
  SONAR_LARGE: 'llama-3.1-sonar-large-128k-online',  // More capable with large context window
  
  // Older models - may be deprecated
  MISTRAL_ONLINE: 'mistral-large-online',      // Backup option if newer models fail
  MIXTRAL: 'mixtral-8x22b-instruct-online',    // More capable but less stable
  CODELLAMA: 'codellama-70b-instruct',         // Code-focused model
};

export interface PerplexityRequest {
  model: string;
  temperature: number;
  assignmentText: string;
  gradingText?: string;
  studentText?: string;
  referenceText?: string;
  instructionsText?: string;
  isExemplar?: boolean;
  includeAnnotations?: boolean;
  gradingDepth?: 'short' | 'medium' | 'long';
  includeCharts?: boolean;
  gradeLevel?: string; // Academic level for student feedback contextualization
}

interface PerplexityResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
  }>;
}

/**
 * Generate a response from Perplexity API
 */
export async function generatePerplexityResponse(request: PerplexityRequest): Promise<string> {
  try {
    // Get the API key from environment
    const apiKey = process.env.PERPLEXITY_API_KEY;
    
    if (!apiKey) {
      throw new Error('PERPLEXITY_API_KEY is not set in environment variables');
    }
    
    // Use provided model or default to a reliable model
    const model = request.model || PERPLEXITY_MODELS.SONAR_SMALL;
    console.log(`Using Perplexity model: ${model}`);
    
    // Determine system and user prompts based on request type
    let systemPrompt: string;
    let userPrompt: string;
    
    // Build the prompts based on the request type
    if (request.isExemplar) {
      // Handle exemplar generation
      systemPrompt = "You are a professor's exemplar creator that produces high-quality example submissions.";
      
      const annotationsInstructions = request.includeAnnotations 
        ? "Please include annotations explaining why specific elements make this an exemplary submission."
        : "";
        
      userPrompt = `
Create an exemplary assignment submission for the following assignment:

=== ASSIGNMENT PROMPT ===
${request.assignmentText}

=== REFERENCE MATERIALS ===
${request.referenceText || "No additional reference materials provided."}

=== SPECIFIC INSTRUCTIONS ===
${request.instructionsText}

${annotationsInstructions}

Your response should represent a model submission that would earn full marks. DO NOT include any JSON, markdown formatting, section headers, or structural elements in your response. Write in natural, fluent academic prose as if you were a top student.`;
    } else {
      // Grading request
      if (request.instructionsText) {
        // If override instructions were provided, use them directly
        systemPrompt = request.instructionsText;
        userPrompt = request.studentText || request.assignmentText || 'Please provide a response.';
      } else {
        // Standard grading request
        systemPrompt = `You are a professional academic grader who prioritizes correctness over style. Grade primarily on substance (90%) and minimally on presentation (10%).

GRADING PHILOSOPHY:
- START with 95-100 points for mathematically/conceptually correct work
- The primary question is: "Is the core content correct and complete?"
- Deduct ONLY for actual errors, missing required elements, or severe clarity issues
- Maximum deduction for minor formatting/style issues: 5 points total

GRADING CRITERIA (WEIGHTED):
PRIMARY (90%): Mathematical accuracy, logical reasoning, conceptual understanding, completeness
SECONDARY (10%): Clarity and organization (only if significantly impaired)

DO NOT DEDUCT FOR:
- Missing optional summaries, diagrams, or elaborations
- Alternative valid solution methods
- Minor formatting or LaTeX issues
- Stylistic preferences
- Verbose but correct approaches

SCORING GUIDELINES:
- 95-100%: Correct and complete work (minor style issues don't reduce grade)
- 90-94%: Correct work with very minor gaps or unclear sections
- 85-89%: Mostly correct with some small conceptual issues
- 80-84%: Generally correct but missing some key elements
- Below 80%: Significant conceptual errors or major omissions

Grade generously. Focus on what students got right, not stylistic preferences.`;
        
        userPrompt = `=== ASSIGNMENT PROMPT ===
${request.assignmentText}

=== ACADEMIC LEVEL ===
${request.gradeLevel || "College Undergraduate"}

=== GRADING INSTRUCTIONS ===
${request.gradingText || "Grade on a scale of 0-100 points."}

=== STUDENT SUBMISSION ===
${request.studentText}

Respond in this exact format:

GRADE: X/100

COMMENTS:
[Provide constructive, helpful feedback with specific observations about the submission's strengths and weaknesses. Ensure your feedback and grading are appropriate for the specified academic level. Do not include JSON, markdown formatting, or any code-like structures in your response.]`;
      }
    }
    
    // Make the API call
    const apiResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: request.temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        stream: false
      })
    });
    
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(`Perplexity API Error: ${apiResponse.status} - ${errorText}`);
    }
    
    const responseText = await apiResponse.text();
    console.log('Perplexity API response (truncated):', responseText.substring(0, 300) + '...');
    
    try {
      const data = JSON.parse(responseText) as PerplexityResponse;
      
      // Check if data.choices exists and has entries before accessing
      if (!data.choices || !data.choices.length || !data.choices[0].message) {
        console.error('Unexpected Perplexity API response format:', JSON.stringify(data));
        throw new Error('Invalid response format from Perplexity API');
      }
      
      // Get the raw LLM response without any processing
      return data.choices[0].message.content;
    } catch (error: any) {
      console.error('Failed to parse Perplexity API response:', error);
      throw new Error('Failed to parse Perplexity API response: ' + (error.message || 'Unknown error'));
    }
  } catch (error: any) {
    console.error('Error generating Perplexity response:', error);
    throw new Error('Error generating Perplexity response: ' + (error.message || 'Unknown error'));
  }
}