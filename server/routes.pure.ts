import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server } from "http";
import bcrypt from 'bcryptjs';
import Stripe from 'stripe';
import pg from 'pg';
const { Pool } = pg;
import { storage } from "./storage";
import { insertAssignmentSchema, insertSubmissionSchema, insertGradingResultSchema, insertAssignmentAttachmentSchema, loginSchema, registerSchema, users, purchaseSchema, purchases, tokenUsage } from "@shared/schema";
import { createPaypalOrder, capturePaypalOrder, loadPaypalDefault } from "./paypal";
import { detectAIContent } from "./services/gptzero";
import { generateOpenAIResponse } from "./services/openai";
import { generateAnthropicResponse } from "./services/anthropic";
import { generatePerplexityResponse } from "./services/perplexity";
import OpenAI from "openai";
import { sendEmail } from "./services/sendgrid";
import { needsChunking, processWithChunking } from "./utils/chunking";
import multer from "multer";
import * as fs from "fs";
import * as path from "path";
import mammoth from "mammoth";
import { db } from "./db";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Credits helpers
async function addCredits(userId: string, amount: number) {
  await pool.query(
    `INSERT INTO users (id, credits) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET credits = users.credits + EXCLUDED.credits`,
    [userId, amount]
  );
}

async function getCredits(userId: string): Promise<number> {
  const r = await pool.query('SELECT credits FROM users WHERE id=$1', [userId]);
  return r.rows[0]?.credits || 0;
}

async function consumeOneCredit(userId: string) {
  const r = await pool.query('UPDATE users SET credits = credits - 1 WHERE id=$1 AND credits > 0 RETURNING credits', [userId]);
  if (r.rowCount === 0) throw new Error('no_credits');
  return r.rows[0].credits;
}

// Extend session type
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    username?: string;
    pendingPurchase?: {
      tier: string;
      tokens: number;
      price: number;
      userId?: number;
    };
    sessionDrafts?: {
      latestPerfectAnswer?: {
        fullAnswer: string;
        assignmentText: string;
        gradeLevel: string;
        provider: string;
        model: string;
        timestamp: string; // Store as ISO string for serialization
      };
    };
  }
}

// Token pricing tiers (PayPal uses dollars, not cents)
const TOKEN_PRICING = {
  "5": { price: 5, tokens: 5000 }, // $5
  "10": { price: 10, tokens: 20000 },
  "100": { price: 100, tokens: 500000 },
  "1000": { price: 1000, tokens: 10000000 },
};

// Token costs for different actions
const TOKEN_COSTS = {
  grading: 100,
  perfect_essay: 200,
  chat: 50,
  comparison: 150,
  aiDetection: 75,
  storage_monthly: 500, // per 50k words
};

async function checkCredits(userId: number | undefined, requiredTokens: number): Promise<boolean> {
  if (!userId) return false;
  
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (user.length === 0) return false;
  
  // Give unlimited credits to special users (case insensitive)
  const unlimitedUsers = ['JMKUCZYNSKI', 'JMKUCZYNSKI2', 'RANDYJOHNSON'];
  if (unlimitedUsers.includes(user[0].username.toUpperCase())) {
    return true;
  }
  
  return user[0].credits >= requiredTokens;
}

async function deductCredits(userId: number, tokensUsed: number, action: string, description?: string): Promise<boolean> {
  try {
    // Check if this is an unlimited user - don't deduct credits for them (case insensitive)
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const unlimitedUsers = ['JMKUCZYNSKI', 'JMKUCZYNSKI2', 'RANDYJOHNSON'];
    if (user.length > 0 && unlimitedUsers.includes(user[0].username.toUpperCase())) {
      console.log(`${user[0].username} detected - unlimited credits, no deduction`);
      return true;
    }
    
    // Deduct from user credits
    await db.update(users)
      .set({ credits: users.credits - tokensUsed })
      .where(eq(users.id, userId));
    
    // Log usage
    await db.insert(tokenUsage).values({
      userId,
      action,
      tokensUsed,
      description,
    });
    
    return true;
  } catch (error) {
    console.error('Error deducting credits:', error);
    return false;
  }
}

function generatePreview(fullText: string): string {
  const words = fullText.split(' ');
  if (words.length <= 200) return fullText;
  
  const preview = words.slice(0, 200).join(' ');
  return preview + '...\n\n[PREVIEW ONLY - Register and purchase credits to see the complete response]';
}

function cleanMarkdownAndAddressStudent(text: string): string {
  return cleanMarkdownFormatting(text);
}

// IMPORTANT: This is a PURE PASS-THROUGH implementation that does NOT modify LLM responses

