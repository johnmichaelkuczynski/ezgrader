import OpenAI from 'openai';

export interface OpenAIRequest {
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
 * Generate a response from OpenAI API
 */
export async function generateOpenAIResponse(request: OpenAIRequest): Promise<string> {
  try {
    // Get API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not set in environment variables');
    }
    
    // Initialize the OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey
    });
    
    // The newest OpenAI model is "gpt-4o" which was released May 13, 2024
    // Always use this model for best and most up-to-date performance
    const defaultModel = 'gpt-4o';
    const modelToUse = request.model || defaultModel;
    
    console.log(`Using OpenAI model: ${modelToUse}`);
    
    // Define system and user messages based on the request type
    let systemMessage = '';
    let userMessage = '';
    
    // Handle exemplar generation requests
    if (request.isExemplar) {
      systemMessage = "You are a professor's exemplar creator that produces high-quality example submissions.";
      
      const annotationsInstructions = request.includeAnnotations 
        ? "Please include annotations explaining why specific elements make this an exemplary submission."
        : "";
        
      userMessage = `
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
        systemMessage = request.instructionsText;
        userMessage = request.studentText || '';
      } else {
        // Standard grading request
        systemMessage = `You are a professional academic grader who prioritizes correctness over style. Grade primarily on substance (90%) and minimally on presentation (10%).

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
        
        userMessage = `=== ASSIGNMENT PROMPT ===
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
    const response = await openai.chat.completions.create({
      model: modelToUse,
      temperature: request.temperature,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage }
      ]
    });
    
    // Return the raw response content
    if (response.choices.length > 0 && response.choices[0].message.content) {
      return response.choices[0].message.content;
    }
    
    throw new Error('No content returned from OpenAI API');
  } catch (error: any) {
    console.error('Error generating OpenAI response:', error);
    throw new Error('Error generating OpenAI response: ' + (error.message || 'Unknown error'));
  }
}