import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAssignmentSchema, insertSubmissionSchema, insertGradingResultSchema } from "@shared/schema";
import { detectAIContent } from "./services/gptzero";
import { generateOpenAIResponse } from "./services/openai";
import { generateAnthropicResponse } from "./services/anthropic";
import { generatePerplexityResponse, PERPLEXITY_MODELS } from "./services/perplexity";
import { sendEmail } from "./services/sendgrid";
import { needsChunking, processWithChunking } from "./utils/chunking";

export async function registerRoutes(app: Express): Promise<Server> {
  // Route to regenerate feedback based on professor's input
  app.post('/api/regenerate-feedback', async (req: Request, res: Response) => {
    try {
      const {
        provider,
        model,
        temperature,
        assignmentText,
        gradingText,
        studentText,
        currentGrade,
        currentFeedback,
        professorFeedback,
        gradeAdjustment
      } = req.body;
      
      // Pass through the professor's feedback directly without any modification
      let systemPrompt;
      
      // Customize the prompt based on the grading adjustment option
      if (gradeAdjustment === 'comments_only') {
        systemPrompt = `
Here is the original student submission, assignment text, grading instructions, and the initial grade you gave: ${currentGrade}.

The professor has provided this feedback: "${professorFeedback}"

Please completely re-evaluate this submission. Consider both the grade and the comments based on the professor's feedback. Feel free to adjust the grade up or down if warranted by the reevaluation.
`;
      } else {
        systemPrompt = `
Here is the original student submission, assignment text, grading instructions, and the initial grade you gave: ${currentGrade}.

The professor has provided this feedback: "${professorFeedback}"

The professor indicates the grade should be ${gradeAdjustment === 'higher' ? 'higher' : gradeAdjustment === 'lower' ? 'lower' : 'kept the same'}.

Please regenerate your feedback taking the professor's input into account.
`;
      }

      let response;
      
      // Call the appropriate LLM service based on provider
      if (provider === 'openai') {
        response = await generateOpenAIResponse({
          model,
          temperature: parseFloat(temperature),
          assignmentText,
          gradingText,
          studentText,
          instructionsText: systemPrompt,
          referenceText: currentFeedback,
          isExemplar: false,
        });
      } else if (provider === 'anthropic') {
        response = await generateAnthropicResponse({
          model,
          temperature: parseFloat(temperature),
          assignmentText,
          gradingText,
          studentText,
          instructionsText: systemPrompt,
          referenceText: currentFeedback,
          isExemplar: false,
        });
      } else if (provider === 'perplexity') {
        response = await generatePerplexityResponse({
          model,
          temperature: parseFloat(temperature),
          assignmentText,
          gradingText,
          studentText,
          instructionsText: systemPrompt,
          referenceText: currentFeedback,
          isExemplar: false,
        });
      } else {
        return res.status(400).send('Invalid provider selected');
      }
      
      res.send(response);
    } catch (error) {
      console.error('Error regenerating feedback:', error);
      res.status(500).send(`Error regenerating feedback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
  
  // API route for AI detection
  app.post('/api/detect-ai', async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ message: 'Text is required' });
      }
      
      const result = await detectAIContent(text);
      res.json(result);
    } catch (error) {
      console.error('Error detecting AI:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to detect AI content'
      });
    }
  });
  
  // API route for grading with LLMs - IMPLEMENTING REPLIT CHUNKING SPECIFICATION
  app.post('/api/grade', async (req, res) => {
    try {
      const { 
        provider, 
        model, 
        temperature, 
        assignmentText, 
        gradingText, 
        studentText,
        gradingDepth,
        includeCharts 
      } = req.body;
      
      if (!provider || !model || !assignmentText || !gradingText || !studentText) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      // Select provider and model
      let effectiveProvider = provider;
      let effectiveModel = model;
      
      // Convert gradingDepth to the expected type
      const typedGradingDepth = gradingDepth as 'short' | 'medium' | 'long' | undefined;
      
      // For extremely large documents (>50K words), force Perplexity with large context model
      const totalWordCount = (assignmentText.split(/\\s+/).length + 
                             gradingText.split(/\\s+/).length + 
                             studentText.split(/\\s+/).length);
                             
      console.log(`Total word count for assignment: ${totalWordCount}`);
      
      if (totalWordCount > 50000) {
        console.log(`Assignment is very large (${totalWordCount} words). Forcing Perplexity provider.`);
        effectiveProvider = 'perplexity';
        effectiveModel = PERPLEXITY_MODELS.SONAR_SMALL; // Force large context model
      }
      
      let result: string;
      
      // Check if we need to use chunking based on token estimation
      const shouldUseChunking = needsChunking(effectiveProvider, assignmentText, gradingText, studentText);
      
      try {
        if (shouldUseChunking) {
          // Use the chunking implementation for large submissions
          console.log("Using chunking for large submission according to Replit specification");
          
          result = await processWithChunking(
            effectiveProvider,
            effectiveModel,
            temperature,
            assignmentText,
            gradingText,
            studentText,
            typedGradingDepth
          );
        } else {
          // Standard processing for normal-sized submissions
          console.log("Submission size is within normal limits, no chunking needed");
          
          // Call the appropriate LLM provider
          switch (effectiveProvider) {
            case 'openai':
              result = await generateOpenAIResponse({
                model: effectiveModel,
                temperature,
                assignmentText,
                gradingText,
                studentText,
                gradingDepth: typedGradingDepth,
                includeCharts: false // Disable charts for pure text output
              });
              break;
            case 'anthropic':
              result = await generateAnthropicResponse({
                model: effectiveModel,
                temperature,
                assignmentText,
                gradingText,
                studentText,
                gradingDepth: typedGradingDepth,
                includeCharts: false // Disable charts for pure text output
              });
              break;
            case 'perplexity':
              result = await generatePerplexityResponse({
                model: effectiveModel,
                temperature,
                assignmentText,
                gradingText,
                studentText,
                gradingDepth: typedGradingDepth,
                includeCharts: false // Disable charts for pure text output
              });
              break;
            default:
              // Fallback to Perplexity for any invalid provider
              console.log(`Invalid provider ${provider}, falling back to Perplexity`);
              result = await generatePerplexityResponse({
                model: PERPLEXITY_MODELS.SONAR_SMALL, // Default to large context model
                temperature,
                assignmentText,
                gradingText,
                studentText,
                gradingDepth: typedGradingDepth,
                includeCharts: false
              });
          }
        }
      } catch (error: any) {
        // If any provider fails (e.g., OpenAI quota limits), retry with Perplexity
        if (effectiveProvider !== 'perplexity') {
          console.log(`Error with ${effectiveProvider}, retrying with Perplexity: ${error.message}`);
          try {
            // Try again with Perplexity
            if (shouldUseChunking) {
              result = await processWithChunking(
                'perplexity',
                PERPLEXITY_MODELS.SONAR_SMALL,
                temperature,
                assignmentText,
                gradingText,
                studentText,
                typedGradingDepth
              );
            } else {
              result = await generatePerplexityResponse({
                model: PERPLEXITY_MODELS.SONAR_SMALL,
                temperature,
                assignmentText,
                gradingText,
                studentText,
                gradingDepth: typedGradingDepth,
                includeCharts: false
              });
            }
          } catch (fallbackError) {
            console.error("Fallback to Perplexity also failed:", fallbackError);
            throw new Error("Submission too long to process. Please shorten or contact technical support.");
          }
        } else {
          // If Perplexity itself failed, return appropriate error
          throw new Error("Submission too long to process. Please shorten or contact technical support.");
        }
      }
      
      console.log(`Received response from provider: ${effectiveProvider}. Length: ${result?.length || 0}`);
      
      // Process result to remove any JSON formatting, quotes, or markdown-like structure
      // First, check if it's accidentally wrapped in JSON
      let cleanResult = result;
      
      try {
        // Try to parse the result as JSON, in case the LLM returned JSON despite instructions
        const parsedResult = JSON.parse(result);
        
        // If parsing succeeded, extract the 'result' field if it exists, or text content
        if (parsedResult && typeof parsedResult === 'object') {
          if (parsedResult.result) {
            cleanResult = parsedResult.result;
          } else if (parsedResult.text) {
            cleanResult = parsedResult.text;
          } else if (parsedResult.content) {
            cleanResult = parsedResult.content;
          } else if (parsedResult.message && parsedResult.message.content) {
            cleanResult = parsedResult.message.content;
          }
        }
      } catch (e) {
        // If parsing failed, it wasn't JSON, which is good
        console.log("Response was not JSON (good)");
      }
      
      // Remove any markdown headers or formatting - more thorough cleaning
      cleanResult = cleanResult
        .replace(/^```json\\s*/, '')
        .replace(/```$/, '')
        .replace(/^```\\s*/, '')
        .replace(/#{1,6}\s*/g, '') // Remove all header markdown (# through ######)
        .replace(/\*{1,3}/g, '')   // Remove all asterisks for bold/italic formatting 
        .replace(/_{1,3}/g, '')    // Remove all underscores for formatting
        .replace(/`{1,3}/g, '')    // Remove all backticks for code formatting
        .replace(/\n\s*[-+*]\s+/g, '\n') // Remove list markers
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Replace markdown links with just the text
      
      // Check if the result still has JSON structure after cleaning
      if (cleanResult.includes('{"') || cleanResult.includes('": "')) {
        console.log("WARNING: Response still appears to contain JSON structure. Attempting more aggressive cleaning.");
        
        // Try to extract just the text content if it's JSON disguised as text
        try {
          // Match JSON objects without 's' flag which requires ES2018
          const jsonMatches = cleanResult.match(/\\{[\\s\\S]*\\}/);
          if (jsonMatches && jsonMatches[0]) {
            try {
              const extractedJson = JSON.parse(jsonMatches[0]);
              if (extractedJson.result) {
                cleanResult = extractedJson.result;
              } else if (extractedJson.text) {
                cleanResult = extractedJson.text;
              } else if (extractedJson.content) {
                cleanResult = extractedJson.content;
              } else {
                // If we can't find a specific field, join all string values
                cleanResult = Object.values(extractedJson)
                  .filter(v => typeof v === 'string')
                  .join('\\n\\n');
              }
            } catch (e) {
              // Extraction failed, keep original cleaned text
            }
          }
        } catch (e) {
          // Couldn't extract JSON, keep the original cleaned text
        }
      }
      
      // Return plain text instead of JSON
      res.setHeader('Content-Type', 'text/plain');
      res.send(cleanResult);
    } catch (error: any) {
      console.error('Error generating grade:', error);
      res.status(500).json({ 
        message: error.message || 'Error: Failed to grade assignment. Please try again or use a shorter submission.'
      });
    }
  });

  // API route for exemplar generation and paper improvement
  app.post('/api/exemplar', async (req, res) => {
    try {
      const { 
        provider, 
        model, 
        temperature, 
        assignmentText, 
        referenceText,
        instructionsText,
        includeAnnotations,
        isImprovement 
      } = req.body;
      
      console.log('Received request for', isImprovement ? 'paper improvement' : 'exemplar generation');
      console.log('Request data:', { provider, model, hasReferenceText: !!referenceText, hasInstructions: !!instructionsText });
      
      if (!provider || !model) {
        return res.status(400).json({ message: 'Missing required fields (provider, model)' });
      }

      let result;
      
      // Call the appropriate LLM provider
      switch (provider) {
        case 'openai':
          result = await generateOpenAIResponse({
            model,
            temperature,
            assignmentText: assignmentText || '',
            referenceText: referenceText || '',
            instructionsText: instructionsText || '',
            isExemplar: true,
            includeAnnotations: includeAnnotations || false
          });
          break;
          
        case 'anthropic':
          result = await generateAnthropicResponse({
            model,
            temperature,
            assignmentText: assignmentText || '',
            referenceText: referenceText || '',
            instructionsText: instructionsText || '',
            isExemplar: true,
            includeAnnotations: includeAnnotations || false
          });
          break;
          
        case 'perplexity':
          result = await generatePerplexityResponse({
            model,
            temperature,
            assignmentText: assignmentText || '',
            referenceText: referenceText || '',
            instructionsText: instructionsText || '',
            isExemplar: true,
            includeAnnotations: includeAnnotations || false
          });
          break;
          
        default:
          return res.status(400).json({ message: 'Invalid provider' });
      }
      
      res.json({ result });
    } catch (error) {
      console.error('Error generating exemplar:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to generate exemplar'
      });
    }
  });
  // API endpoint for administrative CRUD operations
  
  // API endpoint to send email
  app.post('/api/send-email', async (req, res) => {
    try {
      const { to, subject, text, html } = req.body;
      
      if (!to || !subject) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      // Send the email
      await sendEmail({
        to,
        subject,
        text: text || 'Your grading feedback is attached.',
        html: html || '<p>Your grading feedback is attached.</p>'
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error sending email:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to send email'
      });
    }
  });
  
  // API endpoint to get all assignments
  app.get('/api/assignments', async (req, res) => {
    try {
      // Temporary user ID for development
      const userId = 1;
      
      console.log('Fetching assignments for user ID:', userId);
      
      // Get all assignments for this user
      const assignments = await storage.getAssignmentsByUserId(userId);
      
      console.log(`Found ${assignments.length} assignments`);
      
      res.json(assignments);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to fetch assignments'
      });
    }
  });
  
  // API endpoint to get a specific assignment
  app.get('/api/assignments/:id', async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.id);
      
      if (isNaN(assignmentId)) {
        return res.status(400).json({ message: 'Invalid assignment ID' });
      }
      
      // Get the assignment
      const assignment = await storage.getAssignment(assignmentId);
      
      if (!assignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }
      
      res.json(assignment);
    } catch (error) {
      console.error('Error fetching assignment:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to fetch assignment'
      });
    }
  });
  
  // API endpoint to create a new assignment
  app.post('/api/assignments', async (req, res) => {
    try {
      const result = insertAssignmentSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ message: 'Invalid assignment data', errors: result.error.errors });
      }
      
      // Create the assignment
      const assignment = await storage.createAssignment({
        ...result.data,
        userId: 1  // Temporary user ID for development
      });
      
      res.status(201).json(assignment);
    } catch (error) {
      console.error('Error creating assignment:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to create assignment'
      });
    }
  });
  
  // API endpoint to update an assignment
  app.put('/api/assignments/:id', async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.id);
      
      if (isNaN(assignmentId)) {
        return res.status(400).json({ message: 'Invalid assignment ID' });
      }
      
      const result = insertAssignmentSchema.partial().safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ message: 'Invalid assignment data', errors: result.error.errors });
      }
      
      // Update the assignment
      const assignment = await storage.updateAssignment(assignmentId, result.data);
      
      if (!assignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }
      
      res.json(assignment);
    } catch (error) {
      console.error('Error updating assignment:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to update assignment'
      });
    }
  });
  
  // API endpoint to delete an assignment
  app.delete('/api/assignments/:id', async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.id);
      
      if (isNaN(assignmentId)) {
        return res.status(400).json({ message: 'Invalid assignment ID' });
      }
      
      // Delete the assignment
      const success = await storage.deleteAssignment(assignmentId);
      
      if (!success) {
        return res.status(404).json({ message: 'Assignment not found' });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error('Error deleting assignment:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to delete assignment'
      });
    }
  });
  
  // API routes for grading results
  app.post('/api/grading-results', async (req, res) => {
    try {
      const result = insertGradingResultSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ message: 'Invalid grading result data', errors: result.error.errors });
      }
      
      const gradingResult = await storage.createGradingResult(result.data);
      res.status(201).json(gradingResult);
    } catch (error) {
      console.error('Error creating grading result:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to create grading result'
      });
    }
  });
  
  // API endpoint to save student grade and feedback
  app.post('/api/save-grade', async (req, res) => {
    try {
      console.log('Saving student grade:', req.body);
      const { studentName, assignmentId, grade, feedback, llmProvider, llmModel, temperature } = req.body;
      
      if (!studentName || !grade || !feedback) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      // Default assignment ID if not provided
      const actualAssignmentId = assignmentId || 1;
      
      // First create a submission record
      const submission = await storage.createSubmission({
        assignmentId: actualAssignmentId,
        studentName,
        content: feedback.substring(0, 200) + '...' // Store just a preview in the submission
      });
      
      console.log('Created submission:', submission);
      
      // Then create a grading result with the full feedback
      const gradingResult = await storage.createGradingResult({
        submissionId: submission.id,
        llmProvider: llmProvider || 'manual',
        llmModel: llmModel || 'n/a',
        temperature: temperature || 0,
        grade,
        results: feedback,
        emailSent: false
      });
      
      console.log('Created grading result:', gradingResult);
      
      res.status(201).json({ submission, gradingResult });
    } catch (error) {
      console.error('Error saving grade:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to save grade'
      });
    }
  });
  
  // API endpoint to get all student grades
  app.get('/api/student-grades', async (req, res) => {
    try {
      // Get all submissions with their corresponding grading results
      const submissions = await storage.getAllSubmissionsWithGrades();
      
      res.json(submissions);
    } catch (error) {
      console.error('Error fetching student grades:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to fetch student grades'
      });
    }
  });
  
  // API endpoint to check if services are available
  app.get('/api/check-services', async (_req: Request, res: Response) => {
    console.log('Checking services...');
    const services: Record<string, string> = {};
    
    // Check OpenAI
    try {
      console.log('Testing OpenAI API connection...');
      await generateOpenAIResponse({
        model: 'gpt-4o',
        temperature: 0.7,
        assignmentText: 'Test assignment',
        gradingText: 'Test grading',
        studentText: 'Test student submission'
      });
      console.log('OpenAI is available');
      services.openai = 'available';
    } catch (error) {
      console.error('OpenAI test failed:', error);
      services.openai = `error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
    
    // Check Anthropic
    try {
      console.log('Testing Anthropic API connection...');
      await generateAnthropicResponse({
        model: 'claude-3-haiku-20240307',
        temperature: 0.7,
        assignmentText: 'Test assignment',
        gradingText: 'Test grading',
        studentText: 'Test student submission'
      });
      console.log('Anthropic is available');
      services.anthropic = 'available';
    } catch (error) {
      console.error('Anthropic test failed:', error);
      services.anthropic = `error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
    
    // Check Perplexity
    try {
      console.log('Testing Perplexity API connection...');
      await generatePerplexityResponse({
        model: PERPLEXITY_MODELS.SONAR_SMALL,
        temperature: 0.7,
        assignmentText: 'Test assignment',
        gradingText: 'Test grading',
        studentText: 'Test student submission'
      });
      console.log('Perplexity is available');
      services.perplexity = 'available';
    } catch (error) {
      console.error('Perplexity test failed:', error);
      services.perplexity = `error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
    
    res.json(services);
  });
  
  // API endpoint for professor feedback on comparison results
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
      let promptWithFeedback;
      
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
      
      // Remove any markdown formatting from the result
      let cleanResult = result
        .replace(/#{1,6}\s*(.*?)(?=\n|$)/g, '$1') // Remove all header markdown (# through ######) but keep the content
        .replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')   // Remove all asterisks for bold/italic formatting but keep the content
        .replace(/_{1,3}(.*?)_{1,3}/g, '$1')     // Remove all underscores for formatting but keep the content
        .replace(/`{1,3}(.*?)`{1,3}/g, '$1')     // Remove all backticks for code formatting but keep the content
        .replace(/\n\s*[-+*]\s+/g, '\n') // Remove list markers
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Replace markdown links with just the text
        .replace(/\n{3,}/g, '\n\n'); // Replace multiple consecutive newlines with just two
        
      // Additional cleanup for common markdown patterns that might be missed
      cleanResult = cleanResult
        .replace(/\*\*\*(.*?)\*\*\*/g, '$1') // Bold italic
        .replace(/\*\*(.*?)\*\*/g, '$1')     // Bold
        .replace(/\*(.*?)\*/g, '$1')         // Italic
        .replace(/__(.*?)__/g, '$1')         // Bold with underscores
        .replace(/_(.*?)_/g, '$1')           // Italic with underscores
        .replace(/###\s*/g, '')              // Additional cleanup for header markdown
        .replace(/##\s*/g, '')
        .replace(/#\s*/g, '');
      
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
              gradingText,
              studentText: combinedStudentText,
              includeCharts: true
            });
            break;
          case 'anthropic':
            result = await generateAnthropicResponse({
              model,
              temperature,
              assignmentText,
              gradingText,
              studentText: combinedStudentText,
              includeCharts: true
            });
            break;
          case 'perplexity':
            result = await generatePerplexityResponse({
              model,
              temperature,
              assignmentText,
              gradingText,
              studentText: combinedStudentText,
              includeCharts: true
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
        const fallbacks = ['anthropic', 'perplexity', 'openai'].filter(p => p !== provider);
        
        for (const fallbackProvider of fallbacks) {
          try {
            console.log(`Trying fallback provider: ${fallbackProvider}`);
            
            if (fallbackProvider === 'anthropic') {
              result = await generateAnthropicResponse({
                model: 'claude-3-haiku-20240307', // Use reliable model
                temperature,
                assignmentText,
                gradingText,
                studentText: combinedStudentText,
                includeCharts: true
              });
              console.log('Successfully used Anthropic as fallback');
              break; // Success! Exit the fallback loop
            } 
            else if (fallbackProvider === 'perplexity') {
              result = await generatePerplexityResponse({
                model: 'mistral-7b-instruct', // Use reliable model
                temperature,
                assignmentText,
                gradingText,
                studentText: combinedStudentText,
                includeCharts: true
              });
              console.log('Successfully used Perplexity as fallback');
              break; // Success! Exit the fallback loop
            }
            else if (fallbackProvider === 'openai') {
              result = await generateOpenAIResponse({
                model: 'gpt-4o', // Use most capable model 
                temperature,
                assignmentText,
                gradingText,
                studentText: combinedStudentText,
                includeCharts: true
              });
              console.log('Successfully used OpenAI as fallback');
              break; // Success! Exit the fallback loop
            }
          } catch (fallbackError) {
            // Log the failure and continue to the next fallback
            const fallbackErrorMsg = fallbackError instanceof Error ? fallbackError.message : 'Unknown error';
            errorMessages.push(`Fallback ${fallbackProvider} failed: ${fallbackErrorMsg}`);
            console.log(`Fallback ${fallbackProvider} failed: ${fallbackErrorMsg}`);
            // Continue to the next fallback provider
          }
        }
        
        // If we get here without setting 'result', all fallbacks failed
        if (!result) {
          throw new Error(`All providers failed. Errors: ${errorMessages.join('; ')}`);
        }
      }
      
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
        const match = result.match(pattern);
        if (match && match[1] && match[2]) {
          student1Grade = `${match[1]}/${match[2]}`;
          break;
        }
      }
      
      for (const pattern of grade2Patterns) {
        const match = result.match(pattern);
        if (match && match[1] && match[2]) {
          student2Grade = `${match[1]}/${match[2]}`;
          break;
        }
      }
      
      // Remove any markdown formatting from the result
      let cleanResult = result
        .replace(/#{1,6}\s*(.*?)(?=\n|$)/g, '$1') // Remove all header markdown (# through ######) but keep the content
        .replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')   // Remove all asterisks for bold/italic formatting but keep the content
        .replace(/_{1,3}(.*?)_{1,3}/g, '$1')     // Remove all underscores for formatting but keep the content
        .replace(/`{1,3}(.*?)`{1,3}/g, '$1')     // Remove all backticks for code formatting but keep the content
        .replace(/\n\s*[-+*]\s+/g, '\n') // Remove list markers
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Replace markdown links with just the text
        .replace(/\n{3,}/g, '\n\n'); // Replace multiple consecutive newlines with just two
        
      // Additional cleanup for common markdown patterns that might be missed
      cleanResult = cleanResult
        .replace(/\*\*\*(.*?)\*\*\*/g, '$1') // Bold italic
        .replace(/\*\*(.*?)\*\*/g, '$1')     // Bold
        .replace(/\*(.*?)\*/g, '$1')         // Italic
        .replace(/__(.*?)__/g, '$1')         // Bold with underscores
        .replace(/_(.*?)_/g, '$1')           // Italic with underscores
        .replace(/###\s*/g, '')              // Additional cleanup for header markdown
        .replace(/##\s*/g, '')
        .replace(/#\s*/g, '');
      
      // Create the response using the extracted or default grades
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
      
      // Instead of returning an error status, provide a friendly message that the client can display
      const errorMessage = error instanceof Error ? error.message : 'Failed to compare assignments';
      
      // Return a valid structure with an error message as the content
      // This ensures the client always has something to display
      const fallbackResponse = {
        individualGrades: {
          submission1: {
            grade: 'Error',
            feedback: `There was an error processing this comparison: ${errorMessage}\n\nPlease try again with a different provider or model, or check that your API keys are valid.`
          },
          submission2: {
            grade: 'Error',
            feedback: `There was an error processing this comparison: ${errorMessage}\n\nPlease try again with a different provider or model, or check that your API keys are valid.`
          }
        },
        comparison: {
          report: `There was an error processing this comparison: ${errorMessage}\n\nPlease try again with a different provider or model, or check that your API keys are valid.`
        }
      };
      
      // Return 200 status with usable error content instead of 500
      res.status(200).json(fallbackResponse);
    }
  });
  


  // General error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    
    res.status(err.statusCode || 500).json({
      message: err.message || 'Something went wrong',
      error: process.env.NODE_ENV === 'development' ? err : undefined,
    });
  });

  // Create HTTP server
  const httpServer = createServer(app);
  return httpServer;
}