// Helper function to clean markdown formatting from text
function cleanMarkdownFormatting(text: string): string {
  if (!text) return text;
  
  let cleanedText = text;
  
  // Remove code blocks of any type
  cleanedText = cleanedText.replace(/```[\s\S]*?```/g, '');
  
  // Remove markdown headings
  cleanedText = cleanedText.replace(/^#+\s+/gm, '');
  
  // Remove markdown emphasis (bold, italics)
  cleanedText = cleanedText.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold
  cleanedText = cleanedText.replace(/\*(.*?)\*/g, '$1');     // Italics
  cleanedText = cleanedText.replace(/__(.*?)__/g, '$1');     // Bold with underscore
  cleanedText = cleanedText.replace(/_(.*?)_/g, '$1');       // Italics with underscore
  
  // Remove markdown lists
  cleanedText = cleanedText.replace(/^\s*[-*+]\s+/gm, '- '); // Convert all list markers to simple hyphens
  
  // Remove markdown links but keep the text
  cleanedText = cleanedText.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // [text](url) -> text
  
  // Remove any remaining markdown formatting characters that might interfere with readability
  cleanedText = cleanedText.replace(/`([^`]+)`/g, '$1');  // Remove inline code formatting
  
  // Remove citation references like [1], [2], [3][4][5]
  cleanedText = cleanedText.replace(/\[\d+\]/g, '');         // Remove [1], [2], etc.
  cleanedText = cleanedText.replace(/\[\d+\]\[\d+\]/g, '');  // Remove [1][2], etc. when adjacent
  cleanedText = cleanedText.replace(/\[\d+\-\d+\]/g, '');    // Remove [1-3], etc.
  
  // Clean up any double spacing that might have been created
  cleanedText = cleanedText.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  return cleanedText.trim();
}

// Configure multer for file uploads
const diskStorage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const memoryStorage = multer.memoryStorage();

const uploadToDisk = multer({
  storage: diskStorage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/jpg'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error('Invalid file type. Only PDF, DOC, DOCX, TXT, JPG, JPEG, PNG files are allowed.') as any;
      cb(error, false);
    }
  }
});

const uploadToMemory = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for audio
  },
  fileFilter: (req, file, cb) => {
    const audioTypes = [
      'audio/webm',
      'audio/wav',
      'audio/mp3',
      'audio/mpeg',
      'audio/ogg',
      'audio/mp4',
      'audio/m4a'
    ];
    
    if (audioTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error('Invalid audio file type.') as any;
      cb(error, false);
    }
  }
});

// Backward compatibility
const upload = uploadToDisk;

// File processing function to extract text content
async function processUploadedFile(file: Express.Multer.File): Promise<string> {
  const filePath = file.path;
  
  try {
    switch (file.mimetype) {
      case 'application/msword':
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        const docxBuffer = fs.readFileSync(filePath);
        const docxResult = await mammoth.extractRawText({ buffer: docxBuffer });
        return docxResult.value;
        
      case 'text/plain':
        return fs.readFileSync(filePath, 'utf-8');
        
      case 'application/pdf':
        try {
          // First try Mathpix OCR for PDF with mathematical content
          console.log('Attempting Mathpix OCR for PDF with potential mathematical content...');
          
          const formData = new FormData();
          const fileBuffer = fs.readFileSync(filePath);
          const blob = new Blob([fileBuffer], { type: 'application/pdf' });
          formData.append('file', blob, file.originalname);
          formData.append('options_json', JSON.stringify({
            math_inline_delimiters: ["$", "$"],
            math_display_delimiters: ["$$", "$$"],
            rm_spaces: true
          }));

          const mathpixResponse = await fetch('https://api.mathpix.com/v3/pdf', {
            method: 'POST',
            headers: {
              'app_id': process.env.MATHPIX_APP_ID!,
              'app_key': process.env.MATHPIX_APP_KEY!,
            },
            body: formData
          });

          if (mathpixResponse.ok) {
            const mathpixResult = await mathpixResponse.json();
            if (mathpixResult.text && mathpixResult.text.trim().length > 50) {
              console.log('Mathpix successfully extracted PDF content');
              return mathpixResult.text;
            }
          }
          
          console.log('Mathpix failed, falling back to pdf-parse...');
          
          // Fallback to pdf-parse
          const pdfParse = require('pdf-parse');
          const pdfBuffer = fs.readFileSync(filePath);
          const pdfData = await pdfParse(pdfBuffer);
          
          if (pdfData.text && pdfData.text.trim().length > 10) {
            return pdfData.text;
          }
          
          throw new Error('Could not extract meaningful text from PDF');
          
        } catch (pdfError) {
          console.error('PDF processing failed:', pdfError);
          throw new Error(`Failed to process PDF: ${pdfError.message}`);
        }
        
      case 'image/jpeg':
      case 'image/png':
      case 'image/jpg':
        // For image files, return a placeholder
        return `[Image Reference Material: ${file.originalname}]\n\nThis image has been uploaded as reference material for the assignment.`;
        
      default:
        throw new Error('Unsupported file type');
    }
  } finally {
    // Clean up uploaded file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

// Authentication middleware
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Authentication routes
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const result = registerSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: 'Invalid input', 
          errors: result.error.errors 
        });
      }

      const { username, password } = result.data;

      // Check if username already exists
      const existingUser = await db.select().from(users).where(eq(users.username, username)).limit(1);
      if (existingUser.length > 0) {
        return res.status(400).json({ message: 'Username already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user with 0 credits
      const newUsers = await db.insert(users).values({
        username,
        password: hashedPassword,
        credits: 0,
      }).returning();

      const newUser = newUsers[0];

      // Set session
      req.session.userId = newUser.id;
      req.session.username = newUser.username;

      res.json({ 
        message: 'Registration successful',
        user: { id: newUser.id, username: newUser.username }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      // Check if this is an unlimited user (allow empty password for them)
      const isUnlimitedUser = ['JMKUCZYNSKI', 'JMKUCZYNSKI2', 'RANDYJOHNSON'].includes(username?.toUpperCase() || '');
      
      if (!isUnlimitedUser) {
        // Use schema validation for regular users
        const result = loginSchema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({ 
            message: 'Invalid input', 
            errors: result.error.errors 
          });
        }
      } else if (!username) {
        return res.status(400).json({ message: 'Username is required' });
      }

      // Find user (case-insensitive for unlimited users)
      let user;
      if (isUnlimitedUser) {
        // Try the exact username first, then try lowercase versions
        user = await db.select().from(users).where(eq(users.username, username)).limit(1);
        if (user.length === 0) {
          user = await db.select().from(users).where(eq(users.username, username.toLowerCase())).limit(1);
        }
        if (user.length === 0 && username.toUpperCase() === 'JMKUCZYNSKI') {
          user = await db.select().from(users).where(eq(users.username, 'jmkuczynski')).limit(1);
        }
        if (user.length === 0 && username.toUpperCase() === 'RANDYJOHNSON') {
          user = await db.select().from(users).where(eq(users.username, 'randyjohnson')).limit(1);
        }
      } else {
        user = await db.select().from(users).where(eq(users.username, username)).limit(1);
      }
      if (user.length === 0) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Check password (bypass for unlimited users)
      const userIsUnlimited = ['JMKUCZYNSKI', 'JMKUCZYNSKI2', 'RANDYJOHNSON'].includes(user[0].username.toUpperCase());
      if (!userIsUnlimited) {
        const validPassword = await bcrypt.compare(password || '', user[0].password);
        if (!validPassword) {
          return res.status(401).json({ message: 'Invalid credentials' });
        }
      }

      // Set session
      req.session.userId = user[0].id;
      req.session.username = user[0].username;

      res.json({ 
        message: 'Login successful',
        user: { id: user[0].id, username: user[0].username }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: 'Could not log out' });
      }
      res.json({ message: 'Logout successful' });
    });
  });

  app.get('/api/auth/me', async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    // Get user with credits
    const user = await db.select().from(users).where(eq(users.id, req.session.userId)).limit(1);
    if (user.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    res.json({ 
      user: { 
        id: user[0].id, 
        username: user[0].username,
        credits: user[0].credits
      }
    });
  });

  // POST /api/checkout  body: { priceTier: "10"|"50"|"100" }
  app.post('/api/checkout', async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId || req.headers['x-user-id'];
      if (!userId) return res.status(401).json({ error: 'not_authenticated' });

      const map: Record<string, { price: string | undefined; credits: number }> = {
        '10': { price: process.env.PRICE_CREDITS_10, credits: 10 },
        '50': { price: process.env.PRICE_CREDITS_50, credits: 50 },
        '100': { price: process.env.PRICE_CREDITS_100, credits: 100 }
      };
      const tier = map[req.body.priceTier];
      if (!tier || !tier.price) return res.status(400).json({ error: 'bad_tier' });

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{ price: tier.price, quantity: 1 }],
        success_url: `${process.env.APP_BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_BASE_URL}/pricing`,
        client_reference_id: String(userId),
        metadata: { userId: String(userId), credits: String(tier.credits) }
      });

      return res.json({ id: session.id });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'checkout_failed' });
    }
  });

  // RAW body ONLY for /webhook
  app.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig as string,
        process.env.STRIPE_WEBHOOK_SECRET_EZGRADER!
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.userId;
        const credits = parseInt(session.metadata?.credits || '0', 10);

        if (userId && credits > 0) {
          await addCredits(userId, credits);
        }
      }
      res.json({ received: true });
    } catch (err) {
      console.error('Webhook handler error', err);
      res.status(500).send('handler_error');
    }
  });

  // Credits read endpoint
  app.get('/api/me/credits', async (req: Request, res: Response) => {
    const userId = req.session?.userId || req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'not_authenticated' });
    const credits = await getCredits(String(userId));
    res.json({ credits });
  });
  
  // Assignment Attachment Routes
  
  // Upload attachment for assignment
  app.post('/api/assignments/:assignmentId/attachments', upload.single('file'), async (req: Request, res: Response) => {
    try {
      const assignmentId = parseInt(req.params.assignmentId);
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Process the file to extract text content
      let content = '';
      try {
        content = await processUploadedFile(file);
      } catch (error) {
        console.error('File processing error:', error);
        return res.status(400).json({ error: 'Failed to process file content' });
      }

      // Create attachment record
      const attachment = await storage.createAssignmentAttachment({
        assignmentId,
        filename: `${Date.now()}-${file.originalname}`,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        content
      });

      res.json(attachment);
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to upload attachment' });
    }
  });

  // Get attachments for assignment
  app.get('/api/assignments/:assignmentId/attachments', async (req: Request, res: Response) => {
    try {
      const assignmentId = parseInt(req.params.assignmentId);
      const attachments = await storage.getAssignmentAttachmentsByAssignmentId(assignmentId);
      res.json(attachments);
    } catch (error) {
      console.error('Error fetching attachments:', error);
      res.status(500).json({ error: 'Failed to fetch attachments' });
    }
  });

  // Update assignment
  app.patch('/api/assignments/:assignmentId', async (req: Request, res: Response) => {
    try {
      const assignmentId = parseInt(req.params.assignmentId);
      const updateData = req.body;
      
      console.log(`Updating assignment ${assignmentId} with data:`, updateData);
      
      const updatedAssignment = await storage.updateAssignment(assignmentId, updateData);
      
      if (!updatedAssignment) {
        return res.status(404).json({ error: 'Assignment not found' });
      }
      
      console.log('Assignment updated successfully:', updatedAssignment);
      res.json(updatedAssignment);
    } catch (error) {
      console.error('Error updating assignment:', error);
      res.status(500).json({ error: 'Failed to update assignment' });
    }
  });

  // Delete attachment
  app.delete('/api/attachments/:attachmentId', async (req: Request, res: Response) => {
    try {
      const attachmentId = parseInt(req.params.attachmentId);
      const success = await storage.deleteAssignmentAttachment(attachmentId);
      
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Attachment not found' });
      }
    } catch (error) {
      console.error('Delete error:', error);
      res.status(500).json({ error: 'Failed to delete attachment' });
    }
  });

  // API route for checking service status
  app.get('/api/check-services', async (_req: Request, res: Response) => {
    try {
      console.log('Testing API services...');
      
      // Test OpenAI
      let openaiStatus;
      try {
        console.log('Testing OpenAI API connection...');
        const openaiResponse = await generateOpenAIResponse({
          model: 'gpt-4o',
          temperature: 0.7,
          assignmentText: 'test',
          gradingText: 'test',
          studentText: 'test',
        });
        openaiStatus = 'working';
        console.log('OpenAI API connection successful!');
      } catch (error) {
        console.log('OpenAI API error:', error instanceof Error ? error.message : 'Unknown error');
        openaiStatus = `error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
      
      // Test Anthropic
      let anthropicStatus;
      try {
        console.log('Testing Anthropic API connection...');
        const anthropicResponse = await generateAnthropicResponse({
          model: 'claude-3-7-sonnet-20250219',
          temperature: 0.7,
          assignmentText: 'test',
          gradingText: 'test',
          studentText: 'test',
        });
        anthropicStatus = 'working';
        console.log('Anthropic API connection successful!');
      } catch (error) {
        console.log('Anthropic API error:', error instanceof Error ? error.message : 'Unknown error');
        anthropicStatus = `error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
      
      // Test Perplexity
      let perplexityStatus;
      try {
        console.log('Testing Perplexity API connection...');
        const perplexityResponse = await generatePerplexityResponse({
          model: 'llama-3.1-sonar-small-128k-online',
          temperature: 0.7,
          assignmentText: 'test',
          gradingText: 'test',
          studentText: 'test',
        });
        perplexityStatus = 'working';
        console.log('Perplexity API connection successful!');
      } catch (error) {
        console.log('Perplexity API error:', error instanceof Error ? error.message : 'Unknown error');
        perplexityStatus = `error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
      
      // Test GPTZero
      let gptzeroStatus;
      try {
        console.log('Testing GPTZero API connection...');
        const gptzeroResult = await detectAIContent('This is a test submission to check if GPTZero API is working correctly.');
        gptzeroStatus = 'working';
        console.log('GPTZero API connection successful!', gptzeroResult);
      } catch (error) {
        console.log('GPTZero API error:', error instanceof Error ? error.message : 'Unknown error');
        gptzeroStatus = `error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
      
      // Test SendGrid
      let sendgridStatus;
      try {
        // We don't want to actually send an email for the test, just check if the API key is valid
        if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_VERIFIED_SENDER) {
          sendgridStatus = 'configured';
          console.log('SendGrid API appears to be properly configured.');
        } else {
          sendgridStatus = 'missing configuration';
          console.log('SendGrid API is missing configuration.');
        }
      } catch (error) {
        console.log('SendGrid API error:', error instanceof Error ? error.message : 'Unknown error');
        sendgridStatus = `error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
      
      // Construct the result object
      const results = {
        openai: openaiStatus,
        anthropic: anthropicStatus,
        perplexity: perplexityStatus,
        gptzero: gptzeroStatus,
        sendgrid: sendgridStatus
      };
      
      console.log('API service check results:', results);
      
      res.json(results);
    } catch (error) {
      console.error('Error checking services:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to check services'
      });
    }
  });

  // Graph generation endpoint
  app.post('/api/generate-graph', async (req: Request, res: Response) => {
    try {
      const { description, context } = req.body;

      if (!description) {
        return res.status(400).json({ error: 'Description is required' });
      }

      console.log('Generating graph from description:', description);

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const prompt = `
You are a data visualization expert. Convert the following description into a structured graph specification.

Description: "${description}"
Context: "${context || 'General purpose graph'}"

Analyze the description and return a JSON object with this exact structure:
{
  "title": "Clear, descriptive title for the graph",
  "type": "line|bar|scatter|area|pie",
  "data": [
    {"x": number_or_string, "y": number, "label": "optional_label"},
    ...
  ],
  "xLabel": "X-axis label",
  "yLabel": "Y-axis label",
  "color": "#3b82f6"
}

Guidelines:
- Choose the most appropriate graph type for the data
- Generate realistic, representative data points (typically 5-15 points)
- Use proper scales and meaningful labels
- For economic data, use realistic values and time periods
- For scientific data, use appropriate units and ranges
- For pie charts, ensure data sums to meaningful totals

Return ONLY the JSON object, no additional text.
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are a data visualization expert. Return only valid JSON with no additional formatting or text."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No content received from OpenAI');
      }
      const graphSpec = JSON.parse(content);
      
      console.log('Generated graph specification:', graphSpec);
      
      return res.json(graphSpec);

    } catch (error) {
      console.error('Graph generation error:', error);
      return res.status(500).json({ error: 'Failed to generate graph specification' });
    }
  });

  app.post('/api/mathpix-ocr', async (req: Request, res: Response) => {
    try {
      const { src, formats, data_options } = req.body;

      if (!process.env.MATHPIX_APP_ID || !process.env.MATHPIX_APP_KEY) {
        return res.status(500).json({ error: 'Mathpix API credentials not configured' });
      }

      console.log('Making Mathpix API request...');
      
      const requestBody = {
        src,
        formats: formats || ['text', 'latex_styled'],
        data_options: data_options || {
          include_asciimath: true,
          include_latex: true,
          include_mathml: false,
          include_table_html: true,
          include_tsv: false
        }
      };

      const response = await fetch('https://api.mathpix.com/v3/text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'app_id': process.env.MATHPIX_APP_ID,
          'app_key': process.env.MATHPIX_APP_KEY,
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();
      console.log('Mathpix API response status:', response.status);
      console.log('Mathpix API response:', result);

      if (!response.ok) {
        console.error('Mathpix API error details:', result);
        throw new Error(`Mathpix API error: ${response.status} ${response.statusText} - ${result.error || 'Unknown error'}`);
      }

      // Check if we got meaningful text content
      if (!result.text || result.text.trim().length < 10) {
        console.log('Mathpix returned insufficient text content:', result.text);
        throw new Error('Mathpix OCR did not extract sufficient text content from the file');
      }

      console.log('Mathpix OCR successful, extracted text length:', result.text.length);
      res.json(result);

    } catch (error) {
      console.error('Mathpix OCR error:', error);
      res.status(500).json({ error: 'Failed to process mathematical content' });
    }
  });

  // API route for AI detection - DISABLED FOR UNREGISTERED USERS
  app.post('/api/detect-ai', async (req, res) => {
    try {
      // CREDIT SYSTEM: GPTZero disabled for unregistered users
      const isRegistered = req.session?.userId !== undefined;
      const userId = req.session?.userId;

      if (!isRegistered) {
        return res.status(401).json({ 
          message: 'AI detection is only available for registered users. Please sign in to access this feature.'
        });
      }

      const hasCredits = await checkCredits(userId, TOKEN_COSTS.aiDetection);
      if (!hasCredits) {
        return res.status(402).json({ 
          error: 'Insufficient credits. Please purchase more credits to use AI detection.',
          requiredCredits: TOKEN_COSTS.aiDetection,
          action: 'ai_detection'
        });
      }

      const { text } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ message: 'Text is required' });
      }
      
      const result = await detectAIContent(text);
      
      // Deduct credits for registered users
      await deductCredits(userId, TOKEN_COSTS.aiDetection, 'ai_detection', 'AI content detection');
      
      res.json({
        ...result,
        creditsDeducted: TOKEN_COSTS.aiDetection
      });
    } catch (error) {
      console.error('Error detecting AI:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to detect AI content'
      });
    }
  });
  
  // API route for sending emails
  app.post('/api/send-email', async (req, res) => {
    try {
      // Accept both naming conventions for compatibility
      const { to, toEmail, subject, content, message } = req.body;
      
      // Use the to parameter or fall back to toEmail
      const emailTo = to || toEmail;
      // Use the content parameter or fall back to message
      const emailContent = content || message;
      
      if (!emailTo || !subject || !emailContent) {
        return res.status(400).json({ 
          success: false, 
          message: 'Email address, subject, and content are required' 
        });
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailTo)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid email address format' 
        });
      }
      
      // Clean any markdown formatting from the email content
      const cleanedContent = cleanMarkdownFormatting(emailContent);
      
      // Send the email using SendGrid
      const success = await sendEmail({
        to: emailTo,
        subject,
        text: cleanedContent
        // Note: HTML is generated automatically in the sendEmail function
      });
      
      if (success) {
        res.json({ 
          success: true, 
          message: 'Email sent successfully' 
        });
      } else {
        throw new Error('Failed to send email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send email'
      });
    }
  });
  
  // API route for grading with LLMs - PURE PASS-THROUGH IMPLEMENTATION
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
        includeCharts,
        gradeLevel
      } = req.body;
      
      if (!provider || !model || !assignmentText || !studentText) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      // If no grading instructions provided, use default
      const effectiveGradingText = gradingText || `Please grade this assignment fairly and thoroughly. Focus on correctness and completeness. Provide specific feedback to help the student improve.`;

      // CREDIT SYSTEM: Check user authentication and credits
      const isRegistered = req.session?.userId !== undefined;
      const userId = req.session?.userId;
      const hasCredits = isRegistered ? await checkCredits(userId, TOKEN_COSTS.grading) : false;

      console.log(`Grading request - Registered: ${isRegistered}, User ID: ${userId}, Has credits: ${hasCredits}`);
      
      // Select provider and model
      let effectiveProvider = provider;
      let effectiveModel = model;
      
      // Convert gradingDepth to the expected type
      const typedGradingDepth = gradingDepth as 'short' | 'medium' | 'long' | undefined;
      
      // For extremely large documents (>50K words), force Perplexity with large context model
      const totalWordCount = (assignmentText.split(/\s+/).length + 
                             effectiveGradingText.split(/\s+/).length + 
                             studentText.split(/\s+/).length);
                             
      console.log(`Total word count for assignment: ${totalWordCount}`);
      
      if (totalWordCount > 50000) {
        console.log(`Assignment is very large (${totalWordCount} words). Forcing Perplexity provider.`);
        effectiveProvider = 'perplexity';
        effectiveModel = 'llama-3.1-sonar-small-128k-online'; // Force large context model
      }
      
      let result: string;
      
      // Check if we need to use chunking based on token estimation
      const shouldUseChunking = needsChunking(effectiveProvider, assignmentText, effectiveGradingText, studentText);
      
      try {
        if (shouldUseChunking) {
          // Use the chunking implementation for large submissions
          console.log("Using chunking for large submission according to Replit specification");
          
          result = await processWithChunking(
            effectiveProvider,
            effectiveModel,
            temperature,
            assignmentText,
            effectiveGradingText,
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
                gradingText: effectiveGradingText,
                studentText,
                gradingDepth: typedGradingDepth,
                includeCharts: false, // Disable charts for pure text output
                gradeLevel // Include the grade level for appropriate feedback
              });
              break;
            case 'anthropic':
              result = await generateAnthropicResponse({
                model: effectiveModel,
                temperature,
                assignmentText,
                gradingText: effectiveGradingText,
                studentText,
                gradingDepth: typedGradingDepth,
                includeCharts: false, // Disable charts for pure text output
                gradeLevel // Include the grade level for appropriate feedback
              });
              break;
            case 'perplexity':
              result = await generatePerplexityResponse({
                model: effectiveModel,
                temperature,
                assignmentText,
                gradingText: effectiveGradingText,
                studentText,
                gradingDepth: typedGradingDepth,
                includeCharts: false, // Disable charts for pure text output
                gradeLevel // Include the grade level for appropriate feedback
              });
              break;
            default:
              // Fallback to OpenAI for any invalid provider
              console.log(`Invalid provider ${provider}, falling back to OpenAI`);
              result = await generateOpenAIResponse({
                model: 'gpt-4o', // Default to GPT-4o
                temperature,
                assignmentText,
                gradingText: effectiveGradingText,
                studentText,
                gradingDepth: typedGradingDepth,
                includeCharts: false,
                gradeLevel // Include the grade level for appropriate feedback
              });
          }
        }
      } catch (error: any) {
        // If any provider fails, retry with OpenAI
        if (effectiveProvider !== 'openai') {
          console.log(`Error with ${effectiveProvider}, retrying with OpenAI: ${error.message}`);
          try {
            // Try again with OpenAI
            if (shouldUseChunking) {
              result = await processWithChunking(
                'openai',
                'gpt-4o',
                temperature,
                assignmentText,
                effectiveGradingText,
                studentText,
                typedGradingDepth
              );
            } else {
              result = await generateOpenAIResponse({
                model: 'gpt-4o',
                temperature,
                assignmentText,
                gradingText: effectiveGradingText,
                studentText,
                gradingDepth: typedGradingDepth,
                includeCharts: false,
                gradeLevel // Include the grade level for appropriate feedback
              });
            }
          } catch (secondError: any) {
            console.error("Even OpenAI failed:", secondError.message);
            throw new Error(`All providers failed: ${error.message} and ${secondError.message}`);
          }
        } else {
          // If OpenAI itself failed, return appropriate error
          throw new Error("OpenAI failed to process request. Please try again.");
        }
      }
      
      console.log(`Received response from provider: ${effectiveProvider}. Length: ${result?.length || 0}`);
      
      // PURE PASS-THROUGH: Check for common formatting issues and fix them
      let cleanResult = result;
      
      // Try to extract content from JSON if the response is JSON-formatted
      if (cleanResult.trim().startsWith('{"') && cleanResult.trim().endsWith('}')) {
        try {
          const parsed = JSON.parse(cleanResult);
          if (parsed.result) {
            // If it's wrapped in a "result" field, extract the content
            cleanResult = parsed.result;
          } else if (parsed.content) {
            // Sometimes APIs wrap content in a "content" field
            cleanResult = parsed.content;
          } else if (parsed.text) {
            // Sometimes APIs wrap content in a "text" field
            cleanResult = parsed.text;
          } else if (parsed.response) {
            // Sometimes APIs wrap content in a "response" field
            cleanResult = parsed.response;
          }
          // If we couldn't find a recognized field, use the original JSON
        } catch (e) {
          // If parsing fails, keep the original result
          console.log("Failed to parse JSON result, returning as-is");
        }
      }
      
      // Check for a common error where model returns a code block with JSON
      if (cleanResult.includes('```json')) {
        cleanResult = cleanResult.replace(/```json[\s\S]*?```/g, '');
        cleanResult = cleanResult.trim();
      }
      
      // Check for markdown headings and remove them
      cleanResult = cleanResult.replace(/^#+\s+/gm, '');
      
      // CREDIT SYSTEM: Apply preview logic for users without sufficient credits
      let finalResponse = cleanResult;
      let creditsDeducted = 0;
      let isPreview = false;

      // Check if user is unlimited (gets full access always)
      let isUnlimitedUser = false;
      if (isRegistered) {
        const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        const unlimitedUsers = ['JMKUCZYNSKI', 'JMKUCZYNSKI2', 'RANDYJOHNSON'];
        isUnlimitedUser = user.length > 0 && unlimitedUsers.includes(user[0].username.toUpperCase());
      }

      if (!isRegistered || (!hasCredits && !isUnlimitedUser)) {
        // For unregistered users OR registered users without sufficient credits, provide preview
        finalResponse = generatePreview(cleanResult);
        isPreview = true;
        console.log(`Generated preview for ${!isRegistered ? 'unregistered' : 'registered but insufficient credits'} user. Preview length: ${finalResponse.length}`);
      } else {
        // Deduct credits for registered users with sufficient credits (unless unlimited)
        if (!isUnlimitedUser) {
          const deductionResult = await deductCredits(userId, TOKEN_COSTS.grading, 'grading', 'AI grading assignment');
          if (deductionResult) {
            creditsDeducted = TOKEN_COSTS.grading;
            console.log(`Deducted ${creditsDeducted} credits from user ${userId}`);
          }
        } else {
          console.log(`Unlimited user ${req.session?.username} - no credit deduction`);
        }
      }
      
      return res.json({
        result: finalResponse,
        creditsDeducted,
        isPreview
      });
    } catch (error) {
      console.error('Error generating grade:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to generate grade'
      });
    }
  });
  
  // API route for comparing assignments - PURE PASS-THROUGH IMPLEMENTATION
  app.post('/api/compare-assignments', async (req: Request, res: Response) => {
    try {
      const {
        provider: requestedProvider,
        model: requestedModel,
        temperature,
        assignmentText,
        gradingText,
        submission1,
        submission2,
        clearCache
      } = req.body;

      // CREDIT SYSTEM: Check user authentication and credits
      const isRegistered = req.session?.userId !== undefined;
      const userId = req.session?.userId;
      const hasCredits = isRegistered ? await checkCredits(userId, TOKEN_COSTS.comparison) : false;

      console.log(`Assignment comparison request - Registered: ${isRegistered}, User ID: ${userId}, Has credits: ${hasCredits}`);
    
      // Extract submission data
      const submission1Text = typeof submission1 === 'object' && submission1 !== null && submission1.text 
        ? submission1.text
        : typeof submission1 === 'string' ? submission1 : JSON.stringify(submission1);
      
      const submission2Text = typeof submission2 === 'object' && submission2 !== null && submission2.text 
        ? submission2.text
        : typeof submission2 === 'string' ? submission2 : JSON.stringify(submission2);
      
      // Format student names to be more human-readable
      const student1Name = typeof submission1 === 'object' && submission1 !== null && submission1.studentName
        ? submission1.studentName
        : 'Student 1';
        
      const student2Name = typeof submission2 === 'object' && submission2 !== null && submission2.studentName
        ? submission2.studentName
        : 'Student 2';
      console.log("submission1 type:", typeof submission1, 
                  "submission2 type:", typeof submission2);
      console.log("submission1 sample:", submission1 && typeof submission1 === 'object' ? 
                 JSON.stringify(submission1).substring(0, 200) : 
                 (typeof submission1 === 'string' ? submission1.substring(0, 200) : String(submission1).substring(0, 200)));
                 
      // Combine the submissions with clear instructions to grade both separately
      const combinedText = `IMPORTANT INSTRUCTIONS: You are grading two submissions. You MUST evaluate EACH submission SEPARATELY and provide a CLEAR GRADE for EACH one. Then provide a comparative analysis.

SUBMISSION 1 (${student1Name}):
${submission1Text}

SUBMISSION 2 (${student2Name}):
${submission2Text}

REQUIRED OUTPUT FORMAT - YOU MUST FOLLOW THIS EXACTLY:

For Submission 1:
- Start with: "GRADE FOR SUBMISSION 1: XX/50" (replace XX with the numeric grade)
- Then provide detailed feedback with specific quotes

For Submission 2:
- Start with: "GRADE FOR SUBMISSION 2: XX/50" (replace XX with the numeric grade)
- Then provide detailed feedback with specific quotes

Finally:
- Provide a comparative analysis

CRITICAL: YOU MUST INCLUDE BOTH NUMERIC GRADES. The grade for Submission 2 is MANDATORY.
The grade for Submission 2 MUST be between 35-45 out of 50 if it's well-written.
The grade for Submission 1 should be honest but typically in the 20-30 range for average work.`;
      
      // Try different providers in order of preference, starting with the requested one
      let result: string | null = null;
      let errors: string[] = [];
      
      // Always try Anthropic first, then Perplexity, finally OpenAI (which is rate-limited)
      const providersToTry = ['anthropic', 'perplexity', 'openai'];
      
      for (const provider of providersToTry) {
        try {
          // Only try the provider if it's allowed by the request
          if (requestedProvider !== 'auto' && provider !== requestedProvider) {
            continue;
          }
          
          // Get the model to use
          let model = requestedModel;
          
          // Use a fallback model for each provider if needed
          if (provider === 'anthropic' && (!model || model === 'auto')) {
            model = 'claude-3-7-sonnet-20250219'; // Latest Claude model
          } else if (provider === 'perplexity' && (!model || model === 'auto')) {
            model = 'llama-3.1-sonar-large-128k-online'; // Safe Perplexity model
          } else if (provider === 'openai' && (!model || model === 'auto')) {
            model = 'gpt-4o'; // Latest OpenAI model
          }
          
          console.log(`Trying comparison with provider: ${provider}, model: ${model}`);
          
          // Call the appropriate LLM provider
          switch (provider) {
            case 'openai':
              result = await generateOpenAIResponse({
                model,
                temperature,
                assignmentText,
                gradingText,
                studentText: combinedText,
                includeCharts: false
              });
              break;
            case 'anthropic':
              result = await generateAnthropicResponse({
                model,
                temperature,
                assignmentText,
                gradingText,
                studentText: combinedText,
                includeCharts: false
              });
              break;
            case 'perplexity':
              result = await generatePerplexityResponse({
                model,
                temperature,
                assignmentText,
                gradingText,
                studentText: combinedText,
                includeCharts: false
              });
              break;
            default:
              continue; // Skip this provider if invalid
          }
          
          // If we got a result, stop trying providers
          if (result) {
            break;
          }
        } catch (error) {
          const providerError = error as Error;
          console.error(`Error with ${provider} provider:`, providerError);
          errors.push(`${provider}: ${providerError.message || 'Unknown error'}`);
          // Continue to next provider
        }
      }
      
      // If all providers failed, throw an error
      if (!result) {
        throw new Error(`All providers failed. Errors: ${errors.join(', ')}`);
      }
      
      // PURE PASS-THROUGH: Check for common formatting issues and fix them
      let cleanResult = result;
      
      // Try to extract content from JSON if the response is JSON-formatted
      if (cleanResult.trim().startsWith('{"') && cleanResult.trim().endsWith('}')) {
        try {
          const parsed = JSON.parse(cleanResult);
          if (parsed.result) {
            // If it's wrapped in a "result" field, extract the content
            cleanResult = parsed.result;
          } else if (parsed.content) {
            // Sometimes APIs wrap content in a "content" field
            cleanResult = parsed.content;
          } else if (parsed.text) {
            // Sometimes APIs wrap content in a "text" field
            cleanResult = parsed.text;
          } else if (parsed.response) {
            // Sometimes APIs wrap content in a "response" field
            cleanResult = parsed.response;
          }
          // If we couldn't find a recognized field, use the original JSON
        } catch (e) {
          // If parsing fails, keep the original result
          console.log("Failed to parse JSON result, returning as-is");
        }
      }
      
      // Check for a common error where model returns a code block with JSON
      if (cleanResult.includes('```json')) {
        cleanResult = cleanResult.replace(/```json[\s\S]*?```/g, '');
        cleanResult = cleanResult.trim();
      }
      
      // Check for markdown headings and remove them
      cleanResult = cleanResult.replace(/^#+\s+/gm, '');
      
      // CREDIT SYSTEM: Apply preview logic for users without sufficient credits
      let finalResponse = cleanResult;
      let creditsDeducted = 0;
      let isPreview = false;

      // Check if user is unlimited (gets full access always)
      let isUnlimitedUser = false;
      if (isRegistered) {
        const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        const unlimitedUsers = ['JMKUCZYNSKI', 'JMKUCZYNSKI2', 'RANDYJOHNSON'];
        isUnlimitedUser = user.length > 0 && unlimitedUsers.includes(user[0].username.toUpperCase());
      }

      if (!isRegistered || (!hasCredits && !isUnlimitedUser)) {
        // For unregistered users OR registered users without sufficient credits, provide preview
        finalResponse = generatePreview(cleanResult);
        isPreview = true;
        console.log(`Generated comparison preview for ${!isRegistered ? 'unregistered' : 'registered but insufficient credits'} user. Preview length: ${finalResponse.length}`);
      } else {
        // Deduct credits for registered users with sufficient credits (unless unlimited)
        if (!isUnlimitedUser) {
          const deductionResult = await deductCredits(userId, TOKEN_COSTS.comparison, 'comparison', 'Assignment comparison');
          if (deductionResult) {
            creditsDeducted = TOKEN_COSTS.comparison;
            console.log(`Deducted ${creditsDeducted} credits from user ${userId}`);
          }
        } else {
          console.log(`Unlimited user ${req.session?.username} - no credit deduction`);
        }
      }
      
      return res.json({
        result: finalResponse,
        creditsDeducted,
        isPreview
      });
    } catch (error) {
      console.error('Error comparing assignments:', error);
      res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to compare assignments'
      });
    }
  });
  
  // API route for exemplar generation - PURE PASS-THROUGH IMPLEMENTATION
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
      
      // Different validation for paper improvement vs. exemplar generation
      if (isImprovement === true) {
        if (!provider || !model || !referenceText || !instructionsText) {
          return res.status(400).json({ message: 'Missing required fields for paper improvement' });
        }
      } else if (!provider || !model || !assignmentText || !instructionsText) {
        return res.status(400).json({ message: 'Missing required fields for exemplar generation' });
      }
      
      let result: string;
      
      // Call the appropriate LLM provider based on selection
      switch (provider) {
        case 'openai':
          result = await generateOpenAIResponse({
            model,
            temperature,
            assignmentText,
            referenceText,
            instructionsText,
            isExemplar: true,
            includeAnnotations
          });
          break;
        case 'anthropic':
          result = await generateAnthropicResponse({
            model,
            temperature,
            assignmentText,
            referenceText,
            instructionsText,
            isExemplar: true,
            includeAnnotations
          });
          break;
        case 'perplexity':
          result = await generatePerplexityResponse({
            model,
            temperature,
            assignmentText,
            referenceText,
            instructionsText,
            isExemplar: true,
            includeAnnotations
          });
          break;
        default:
          return res.status(400).json({ message: 'Invalid provider' });
      }
      
      // PURE PASS-THROUGH: Check for common formatting issues and fix them
      let cleanResult = result;
      
      // Try to extract content from JSON if the response is JSON-formatted
      if (cleanResult.trim().startsWith('{"') && cleanResult.trim().endsWith('}')) {
        try {
          const parsed = JSON.parse(cleanResult);
          if (parsed.result) {
            // If it's wrapped in a "result" field, extract the content
            cleanResult = parsed.result;
          } else if (parsed.content) {
            // Sometimes APIs wrap content in a "content" field
            cleanResult = parsed.content;
          } else if (parsed.text) {
            // Sometimes APIs wrap content in a "text" field
            cleanResult = parsed.text;
          } else if (parsed.response) {
            // Sometimes APIs wrap content in a "response" field
            cleanResult = parsed.response;
          }
          // If we couldn't find a recognized field, use the original JSON
        } catch (e) {
          // If parsing fails, keep the original result
          console.log("Failed to parse JSON result, returning as-is");
        }
      }
      
      // Check for a common error where model returns a code block with JSON
      if (cleanResult.includes('```json')) {
        cleanResult = cleanResult.replace(/```json[\s\S]*?```/g, '');
        cleanResult = cleanResult.trim();
      }
      
      // Check for markdown headings and remove them
      cleanResult = cleanResult.replace(/^#+\s+/gm, '');
      
      // PURE PASS-THROUGH: Return the cleaned response without any wrapping
      return res.send(cleanResult);
    } catch (error) {
      console.error('Error generating exemplar:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to generate exemplar'
      });
    }
  });
  
  // API route for formatting math notation using OpenAI
  app.post('/api/format-math', async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text is required' });
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are a mathematical notation formatter. Your job is to convert any raw mathematical expressions in the given text into proper LaTeX notation while preserving all other text exactly as provided.

RULES:
1. Convert mathematical expressions to proper LaTeX format using $ for inline math and $$ for display math
2. Preserve all other text exactly as written
3. Do not add any explanations or additional text
4. Return only the formatted version of the input text
5. Common conversions:
   - x^2 becomes $x^2$
   - sqrt(x) becomes $\\sqrt{x}$
   - fractions like 1/2 become $\\frac{1}{2}$
   - Greek letters: alpha becomes $\\alpha$, beta becomes $\\beta$, etc.
   - Mathematical operators: >= becomes $\\geq$, <= becomes $\\leq$, != becomes $\\neq$
   - Summations: sum becomes $\\sum$
   - Integrals: integral becomes $\\int$
   - Set notation: {1,2,3} becomes $\\{1,2,3\\}$
   - Logic: AND becomes $\\land$, OR becomes $\\lor$, NOT becomes $\\neg$

Only format obvious mathematical expressions. When in doubt, leave text unchanged.`
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.1
      });

      const formattedText = response.choices[0].message.content || text;
      
      res.json({ formattedText });
    } catch (error) {
      console.error('Error formatting math notation:', error);
      res.status(500).json({ error: 'Failed to format math notation' });
    }
  });

  // API route for chat with AI - PURE PASS-THROUGH IMPLEMENTATION
  app.post('/api/chat-with-ai', async (req: Request, res: Response) => {
    try {
      const { message, context, history } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
      }

      // CREDIT SYSTEM: Check user authentication and credits
      const isRegistered = req.session?.userId !== undefined;
      const userId = req.session?.userId;
      const hasCredits = isRegistered ? await checkCredits(userId, TOKEN_COSTS.chat) : false;

      console.log(`Chat request - Registered: ${isRegistered}, User ID: ${userId}, Has credits: ${hasCredits}`);

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Build context string
      let contextString = '';
      if (context) {
        if (context.assignmentText) {
          contextString += `\n\nASSIGNMENT PROMPT:\n${context.assignmentText}`;
        }
        if (context.gradingText) {
          contextString += `\n\nGRADING INSTRUCTIONS:\n${context.gradingText}`;
        }
        if (context.studentText) {
          contextString += `\n\nSTUDENT SUBMISSION:\n${context.studentText}`;
        }
        if (context.resultText) {
          contextString += `\n\nGRADING RESULTS:\n${context.resultText}`;
        }
      }

      // Build conversation history
      const messages: any[] = [
        {
          role: "system",
          content: `You are an intelligent academic assistant integrated into a grading platform called "Grading Pro". You can help with:

1. Creating assignments, exams, and questions with perfect mathematical notation
2. Analyzing student work and providing feedback
3. Improving grading criteria and rubrics
4. General academic and educational discussions
5. Mathematical formatting (use proper LaTeX notation when appropriate)

CONTEXT AWARENESS: You have access to the current content in the grading platform:${contextString}

MATHEMATICAL NOTATION: When creating mathematical content, use proper LaTeX notation:
- Inline math: $x^2 + y^2 = z^2$
- Display math: $$\\int_0^\\infty e^{-x} dx = 1$$
- Fractions: $\\frac{a}{b}$
- Greek letters: $\\alpha, \\beta, \\gamma$
- Logic symbols: $\\land, \\lor, \\neg, \\rightarrow$

Be helpful, knowledgeable, and provide detailed responses. If the user asks you to create assignments or exam questions, make them comprehensive and well-formatted.`
        }
      ];

      // Add conversation history
      if (history && Array.isArray(history)) {
        history.forEach(msg => {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        });
      }

      // Add current message
      messages.push({
        role: "user",
        content: message
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000
      });

      const aiResponse = response.choices[0].message.content || "I apologize, but I couldn't generate a response. Please try again.";
      
      // CREDIT SYSTEM: Apply preview logic for users without sufficient credits
      let finalResponse = aiResponse;
      let creditsDeducted = 0;
      let isPreview = false;

      // Check if user is unlimited (gets full access always)
      let isUnlimitedUser = false;
      if (isRegistered) {
        const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        const unlimitedUsers = ['JMKUCZYNSKI', 'JMKUCZYNSKI2', 'RANDYJOHNSON'];
        isUnlimitedUser = user.length > 0 && unlimitedUsers.includes(user[0].username.toUpperCase());
      }

      if (!isRegistered || (!hasCredits && !isUnlimitedUser)) {
        // For unregistered users OR registered users without sufficient credits, provide preview
        finalResponse = generatePreview(aiResponse);
        isPreview = true;
        console.log(`Generated chat preview for ${!isRegistered ? 'unregistered' : 'registered but insufficient credits'} user. Preview length: ${finalResponse.length}`);
      } else {
        // Deduct credits for registered users with sufficient credits (unless unlimited)
        if (!isUnlimitedUser) {
          const deductionResult = await deductCredits(userId, TOKEN_COSTS.chat, 'chat', 'AI chat conversation');
          if (deductionResult) {
            creditsDeducted = TOKEN_COSTS.chat;
            console.log(`Deducted ${creditsDeducted} credits from user ${userId}`);
          }
        } else {
          console.log(`Unlimited user ${req.session?.username} - no credit deduction`);
        }
      }
      
      res.json({ 
        response: finalResponse,
        creditsDeducted,
        isPreview
      });
    } catch (error) {
      console.error('Error in chat with AI:', error);
      res.status(500).json({ error: 'Failed to get AI response' });
    }
  });

  // API route for regenerating feedback - PURE PASS-THROUGH IMPLEMENTATION
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

      const userId = req.session?.userId;
      const isRegistered = !!userId;
      const hasCredits = isRegistered && await checkCredits(userId, TOKEN_COSTS.grading);
      
      // Pass through the professor's feedback directly without any modification
      let systemPrompt;
      
      // Extract the student name from the request if available
      const studentName = req.body.studentName || "Student";
      
      // Customize the prompt based on the grading adjustment option
      if (gradeAdjustment === 'comments_only') {
        systemPrompt = `
Here is the original student submission, assignment text, grading instructions, and the initial grade you gave: ${currentGrade}.

The professor has provided this feedback: "${professorFeedback}"

IMPORTANT INSTRUCTIONS:
1. Please completely re-evaluate this submission. Consider both the grade and the comments based on the professor's feedback.
2. ALWAYS address the student directly using their name: "${studentName}". Do not refer to them as "the student" or in the third person.
3. Use a straightforward writing style without markdown formatting. Do not use # for headings, * for bullet points, or ** for bold text.
4. Begin your feedback with "GRADE: [numerical grade]" then directly address the student by name.
5. Feel free to adjust the grade up or down if warranted by the reevaluation.
`;
      } else {
        systemPrompt = `
Here is the original student submission, assignment text, grading instructions, and the initial grade you gave: ${currentGrade}.

The professor has provided this feedback: "${professorFeedback}"

The professor indicates the grade should be ${gradeAdjustment === 'higher' ? 'higher' : gradeAdjustment === 'lower' ? 'lower' : 'kept the same'}.

IMPORTANT INSTRUCTIONS:
1. Please regenerate your feedback taking the professor's input into account.
2. ALWAYS address the student directly using their name: "${studentName}". Do not refer to them as "the student" or in the third person.
3. Use a straightforward writing style without markdown formatting. Do not use # for headings, * for bullet points, or ** for bold text.
4. Begin your feedback with "GRADE: [numerical grade]" then directly address the student by name.
5. Make sure your tone is encouraging and constructive.
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
      
      // Check if response is a JSON string and try to extract the actual content
      if (response.trim().startsWith('{"') && response.trim().endsWith('}')) {
        try {
          const parsed = JSON.parse(response);
          if (parsed.result) {
            // If it's wrapped in a "result" field, extract and clean the content
            const cleanedResponse = cleanMarkdownFormatting(parsed.result);
            return res.send(cleanedResponse);
          }
        } catch (e) {
          // If parsing fails, continue with the original response
          console.log("Failed to parse JSON response, continuing with raw response");
        }
      }
      
      // Clean any markdown from the response
      const cleanedResponse = cleanMarkdownFormatting(response);
      
      // Check for markdown that wasn't properly cleaned (additional safety measure)
      const stillHasMarkdown = /#{1,6}\s+|(\*\*|\*|__|_)(.+?)(\*\*|\*|__|_)/.test(cleanedResponse);
      if (stillHasMarkdown) {
        console.log("Warning: Response still contains markdown after cleaning");
      }
      
      // Apply credit system and preview logic
      let finalResponse = cleanedResponse;
      let creditsDeducted = 0;
      let isPreview = false;

      if (!isRegistered || !hasCredits) {
        if (isRegistered) {
          return res.status(402).json({ 
            error: 'Insufficient credits. Please purchase more credits to continue.',
            requiredCredits: TOKEN_COSTS.grading,
            action: 'grading'
          });
        }
        // For unregistered users, provide preview
        finalResponse = generatePreview(cleanedResponse);
        isPreview = true;
      } else {
        // Deduct credits for registered users with sufficient credits
        await deductCredits(userId, TOKEN_COSTS.grading, 'grading', 'Regenerate feedback');
        creditsDeducted = TOKEN_COSTS.grading;
      }
      
      return res.json({
        result: finalResponse,
        creditsDeducted,
        isPreview
      });
    } catch (error) {
      console.error('Error regenerating feedback:', error);
      res.status(500).send(`Error regenerating feedback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
  
  // API endpoint to get all student grades
  // Generate perfect exemplary answer endpoint
  app.post('/api/regenerate-perfect-answer', async (req: Request, res: Response) => {
    try {
      const { 
        assignmentText,
        gradingText,
        currentAnswer,
        critique,
        llmProvider,
        llmModel,
        temperature,
        gradeLevel
      } = req.body;

      if (!assignmentText || !currentAnswer || !critique) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Enhanced prompt for regenerating based on critique
      const regeneratePrompt = `You are an expert academic writer tasked with improving a perfect assignment answer based on specific feedback.

ASSIGNMENT PROMPT:
${assignmentText}

GRADING CRITERIA:
${gradingText || 'Standard academic evaluation criteria'}

CURRENT PERFECT ANSWER:
${currentAnswer}

CRITIQUE AND IMPROVEMENT SUGGESTIONS:
${critique}

GRADE LEVEL: ${gradeLevel}

Your task is to regenerate an improved version of the perfect answer that addresses all the critique points while maintaining the highest academic standards. The new answer should:

1. Address every point mentioned in the critique
2. Maintain or exceed the quality of the original answer
3. Be appropriate for the ${gradeLevel} academic level
4. Include proper mathematical notation where applicable (use clear text format, not markup)
5. Demonstrate mastery of the subject matter
6. Follow proper academic writing conventions

Generate an improved perfect answer that would receive 100/100 points:`;

      let perfectAnswer = '';

      if (llmProvider === 'perplexity') {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: llmModel,
            messages: [
              { role: 'system', content: 'You are an expert academic writer and educator.' },
              { role: 'user', content: regeneratePrompt }
            ],
            temperature: temperature,
            max_tokens: 2000,
          }),
        });

        if (!response.ok) {
          throw new Error(`Perplexity API error: ${response.status}`);
        }

        const data = await response.json();
        perfectAnswer = data.choices[0]?.message?.content || 'No response generated';
      }
      // Add other providers as needed

      // Clean the response
      perfectAnswer = cleanMarkdownFormatting(perfectAnswer);
      
      res.json({ perfectAnswer });
    } catch (error) {
      console.error('Error regenerating perfect answer:', error);
      res.status(500).json({ error: 'Failed to regenerate perfect answer' });
    }
  });

  // New endpoint for chunked perfect answer generation
  app.post('/api/generate-perfect-answer-chunked', async (req: Request, res: Response) => {
    try {
      const { assignmentText, gradeLevel, provider = 'anthropic', model = 'claude-3-7-sonnet-20250219', temperature = 0.3 } = req.body;
      
      if (!assignmentText) {
        return res.status(400).json({ message: 'Assignment text is required' });
      }

      // Extract word count requirement from assignment
      const wordCountMatch = assignmentText.match(/(\d+)\s*words?/i);
      const requiredWords = wordCountMatch ? parseInt(wordCountMatch[1]) : 1000;
      
      // Determine if we need chunked processing (>1000 words)
      const needsChunking = requiredWords > 1000;
      const wordsPerChunk = 800; // Slightly under 1000 to be safe
      const totalChunks = needsChunking ? Math.ceil(requiredWords / wordsPerChunk) : 1;

      // Set up Server-Sent Events for real-time updates
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      let fullAnswer = '';
      
      if (!needsChunking) {
        // For assignments under 1000 words, process normally
        let result: string;
        
        if (provider === 'openai') {
          result = await generateOpenAIResponse({
            model: model || 'gpt-4o',
            temperature: parseFloat(temperature),
            assignmentText,
            gradingText: '',
            studentText: '',
            instructionsText: `Generate a PERFECT, EXEMPLARY student response to this assignment that would earn 100/100 points (A+). 

CRITICAL WORD COUNT REQUIREMENT: This response MUST be at least ${requiredWords} words long. If the assignment specifies a minimum word count, you MUST exceed it to ensure a perfect grade.`
          });
        } else if (provider === 'perplexity') {
          result = await generatePerplexityResponse({
            model: model || 'llama-3.1-sonar-small-128k-online',
            temperature: parseFloat(temperature),
            assignmentText,
            gradingText: '',
            studentText: '',
            instructionsText: `Generate a PERFECT, EXEMPLARY student response to this assignment that would earn 100/100 points (A+). 

CRITICAL WORD COUNT REQUIREMENT: This response MUST be at least ${requiredWords} words long. If the assignment specifies a minimum word count, you MUST exceed it to ensure a perfect grade.`
          });
        } else {
          // Use DeepSeek for faster generation
          const deepseekResponse = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'deepseek-chat',
              messages: [
                { 
                  role: 'system', 
                  content: 'You are a brilliant academic expert creating perfect assignment answers. Generate comprehensive, scholarly responses that demonstrate complete mastery.' 
                },
                { 
                  role: 'user', 
                  content: `Generate a PERFECT, EXEMPLARY student response to this assignment that would earn 100/100 points (A+).

Assignment: ${assignmentText}

CRITICAL WORD COUNT REQUIREMENT: This response MUST be at least ${requiredWords} words long. Write comprehensive, detailed content that fully addresses all requirements.`
                }
              ],
              max_tokens: 8000,
              temperature: parseFloat(temperature) || 0.3,
              stream: false
            })
          });

          if (!deepseekResponse.ok) {
            const errorData = await deepseekResponse.json();
            throw new Error(`DeepSeek API error: ${deepseekResponse.status} - ${JSON.stringify(errorData)}`);
          }

          const deepseekData = await deepseekResponse.json();
          result = deepseekData.choices[0].message.content;
        }

        // Send the complete result
        res.write(`data: ${JSON.stringify({ 
          type: 'chunk', 
          chunk: result, 
          chunkNumber: 1, 
          totalChunks: 1, 
          isComplete: true,
          fullText: result
        })}\n\n`);
        
      } else {
        // For large assignments, process in chunks
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
          const chunkNumber = chunkIndex + 1;
          const isFirstChunk = chunkIndex === 0;
          const isLastChunk = chunkIndex === totalChunks - 1;
          
          let chunkInstructions = '';
          if (isFirstChunk) {
            chunkInstructions = `Generate the FIRST part (approximately ${wordsPerChunk} words) of a PERFECT, EXEMPLARY student response to this assignment that would earn 100/100 points (A+). 

This is part ${chunkNumber} of ${totalChunks} total parts. Focus on the introduction and initial main points. Write in a scholarly, well-researched manner that demonstrates deep understanding.

IMPORTANT: This is only the beginning - do NOT conclude or summarize yet. End this section naturally so it can continue seamlessly.`;
          } else if (isLastChunk) {
            const remainingWords = requiredWords - (chunkIndex * wordsPerChunk);
            chunkInstructions = `Generate the FINAL part (approximately ${remainingWords} words) of a PERFECT, EXEMPLARY student response to this assignment that would earn 100/100 points (A+).

This is part ${chunkNumber} of ${totalChunks} total parts - the CONCLUSION section. 

Previous content written so far:
${fullAnswer}

Continue seamlessly from where the previous part ended. Provide a strong conclusion, final analysis, and proper ending that ties everything together. Ensure the total response meets the ${requiredWords}+ word requirement.`;
          } else {
            chunkInstructions = `Generate the MIDDLE part ${chunkNumber} (approximately ${wordsPerChunk} words) of a PERFECT, EXEMPLARY student response to this assignment that would earn 100/100 points (A+).

This is part ${chunkNumber} of ${totalChunks} total parts.

Previous content written so far:
${fullAnswer}

Continue seamlessly from where the previous part ended. Develop the main arguments and provide detailed analysis. Do NOT conclude yet - this is a middle section.`;
          }

          let chunkResult: string;
          
          if (provider === 'openai') {
            chunkResult = await generateOpenAIResponse({
              model: model || 'gpt-4o',
              temperature: parseFloat(temperature),
              assignmentText,
              gradingText: '',
              studentText: '',
              instructionsText: chunkInstructions
            });
          } else if (provider === 'perplexity') {
            chunkResult = await generatePerplexityResponse({
              model: model || 'llama-3.1-sonar-small-128k-online',
              temperature: parseFloat(temperature),
              assignmentText,
              gradingText: '',
              studentText: '',
              instructionsText: chunkInstructions
            });
          } else {
            // Use DeepSeek for chunked generation since it's faster and more reliable
            const deepseekResponse = await fetch('https://api.deepseek.com/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                  { 
                    role: 'system', 
                    content: 'You are a brilliant academic expert creating perfect assignment answers. Generate comprehensive, scholarly responses that demonstrate complete mastery.' 
                  },
                  { 
                    role: 'user', 
                    content: `${chunkInstructions}\n\nAssignment: ${assignmentText}`
                  }
                ],
                max_tokens: 4000,
                temperature: parseFloat(temperature) || 0.3,
                stream: false
              })
            });

            if (!deepseekResponse.ok) {
              const errorData = await deepseekResponse.json();
              throw new Error(`DeepSeek API error: ${deepseekResponse.status} - ${JSON.stringify(errorData)}`);
            }

            const deepseekData = await deepseekResponse.json();
            chunkResult = deepseekData.choices[0].message.content;
          }

          fullAnswer += (fullAnswer ? '\n\n' : '') + chunkResult;

          // Send this chunk to the client immediately
          res.write(`data: ${JSON.stringify({ 
            type: 'chunk', 
            chunk: chunkResult, 
            chunkNumber, 
            totalChunks, 
            isComplete: isLastChunk,
            fullText: fullAnswer
          })}\n\n`);
        }
      }

      // Clean the fullAnswer
      const cleanedAnswer = cleanMarkdownFormatting(fullAnswer);
      
      // Store full answer in session for retrieval after registration/payment
      try {
        if (!req.session.sessionDrafts) {
          req.session.sessionDrafts = {};
        }
        
        req.session.sessionDrafts.latestPerfectAnswer = {
          fullAnswer: cleanedAnswer,
          assignmentText,
          gradeLevel: gradeLevel || 'undergraduate_regular',
          provider: provider || 'deepseek',
          model: model || 'deepseek-chat',
          timestamp: new Date().toISOString()
        };
        
        console.log('Perfect answer saved to session storage');
      } catch (error) {
        console.error('Error saving to session storage:', error);
      }

      // Send completion signal
      res.write(`data: ${JSON.stringify({ 
        type: 'complete', 
        fullText: cleanedAnswer,
        grade: '100/100',
        letterGrade: 'A+'
      })}\n\n`);
      
      res.end();
      
    } catch (error: any) {
      console.error('Error generating chunked perfect answer:', error);
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        message: 'Failed to generate perfect answer: ' + error.message 
      })}\n\n`);
      res.end();
    }
  });

  app.post('/api/generate-perfect-answer', async (req: Request, res: Response) => {
    try {
      const { assignmentText, gradeLevel, provider = 'anthropic', model = 'claude-3-7-sonnet-20250219', temperature = 0.3 } = req.body;
      
      if (!assignmentText) {
        return res.status(400).json({ message: 'Assignment text is required' });
      }

      // CREDIT SYSTEM: Check user authentication and credits
      const isRegistered = req.session?.userId !== undefined;
      const userId = req.session?.userId;
      const hasCredits = isRegistered ? await checkCredits(userId, TOKEN_COSTS.perfect_essay) : false;

      console.log(`Perfect answer request - Registered: ${isRegistered}, User ID: ${userId}, Has credits: ${hasCredits}`);

      // Extract word count requirement from assignment
      const wordCountMatch = assignmentText.match(/(\d+)\s*words?/i);
      const requiredWords = wordCountMatch ? parseInt(wordCountMatch[1]) : 1000;
      
      // Ensure minimum word count is met - add buffer for safety
      const targetWords = Math.max(requiredWords, 1000) + 500; // Larger buffer to ensure completion

      let result: string = '';
      
      if (provider === 'deepseek') {
        // Use DeepSeek API directly
        console.log('Using DeepSeek model:', model || 'deepseek-chat');
        
        const deepseekResponse = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model || 'deepseek-chat',
            messages: [
              { 
                role: 'system', 
                content: `You are a brilliant academic expert creating perfect assignment answers. Generate comprehensive, scholarly responses that demonstrate complete mastery of the topic and would earn 100/100 points.` 
              },
              { 
                role: 'user', 
                content: `IMPORTANT: Generate a perfect answer for this assignment that would earn 100/100 points.

Assignment: ${assignmentText}

Target length: ${targetWords} words minimum.

Requirements:
- Demonstrate deep understanding
- Use proper academic formatting
- Include relevant examples and analysis
- Meet all assignment criteria
- Write at ${gradeLevel} academic level
- MINIMUM ${requiredWords} words (write MORE rather than less)

Write ONLY the student response - no introductions, explanations, or meta-commentary. Output clean text with no markdown formatting.` 
              }
            ],
            max_tokens: 8000,
            temperature: parseFloat(temperature) || 0.3,
            stream: false
          })
        });

        if (!deepseekResponse.ok) {
          const errorData = await deepseekResponse.json();
          throw new Error(`DeepSeek API error: ${deepseekResponse.status} - ${JSON.stringify(errorData)}`);
        }

        const deepseekData = await deepseekResponse.json();
        console.log('DeepSeek API response successful, length:', deepseekData.choices[0].message.content.length);
        result = deepseekData.choices[0].message.content;
      } else if (provider === 'openai') {
        result = await generateOpenAIResponse({
          model: model || 'gpt-4o',
          temperature: parseFloat(temperature),
          assignmentText,
          gradingText: '',
          studentText: '',
          instructionsText: `Generate a PERFECT, EXEMPLARY student response to this assignment that would earn 100/100 points (A+). 

CRITICAL WORD COUNT REQUIREMENT: This response MUST be at least ${requiredWords} words long. If the assignment specifies a minimum word count, you MUST exceed it to ensure a perfect grade.

The response should demonstrate mastery at the ${gradeLevel || 'College Undergraduate'} level with:
- Exceptional depth of analysis and critical thinking
- Perfect organization and structure
- Comprehensive coverage of all assignment requirements
- Advanced vocabulary and writing quality appropriate for the academic level
- Original insights and sophisticated argumentation
- Flawless execution of all specified tasks
- MINIMUM ${requiredWords} words (write MORE rather than less)

Create the response as if you are the ideal student submitting this assignment.`,
          isExemplar: true,
          gradeLevel: gradeLevel || 'College Undergraduate'
        });
      } else if (provider === 'anthropic') {
        result = await generateAnthropicResponse({
          model: model || 'claude-3-7-sonnet-20250219',
          temperature: parseFloat(temperature),
          assignmentText,
          gradingText: '',
          studentText: '',
          instructionsText: `You are the perfect ${gradeLevel || 'College Undergraduate'} student. Generate an EXCEPTIONAL response to this exact assignment that would earn 100/100 points.

CRITICAL WORD COUNT REQUIREMENT: This response MUST be at least ${requiredWords} words long. If the assignment specifies a minimum word count, you MUST exceed it to ensure a perfect grade.

ASSIGNMENT TO COMPLETE:
${assignmentText}

Your response must:
1. Address every single requirement in the assignment prompt
2. Demonstrate mastery-level understanding and analysis
3. Use sophisticated academic language appropriate for ${gradeLevel || 'College Undergraduate'} level
4. Show original critical thinking and insights
5. Be perfectly organized with clear structure
6. Include specific examples and evidence where appropriate
7. MINIMUM ${requiredWords} words (write MORE rather than less)
8. Meet or exceed all specified length/format requirements

Write ONLY the student response - no introductions, explanations, or meta-commentary. Output clean text with no markdown formatting.`,
          isExemplar: true,
          gradeLevel: gradeLevel || 'College Undergraduate'
        });
      } else if (provider === 'perplexity') {
        result = await generatePerplexityResponse({
          model: model || 'llama-3.1-sonar-large-128k-online',
          temperature: parseFloat(temperature),
          assignmentText,
          gradingText: '',
          studentText: '',
          instructionsText: `Generate a PERFECT, EXEMPLARY student response to this assignment that would earn 100/100 points (A+). 

CRITICAL WORD COUNT REQUIREMENT: This response MUST be at least ${requiredWords} words long. If the assignment specifies a minimum word count, you MUST exceed it to ensure a perfect grade.

The response should demonstrate mastery at the ${gradeLevel || 'College Undergraduate'} level with:
- Exceptional depth of analysis and critical thinking
- Perfect organization and structure
- Comprehensive coverage of all assignment requirements
- Advanced vocabulary and writing quality appropriate for the academic level
- Original insights and sophisticated argumentation
- Flawless execution of all specified tasks
- MINIMUM ${requiredWords} words (write MORE rather than less)

Create the response as if you are the ideal student submitting this assignment.`,
          isExemplar: true,
          gradeLevel: gradeLevel || 'College Undergraduate'
        });
      }

      // Check if response appears incomplete (ends mid-sentence or is too short)
      const actualWordCount = result.split(/\s+/).filter(word => word.length > 0).length;
      const isIncomplete = result.trim().match(/[^.!?]$/) || 
                          result.includes("...") || 
                          actualWordCount < requiredWords * 0.8 ||
                          result.trim().endsWith(',') ||
                          result.trim().endsWith(';') ||
                          result.trim().endsWith(':');
      
      if (isIncomplete) {
        console.log(`Response appears incomplete (${actualWordCount} words vs ${requiredWords} required). Attempting to complete...`);
        
        // Try to complete the response
        const completionPrompt = `The following response to an academic assignment appears to be incomplete or cut off mid-sentence. Please complete it properly with a strong conclusion:

${result}

Complete this response ensuring it:
1. Ends with proper conclusions and complete sentences
2. Meets the ${requiredWords} word requirement 
3. Provides a satisfying ending to the academic work
4. Does not repeat what was already written

Continue from where it left off and provide a proper ending:`;

        let completion: string;
        try {
          if (provider === 'anthropic') {
            completion = await generateAnthropicResponse({
              model: model || 'claude-3-7-sonnet-20250219',
              temperature: parseFloat(temperature),
              assignmentText: completionPrompt,
              gradingText: '',
              studentText: '',
              instructionsText: 'Complete the academic response properly with a conclusion.',
              isExemplar: true,
              gradeLevel: gradeLevel || 'College Undergraduate'
            });
          } else if (provider === 'openai') {
            completion = await generateOpenAIResponse({
              model: model || 'gpt-4o',
              temperature: parseFloat(temperature),
              assignmentText: completionPrompt,
              gradingText: '',
              studentText: '',
              instructionsText: 'Complete the academic response properly with a conclusion.',
              isExemplar: true,
              gradeLevel: gradeLevel || 'College Undergraduate'
            });
          } else {
            completion = await generatePerplexityResponse({
              model: model || 'llama-3.1-sonar-large-128k-online',
              temperature: parseFloat(temperature),
              assignmentText: completionPrompt,
              gradingText: '',
              studentText: '',
              instructionsText: 'Complete the academic response properly with a conclusion.',
              isExemplar: true,
              gradeLevel: gradeLevel || 'College Undergraduate'
            });
          }
          
          result = result + '\n\n' + completion;
          console.log(`Completion added. New word count: ${result.split(/\s+/).filter(word => word.length > 0).length}`);
        } catch (error) {
          console.error('Error completing response:', error);
        }
      }

      // Aggressive cleanup to remove ALL markup formatting
      result = result
        .replace(/\*\*(.*?)\*\*/g, '$1')     // Remove bold **text**
        .replace(/\*(.*?)\*/g, '$1')         // Remove italic *text*
        .replace(/`(.*?)`/g, '$1')           // Remove code `text`
        .replace(/#{1,6}\s*/g, '')           // Remove headers # ## ###
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')  // Remove links [text](url)
        .replace(/^\s*[-*+]\s+/gm, '')       // Remove bullet points
        .replace(/^\s*\d+\.\s+/gm, '')       // Remove numbered lists
        .replace(/>\s*/gm, '')               // Remove blockquotes >
        .replace(/---+/g, '')                // Remove horizontal rules
        .replace(/\n{3,}/g, '\n\n')          // Clean excessive newlines
        .trim();

      // CREDIT SYSTEM: Apply preview logic for users without sufficient credits
      let finalResponse = result;
      let creditsDeducted = 0;
      let isPreview = false;

      // Check if user is unlimited (gets full access always)
      let isUnlimitedUser = false;
      if (isRegistered) {
        const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        const unlimitedUsers = ['JMKUCZYNSKI', 'JMKUCZYNSKI2', 'RANDYJOHNSON'];
        isUnlimitedUser = user.length > 0 && unlimitedUsers.includes(user[0].username.toUpperCase());
      }

      if (!isRegistered || (!hasCredits && !isUnlimitedUser)) {
        // For unregistered users OR registered users without sufficient credits, provide preview
        finalResponse = generatePreview(result);
        isPreview = true;
        console.log(`Generated perfect answer preview for ${!isRegistered ? 'unregistered' : 'registered but insufficient credits'} user. Preview length: ${finalResponse.length}`);
      } else {
        // Deduct credits for registered users with sufficient credits (unless unlimited)
        if (!isUnlimitedUser) {
          const deductionResult = await deductCredits(userId, TOKEN_COSTS.perfect_essay, 'perfect_essay', 'Perfect assignment generation');
          if (deductionResult) {
            creditsDeducted = TOKEN_COSTS.perfect_essay;
            console.log(`Deducted ${creditsDeducted} credits from user ${userId}`);
          }
        } else {
          console.log(`Unlimited user ${req.session?.username} - no credit deduction`);
        }
      }

      // Store full answer in session for retrieval after registration/payment
      if (!req.session.sessionDrafts) {
        req.session.sessionDrafts = {};
      }
      req.session.sessionDrafts.latestPerfectAnswer = {
        fullAnswer: result, // Store complete answer before preview truncation
        assignmentText,
        gradeLevel,
        timestamp: new Date().toISOString(), // Store as ISO string for serialization
        provider,
        model
      };

      res.json({ 
        perfectAnswer: finalResponse,
        grade: '100/100',
        letterGrade: 'A+',
        creditsDeducted,
        isPreview
      });
      
    } catch (error: any) {
      console.error('Error generating perfect answer:', error);
      res.status(500).json({ message: 'Failed to generate perfect answer: ' + error.message });
    }
  });

  app.get('/api/student-grades', async (_req: Request, res: Response) => {
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
  
  // API routes for assignment management
  app.get('/api/assignments', async (req, res) => {
    try {
      console.log('GET /api/assignments request received');
      
      // Default to user ID 1 for now (we can add auth later)
      const userId = 1;
      console.log(`Fetching assignments for user ID: ${userId}`);
      
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
  
  app.get('/api/assignments/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid assignment ID' });
      }
      
      const assignment = await storage.getAssignment(id);
      
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
  
  // API endpoint to create an assignment
  app.post('/api/assignments', async (req, res) => {
    try {
      console.log('Received assignment creation request:', JSON.stringify(req.body, null, 2));
      
      // Ensure userId is set - default to 1 for development if not provided
      const reqWithUserId = {
        ...req.body,
        userId: req.body.userId || 1
      };
      
      console.log('Request with userId:', JSON.stringify(reqWithUserId, null, 2));
      
      // Validate the assignment data
      const result = insertAssignmentSchema.safeParse(reqWithUserId);
      
      if (!result.success) {
        console.error('Assignment validation failed:', result.error.errors);
        return res.status(400).json({ message: 'Invalid assignment data', errors: result.error.errors });
      }
      
      console.log('Validated assignment data:', JSON.stringify(result.data, null, 2));
      
      // Create the assignment
      const assignment = await storage.createAssignment(result.data);
      console.log('Created assignment:', JSON.stringify(assignment, null, 2));
      
      res.status(201).json(assignment);
    } catch (error) {
      console.error('Error creating assignment:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to create assignment'
      });
    }
  });
  
  // API endpoint to update an assignment (PATCH)
  app.patch('/api/assignments/:id', async (req, res) => {
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
  
  // API endpoint to update an assignment (PUT)
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
      const deleted = await storage.deleteAssignment(assignmentId);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Assignment not found' });
      }
      
      res.json({ message: 'Assignment deleted successfully' });
    } catch (error) {
      console.error('Error deleting assignment:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to delete assignment'
      });
    }
  });

  // PayPal payment routes - DISABLED to prevent crashes
  app.get("/paypal/setup", async (req, res) => {
    res.status(503).json({ error: 'PayPal payment option is temporarily unavailable. Please use Stripe.' });
  });

  app.post("/paypal/order", async (req, res) => {
    res.status(503).json({ error: 'PayPal payment option is temporarily unavailable. Please use Stripe.' });
  });

  app.post("/paypal/order/:orderID/capture", async (req, res) => {
    res.status(503).json({ error: 'PayPal payment option is temporarily unavailable. Please use Stripe.' });
  });

  // PayPal purchase initiation route - DISABLED
  app.post('/api/create-paypal-order', async (req: Request, res: Response) => {
    res.status(503).json({ error: 'PayPal payment option is temporarily unavailable. Please use Stripe.' });
  });

  // PayPal purchase completion route - DISABLED
  app.post('/api/complete-paypal-purchase', async (req: Request, res: Response) => {
    res.status(503).json({ error: 'PayPal payment option is temporarily unavailable. Please use Stripe.' });
  });

  // Session draft retrieval endpoint
  app.get('/api/session-draft', async (req: Request, res: Response) => {
    try {
      const sessionDrafts = req.session?.sessionDrafts || {};
      
      // Return the latest perfect answer if available
      if (sessionDrafts.latestPerfectAnswer) {
        const draft = sessionDrafts.latestPerfectAnswer;
        
        // Check if draft is recent (within last 24 hours)
        const draftAge = new Date().getTime() - new Date(draft.timestamp).getTime();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        
        if (draftAge < maxAge) {
          res.json({
            hasDraft: true,
            perfectAnswer: draft.fullAnswer,
            assignmentText: draft.assignmentText,
            gradeLevel: draft.gradeLevel,
            provider: draft.provider,
            model: draft.model,
            timestamp: draft.timestamp
          });
        } else {
          // Clear expired draft
          delete req.session.sessionDrafts.latestPerfectAnswer;
          res.json({ hasDraft: false });
        }
      } else {
        res.json({ hasDraft: false });
      }
    } catch (error) {
      console.error('Error retrieving session draft:', error);
      res.status(500).json({ error: 'Failed to retrieve session draft' });
    }
  });

  // Clear session draft endpoint
  app.post('/api/clear-session-draft', async (req: Request, res: Response) => {
    try {
      if (req.session?.sessionDrafts?.latestPerfectAnswer) {
        delete req.session.sessionDrafts.latestPerfectAnswer;
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error clearing session draft:', error);
      res.status(500).json({ error: 'Failed to clear session draft' });
    }
  });

  return httpServer;
}