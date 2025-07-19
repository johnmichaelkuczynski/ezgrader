import Anthropic from '@anthropic-ai/sdk';

export interface AnthropicRequest {
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

/**
 * Generate a response from Anthropic API
 */
export async function generateAnthropicResponse(request: AnthropicRequest): Promise<string> {
  try {
    // Get API key from environment
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not set in environment variables');
    }
    
    // Initialize the Anthropic client
    const anthropic = new Anthropic({
      apiKey: apiKey
    });
    
    // The newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
    // Always use this model for best and most up-to-date performance
    const defaultModel = 'claude-3-7-sonnet-20250219';
    const modelToUse = request.model || defaultModel;
    
    console.log(`Using Anthropic model: ${modelToUse}`);
    
    // Define system and user prompts based on the request type
    let systemPrompt = '';
    let userPrompt = '';
    
    // Handle exemplar generation requests
    if (request.isExemplar) {
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

Your response should represent a model submission that would earn full marks. 

CRITICAL WORD COUNT REQUIREMENT: If the assignment specifies a word count requirement (e.g., "3,000–4,000 words", "minimum 2000 words", etc.), you MUST meet or exceed that requirement. Do not produce abbreviated or summary responses - write a complete, comprehensive academic paper that fully satisfies the specified length.

DO NOT include any JSON, markdown formatting, section headers, or structural elements in your response. Write in natural, fluent academic prose as if you were a top student submitting a complete assignment.`;
    } else {
      // Grading request
      if (request.instructionsText) {
        // If override instructions were provided, use them directly with NO modifications
        systemPrompt = request.instructionsText;
        userPrompt = request.studentText || '';
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
    const response = await anthropic.messages.create({
      model: modelToUse,
      max_tokens: 4000,
      temperature: request.temperature,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
    });
    
    // Process and return the LLM response 
    if (response.content && response.content.length > 0) {
      // Get the content text
      let content = '';
      
      // Check if content[0] has text property
      if ('text' in response.content[0]) {
        content = response.content[0].text;
      } else {
        // Handle other response formats if needed
        content = JSON.stringify(response.content[0]);
      }
      
      return content;
    }
    return 'No content returned from Anthropic API';
  } catch (error) {
    console.error('Error generating Anthropic response:', error);
    throw error;
  }
}