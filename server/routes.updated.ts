/**
 * Enhanced endpoint handlers for the API
 * With improved formatting, JSON removal, and prompt adjustments
 */
import { Request, Response, NextFunction } from 'express';
import type { Express } from 'express';
import { createServer, type Server } from 'http';
import { cleanLLMResponse } from './utils/cleanFormatting';
import { generateOpenAIResponse } from './services/openai';
import { generateAnthropicResponse } from './services/anthropic';
import { generatePerplexityResponse, PERPLEXITY_MODELS } from './services/perplexity';
import { needsChunking, processWithChunking } from './utils/chunking';
import { sendEmail } from './services/sendgrid';
import { storage } from './storage';

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint
  app.get('/api/check-services', async (_req: Request, res: Response) => {
    // Define service type with message property
    type ServiceStatus = {
      status: string;
      message?: string;
    };
    
    // Create services object with correct type
    const services: Record<string, ServiceStatus> = {
      perplexity: { status: 'unknown' },
      anthropic: { status: 'unknown' },
      openai: { status: 'unknown' },
      database: { status: 'unknown' },
    };
    
    // Test each service asynchronously
    try {
      await generatePerplexityResponse({
        model: PERPLEXITY_MODELS.SONAR_SMALL,
        temperature: 0.1,
        assignmentText: 'Testing connection',
        studentText: 'This is a test',
        gradingDepth: 'short',
      });
      services.perplexity.status = 'operational';
    } catch (error) {
      services.perplexity.status = 'error';
      services.perplexity.message = error instanceof Error ? error.message : 'Unknown error';
    }
    
    try {
      await generateAnthropicResponse({
        model: 'claude-3-haiku-20240307',
        temperature: 0.1,
        assignmentText: 'Testing connection',
        studentText: 'This is a test',
        gradingDepth: 'short',
      });
      services.anthropic.status = 'operational';
    } catch (error) {
      services.anthropic.status = 'error';
      services.anthropic.message = error instanceof Error ? error.message : 'Unknown error';
    }
    
    try {
      await generateOpenAIResponse({
        model: 'gpt-4o',
        temperature: 0.1,
        assignmentText: 'Testing connection',
        studentText: 'This is a test',
        gradingDepth: 'short',
      });
      services.openai.status = 'operational';
    } catch (error) {
      services.openai.status = 'error';
      services.openai.message = error instanceof Error ? error.message : 'Unknown error';
    }
    
    try {
      // Fetch a single user to test database connection
      await storage.getUser(1);
      services.database.status = 'operational';
    } catch (error) {
      services.database.status = 'error';
      services.database.message = error instanceof Error ? error.message : 'Unknown error';
    }
    
    res.json(services);
  });

  // Regenerate feedback endpoint with improved prompt formatting and response cleaning
  app.post('/api/regenerate-feedback', async (req: Request, res: Response) => {
    const {
      provider,
      model,
      temperature,
      assignmentText,
      gradingText,
      studentText,
      currentFeedback,
      professorFeedback,
      gradeAdjustment
    } = req.body;

    try {
      // Basic validation
      if (!provider || !assignmentText || !studentText || !professorFeedback) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      // Create a special prompt that includes the professor's feedback
      const standardInstructions = `
IMPORTANT RULES FOR YOUR RESPONSE:
1. Start with a clear numerical grade in this format: [score]/[total] 
   Example: "42/50"

2. Do NOT use letter grades (A, B, C) - only use numerical scores

3. After the grade, provide a detailed evaluation that:
   - Specifically explains WHY the grade was assigned
   - Identifies key strengths and weaknesses
   - Provides constructive criticism
   - Avoids repeating the student's text verbatim
   - Gives specific advice for improvement

4. Format your response as plain text without:
   - JSON or code blocks
   - Markdown formatting 
   - Citation numbers [1], [2], etc.
   - Bulleted or numbered lists
`;

      let promptWithFeedback;
      
      // Customize the prompt based on the grading adjustment option
      if (gradeAdjustment === 'comments_only') {
        promptWithFeedback = `
You previously provided feedback and a grade for this student submission.

The professor has provided this feedback on your evaluation: "${professorFeedback}"

Please completely re-evaluate the submission considering the professor's feedback. Focus on providing more detailed, specific, and constructive criticism.

${standardInstructions}
`;
      } else {
        promptWithFeedback = `
You previously provided feedback and a grade for this student submission.

The professor has provided this feedback on your evaluation: "${professorFeedback}"

The professor indicates that ${gradeAdjustment === 'higher' ? 'the grade should be higher' : 
                              gradeAdjustment === 'lower' ? 'the grade should be lower' : 
                              'the grade is appropriate but your analysis needs improvement'}.

Please regenerate your evaluation taking the professor's input into account.

${standardInstructions}
`;
      }

      let result: string;
      
      // Call the appropriate LLM provider with the updated prompt
      try {
        switch (provider) {
          case 'openai':
            result = await generateOpenAIResponse({
              model,
              temperature,
              assignmentText,
              gradingText: `${gradingText}\n\n${promptWithFeedback}`,
              studentText,
              referenceText: currentFeedback,
              includeCharts: false
            });
            break;
          case 'anthropic':
            result = await generateAnthropicResponse({
              model,
              temperature,
              assignmentText,
              gradingText: `${gradingText}\n\n${promptWithFeedback}`,
              studentText,
              referenceText: currentFeedback,
              includeCharts: false
            });
            break;
          case 'perplexity':
            result = await generatePerplexityResponse({
              model,
              temperature,
              assignmentText,
              gradingText: `${gradingText}\n\n${promptWithFeedback}`,
              studentText,
              referenceText: currentFeedback,
              includeCharts: false
            });
            break;
          default:
            return res.status(400).json({ message: 'Invalid provider' });
        }
      } catch (error) {
        // If any provider fails, try with Perplexity as a fallback
        console.log(`Error with ${provider}, retrying with Perplexity:`, error);
        try {
          result = await generatePerplexityResponse({
            model: PERPLEXITY_MODELS.SONAR_SMALL,
            temperature,
            assignmentText,
            gradingText: `${gradingText}\n\n${promptWithFeedback}`,
            studentText,
            referenceText: currentFeedback,
            includeCharts: false
          });
        } catch (fallbackError) {
          console.error("Fallback to Perplexity also failed:", fallbackError);
          throw new Error("Failed to process professor feedback. Please try again.");
        }
      }
      
      // Clean up the response
      const cleanResult = cleanLLMResponse(result);
      
      // Extract grade information if available
      let grade = null;
      const gradeMatch = cleanResult.match(/(\d+)\s*\/\s*(\d+)/);
      if (gradeMatch && gradeMatch[1] && gradeMatch[2]) {
        grade = `${gradeMatch[1]}/${gradeMatch[2]}`;
      }
      
      res.json({
        feedback: cleanResult,
        grade
      });
    } catch (error) {
      console.error('Error regenerating feedback:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to regenerate feedback'
      });
    }
  });

  // Regenerate comparison feedback endpoint with improved prompt and response cleaning
  app.post('/api/regenerate-comparison-feedback', async (req: Request, res: Response) => {
    try {
      const {
        provider,
        model,
        temperature,
        assignmentText,
        gradingText,
        submission1,
        submission2,
        currentComparison,
        professorFeedback,
        gradeAdjustment
      } = req.body;
      
      // Basic validation
      if (!provider || !assignmentText || !submission1 || !submission2 || !professorFeedback) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      // Process inputs similar to the comparison endpoint
      const submission1Text = typeof submission1 === 'object' && submission1 !== null
        ? submission1.content || submission1.text || JSON.stringify(submission1)
        : String(submission1);
      
      const submission2Text = typeof submission2 === 'object' && submission2 !== null
        ? submission2.content || submission2.text || JSON.stringify(submission2)
        : String(submission2);
      
      // Add student names if available
      const student1Name = typeof submission1 === 'object' && submission1 !== null && submission1.studentName
        ? submission1.studentName
        : 'Student 1';
        
      const student2Name = typeof submission2 === 'object' && submission2 !== null && submission2.studentName
        ? submission2.studentName
        : 'Student 2';
      
      // Generate a combined prompt with the professor's feedback
      const combinedStudentText = `
Submission 1 (${student1Name}):
${submission1Text}

Submission 2 (${student2Name}):
${submission2Text}
`;
      
      // Create a special prompt that includes the professor's feedback
      const standardInstructions = `
YOUR OUTPUT MUST FOLLOW THIS EXACT FORMAT:

${student1Name}: [score]/50
${student2Name}: [score]/50

DETAILED EVALUATION:
1. For each submission, provide a specific grade explanation including:
   - Direct critical assessment of the quality of the work
   - Specific strengths and weaknesses with examples
   - Clear justification for why the grade was assigned

2. Compare the two submissions, explaining why one deserves a higher grade than the other

3. CRITICAL RULES YOU MUST FOLLOW:
   - Use only numerical grades (no letter grades)
   - Do NOT repeat the student's submission text
   - Do NOT include citations or references with numbers like [1] or [2]
   - Do NOT include any JSON, code blocks, or markdown formatting
   - Format your response as plain text only

ANY RESPONSE THAT DOES NOT FOLLOW THIS FORMAT EXACTLY WILL BE REJECTED.
`;
      
      // Customize the prompt based on the grading adjustment option
      let promptWithFeedback;
      if (gradeAdjustment === 'comments_only') {
        promptWithFeedback = `
You previously compared these two student submissions and provided an analysis.

The professor has provided this feedback on your comparison: "${professorFeedback}"

Please completely re-evaluate both submissions considering the professor's feedback. Feel free to adjust both grades and comments based on this feedback.

${standardInstructions}
`;
      } else {
        promptWithFeedback = `
You previously compared these two student submissions and provided an analysis.

The professor has provided this feedback on your comparison: "${professorFeedback}"

The professor indicates that ${gradeAdjustment === 'higher' ? 'grades should be higher' : 
                            gradeAdjustment === 'lower' ? 'grades should be lower' : 
                            'grades are appropriate but your analysis needs improvement'}.

Please regenerate your comparison taking the professor's input into account.

${standardInstructions}
`;
      }
      
      let result: string;
      
      // Call the appropriate LLM provider with the updated prompt
      try {
        switch (provider) {
          case 'openai':
            result = await generateOpenAIResponse({
              model,
              temperature,
              assignmentText,
              gradingText: `${gradingText}\n\n${promptWithFeedback}`,
              studentText: combinedStudentText,
              referenceText: currentComparison,
              includeCharts: false
            });
            break;
          case 'anthropic':
            result = await generateAnthropicResponse({
              model,
              temperature,
              assignmentText,
              gradingText: `${gradingText}\n\n${promptWithFeedback}`,
              studentText: combinedStudentText,
              referenceText: currentComparison,
              includeCharts: false
            });
            break;
          case 'perplexity':
            result = await generatePerplexityResponse({
              model,
              temperature,
              assignmentText,
              gradingText: `${gradingText}\n\n${promptWithFeedback}`,
              studentText: combinedStudentText,
              referenceText: currentComparison,
              includeCharts: false
            });
            break;
          default:
            return res.status(400).json({ message: 'Invalid provider' });
        }
      } catch (error) {
        // If any provider fails, try with Perplexity as a fallback
        console.log(`Error with ${provider}, retrying with Perplexity:`, error);
        try {
          result = await generatePerplexityResponse({
            model: PERPLEXITY_MODELS.SONAR_SMALL,
            temperature,
            assignmentText,
            gradingText: `${gradingText}\n\n${promptWithFeedback}`,
            studentText: combinedStudentText,
            referenceText: currentComparison,
            includeCharts: false
          });
        } catch (fallbackError) {
          console.error("Fallback to Perplexity also failed:", fallbackError);
          throw new Error("Failed to process professor feedback. Please try again.");
        }
      }
      
      // Clean up the response to remove markdown, JSON, and other formatting
      const cleanResult = cleanLLMResponse(result);
      
      // Format the raw text into a structure the client expects
      // Look for grade patterns in the text - try to extract grades for each student
      let student1Grade = 'See comparison report';
      let student2Grade = 'See comparison report';
      
      // Check if the result contains any grade patterns like "45/50" or "Grade: 45/50"
      const gradePatterns = [
        new RegExp(`${student1Name}[^0-9]+(\\d+)[\\s]*/[\\s]*(\\d+)`, 'i'),  // Match "Student Name: 45/50"
        new RegExp(`submission[\\s]*1[^0-9]+(\\d+)[\\s]*/[\\s]*(\\d+)`, 'i'), // Match "Submission 1: 45/50"
        new RegExp(`(\\d+)[\\s]*/[\\s]*(\\d+)[^a-z]+(for|to)[^a-z]+${student1Name}`, 'i'), // Match "45/50 for Student Name"
      ];
      
      const grade2Patterns = [
        new RegExp(`${student2Name}[^0-9]+(\\d+)[\\s]*/[\\s]*(\\d+)`, 'i'),  // Match "Student Name: 45/50"
        new RegExp(`submission[\\s]*2[^0-9]+(\\d+)[\\s]*/[\\s]*(\\d+)`, 'i'), // Match "Submission 2: 45/50"
        new RegExp(`(\\d+)[\\s]*/[\\s]*(\\d+)[^a-z]+(for|to)[^a-z]+${student2Name}`, 'i'), // Match "45/50 for Student Name"
      ];
      
      // Try to find grades for each student
      for (const pattern of gradePatterns) {
        const match = cleanResult.match(pattern);
        if (match && match[1] && match[2]) {
          student1Grade = `${match[1]}/${match[2]}`;
          break;
        }
      }
      
      // First try the regular patterns for student 2
      for (const pattern of grade2Patterns) {
        const match = cleanResult.match(pattern);
        if (match && match[1] && match[2]) {
          student2Grade = `${match[1]}/${match[2]}`;
          break;
        }
      }
      
      // If we still don't have a grade for student 2, look for any other grade pattern
      if (student2Grade === 'See comparison report') {
        // Find all grade patterns in the text (like "45/50")
        const allGradeMatches = cleanResult.match(/(\d+)\s*\/\s*(\d+)/g);
        
        // If we have multiple grade patterns and one is already assigned to student 1,
        // the next distinct one is likely for student 2
        if (allGradeMatches && allGradeMatches.length >= 2) {
          // Find a grade that's different from student 1's grade
          for (const gradeMatch of allGradeMatches) {
            if (gradeMatch !== student1Grade) {
              const parts = gradeMatch.match(/(\d+)\s*\/\s*(\d+)/);
              if (parts && parts[1] && parts[2]) {
                student2Grade = `${parts[1]}/${parts[2]}`;
                break;
              }
            }
          }
        }
      }
      
      // Create the response object
      const formattedResponse = {
        individualGrades: {
          submission1: {
            grade: student1Grade,
            feedback: cleanResult
          },
          submission2: {
            grade: student2Grade,
            feedback: cleanResult
          }
        },
        comparison: {
          report: cleanResult
        }
      };
      
      res.json(formattedResponse);
    } catch (error) {
      console.error('Error regenerating comparison feedback:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to regenerate comparison feedback'
      });
    }
  });
  
  // Compare assignments endpoint with improved prompt and response cleaning
  app.post('/api/compare-assignments', async (req: Request, res: Response) => {
    const {
      provider,
      model,
      temperature,
      assignmentText,
      gradingText,
      submission1,
      submission2,
      clearCache
    } = req.body;
    
    try {
      // Basic validation
      if (!provider || !assignmentText || !submission1 || !submission2) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      // Handle different input formats for submissions
      const submission1Text = typeof submission1 === 'object' && submission1 !== null
        ? submission1.content || submission1.text || JSON.stringify(submission1)
        : String(submission1);
      
      const submission2Text = typeof submission2 === 'object' && submission2 !== null
        ? submission2.content || submission2.text || JSON.stringify(submission2)
        : String(submission2);
      
      // Add student names if available
      const student1Name = typeof submission1 === 'object' && submission1 !== null && submission1.studentName
        ? submission1.studentName
        : 'Student 1';
        
      const student2Name = typeof submission2 === 'object' && submission2 !== null && submission2.studentName
        ? submission2.studentName
        : 'Student 2';
      
      // Generate a combined prompt from the two submissions and instructions
      const combinedStudentText = `
Submission 1 (${student1Name}):
${submission1Text}

Submission 2 (${student2Name}):
${submission2Text}
`;

      // Add enhanced grading instructions
      const enhancedGradingText = gradingText ? 
        `${gradingText}

YOUR OUTPUT MUST FOLLOW THIS EXACT FORMAT:

${student1Name}: [score]/50
${student2Name}: [score]/50

DETAILED EVALUATION:
1. For each submission, provide a specific grade explanation including:
   - Direct critical assessment of the quality of the work
   - Specific strengths and weaknesses with examples
   - Clear justification for why the grade was assigned

2. Compare the two submissions, explaining why one deserves a higher grade than the other

3. CRITICAL RULES YOU MUST FOLLOW:
   - Use only numerical grades (no letter grades)
   - Do NOT repeat the student's submission text
   - Do NOT include citations or references with numbers like [1] or [2]
   - Do NOT include any JSON, code blocks, or markdown formatting
   - Format your response as plain text only

ANY RESPONSE THAT DOES NOT FOLLOW THIS FORMAT EXACTLY WILL BE REJECTED.` 
        : 
        `YOUR OUTPUT MUST FOLLOW THIS EXACT FORMAT:

${student1Name}: [score]/50
${student2Name}: [score]/50

DETAILED EVALUATION:
1. For each submission, provide a specific grade explanation including:
   - Direct critical assessment of the quality of the work
   - Specific strengths and weaknesses with examples
   - Clear justification for why the grade was assigned

2. Compare the two submissions, explaining why one deserves a higher grade than the other

3. CRITICAL RULES YOU MUST FOLLOW:
   - Use only numerical grades (no letter grades)
   - Do NOT repeat the student's submission text
   - Do NOT include citations or references with numbers like [1] or [2]
   - Do NOT include any JSON, code blocks, or markdown formatting
   - Format your response as plain text only

ANY RESPONSE THAT DOES NOT FOLLOW THIS FORMAT EXACTLY WILL BE REJECTED.`;

      let result: string = '';
      
      // Call the appropriate LLM provider with fallbacks
      let errorMessages = [];
      
      // Try the selected provider first
      try {
        switch (provider) {
          case 'openai':
            result = await generateOpenAIResponse({
              model,
              temperature,
              assignmentText,
              gradingText: enhancedGradingText,
              studentText: combinedStudentText,
              includeCharts: false
            });
            break;
          case 'anthropic':
            result = await generateAnthropicResponse({
              model,
              temperature,
              assignmentText,
              gradingText: enhancedGradingText,
              studentText: combinedStudentText,
              includeCharts: false
            });
            break;
          case 'perplexity':
            result = await generatePerplexityResponse({
              model,
              temperature,
              assignmentText,
              gradingText: enhancedGradingText,
              studentText: combinedStudentText,
              includeCharts: false
            });
            break;
          default:
            return res.status(400).json({ message: 'Invalid provider' });
        }
      } catch (error) {
        // Store the original error
        const originalError = error instanceof Error ? error.message : 'Unknown error';
        errorMessages.push(`First attempt with ${provider} failed: ${originalError}`);
        console.log(`Primary provider ${provider} failed, trying fallbacks...`);
        
        // Try fallback providers
        // Only try fallbacks that weren't the original choice
        const fallbacks = ['perplexity', 'anthropic', 'openai'].filter(p => p !== provider);
        
        for (const fallbackProvider of fallbacks) {
          try {
            console.log(`Trying fallback provider: ${fallbackProvider}`);
            
            if (fallbackProvider === 'anthropic') {
              result = await generateAnthropicResponse({
                model: 'claude-3-haiku-20240307', // Use reliable model
                temperature,
                assignmentText,
                gradingText: enhancedGradingText,
                studentText: combinedStudentText,
                includeCharts: false
              });
              break;
            } else if (fallbackProvider === 'perplexity') {
              result = await generatePerplexityResponse({
                model: PERPLEXITY_MODELS.SONAR_SMALL, // Use reliable model
                temperature,
                assignmentText,
                gradingText: enhancedGradingText,
                studentText: combinedStudentText,
                includeCharts: false
              });
              break;
            } else if (fallbackProvider === 'openai') {
              result = await generateOpenAIResponse({
                model: 'gpt-4o', // Use reliable model
                temperature,
                assignmentText,
                gradingText: enhancedGradingText,
                studentText: combinedStudentText,
                includeCharts: false
              });
              break;
            }
          } catch (e) {
            const fbError = e instanceof Error ? e.message : 'Unknown error';
            errorMessages.push(`Fallback attempt with ${fallbackProvider} failed: ${fbError}`);
            console.log(`Fallback provider ${fallbackProvider} failed: ${fbError}`);
            continue;
          }
        }
        
        // If all fallbacks failed
        if (!result) {
          console.error("All providers failed:", errorMessages);
          throw new Error(`All providers failed. Please try again. Details: ${errorMessages.join('; ')}`);
        }
      }
      
      // Clean up formatting, JSON, code blocks
      const cleanResult = cleanLLMResponse(result);
      
      // Format the raw text into a structure the client expects
      let student1Grade = 'See comparison report';
      let student2Grade = 'See comparison report';
      
      // Check if the result contains any grade patterns like "45/50" or "Grade: 45/50"
      const gradePatterns = [
        new RegExp(`${student1Name}[^0-9]+(\\d+)[\\s]*/[\\s]*(\\d+)`, 'i'),  // Match "Student Name: 45/50"
        new RegExp(`submission[\\s]*1[^0-9]+(\\d+)[\\s]*/[\\s]*(\\d+)`, 'i'), // Match "Submission 1: 45/50"
        new RegExp(`(\\d+)[\\s]*/[\\s]*(\\d+)[^a-z]+(for|to)[^a-z]+${student1Name}`, 'i'), // Match "45/50 for Student Name"
      ];
      
      const grade2Patterns = [
        new RegExp(`${student2Name}[^0-9]+(\\d+)[\\s]*/[\\s]*(\\d+)`, 'i'),  // Match "Student Name: 45/50" 
        new RegExp(`submission[\\s]*2[^0-9]+(\\d+)[\\s]*/[\\s]*(\\d+)`, 'i'), // Match "Submission 2: 45/50"
        new RegExp(`(\\d+)[\\s]*/[\\s]*(\\d+)[^a-z]+(for|to)[^a-z]+${student2Name}`, 'i'), // Match "45/50 for Student Name"
      ];
      
      // Try to find grades for each student
      for (const pattern of gradePatterns) {
        const match = cleanResult.match(pattern);
        if (match && match[1] && match[2]) {
          student1Grade = `${match[1]}/${match[2]}`;
          break;
        }
      }
      
      for (const pattern of grade2Patterns) {
        const match = cleanResult.match(pattern);
        if (match && match[1] && match[2]) {
          student2Grade = `${match[1]}/${match[2]}`;
          break;
        }
      }
      
      // If we still don't have a grade for student 2, look for any other grade pattern
      if (student2Grade === 'See comparison report') {
        // Find all grade patterns in the text (like "45/50")
        const allGradeMatches = cleanResult.match(/(\d+)\s*\/\s*(\d+)/g);
        
        // If we have multiple grade patterns and one is already assigned to student 1,
        // the next distinct one is likely for student 2
        if (allGradeMatches && allGradeMatches.length >= 2) {
          // Find a grade that's different from student 1's grade
          for (const gradeMatch of allGradeMatches) {
            if (gradeMatch !== student1Grade) {
              const parts = gradeMatch.match(/(\d+)\s*\/\s*(\d+)/);
              if (parts && parts[1] && parts[2]) {
                student2Grade = `${parts[1]}/${parts[2]}`;
                break;
              }
            }
          }
        }
      }
      
      // Create the response object
      const formattedResponse = {
        individualGrades: {
          submission1: {
            grade: student1Grade,
            feedback: cleanResult
          },
          submission2: {
            grade: student2Grade,
            feedback: cleanResult
          }
        },
        comparison: {
          report: cleanResult
        }
      };
      
      res.json(formattedResponse);
    } catch (error) {
      console.error('Error comparing assignments:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to compare assignments'
      });
    }
  });
  
  // Get all assignments endpoint
  app.get('/api/assignments', async (req: Request, res: Response) => {
    try {
      const userId = 1; // Fixed user ID for now
      console.log(`Fetching assignments for user ID: ${userId}`);
      const assignments = await storage.getAssignmentsByUserId(userId);
      console.log(`Found ${assignments.length} assignments`);
      res.json(assignments);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      res.status(500).json({ message: 'Failed to fetch assignments' });
    }
  });

  // Get student grades summary
  app.get('/api/student-grades', async (_req: Request, res: Response) => {
    try {
      const gradeRecords = await storage.getAllSubmissionsWithGrades();
      res.json(gradeRecords);
    } catch (error) {
      console.error('Error fetching student grades:', error);
      res.status(500).json({ message: 'Failed to fetch student grades' });
    }
  });

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error in route handler:', err);
    res.status(500).json({
      message: 'An unexpected error occurred',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}