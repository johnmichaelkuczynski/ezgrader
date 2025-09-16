import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { fileProcessorService } from "./services/fileProcessor";
import { textChunkerService } from "./services/textChunker";
import { gptZeroService } from "./services/gptZero";
import { aiProviderService } from "./services/aiProviders";
import { documentGeneratorService } from "./services/documentGenerator";
import { insertDocumentSchema, insertRewriteJobSchema, type RewriteRequest, type RewriteResponse } from "@shared/schema";
import { z } from "zod";

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

function cleanMarkup(text: string): string {
  return text
    // Remove markdown bold/italic markers
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove inline code backticks
    .replace(/`([^`]+)`/g, '$1')
    // Remove code block markers
    .replace(/```[\s\S]*?```/g, (match) => {
      return match.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '');
    })
    // Remove other common markdown symbols
    .replace(/~~([^~]+)~~/g, '$1') // strikethrough
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/>\s+/gm, '') // blockquotes
    // Remove excessive whitespace and clean up
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // File upload endpoint
  app.post("/api/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      await fileProcessorService.validateFile(req.file);
      const processedFile = await fileProcessorService.processFile(req.file.path, req.file.originalname);
      
      // Analyze with GPTZero
      const gptZeroResult = await gptZeroService.analyzeText(processedFile.content);
      
      // Create document record
      const document = await storage.createDocument({
        filename: processedFile.filename,
        content: processedFile.content,
        wordCount: processedFile.wordCount,
        aiScore: gptZeroResult.aiScore,
      });

      // Generate chunks if text is long enough
      const chunks = processedFile.wordCount > 500 
        ? textChunkerService.chunkText(processedFile.content)
        : [];

      // Analyze chunks if they exist
      if (chunks.length > 0) {
        const chunkTexts = chunks.map(chunk => chunk.content);
        const chunkResults = await gptZeroService.analyzeBatch(chunkTexts);
        
        chunks.forEach((chunk, index) => {
          chunk.aiScore = chunkResults[index].aiScore;
        });
      }

      res.json({
        document,
        chunks,
        aiScore: gptZeroResult.aiScore,
        needsChunking: processedFile.wordCount > 500,
      });
    } catch (error) {
      console.error('File upload error:', error);
      res.status(500).json({ message: error.message });
    }
  });


  // Text analysis endpoint (for direct text input)
  app.post("/api/analyze-text", async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ message: "Text is required" });
      }

      const gptZeroResult = await gptZeroService.analyzeText(text);
      const wordCount = text.trim().split(/\s+/).length;
      
      // Generate chunks if text is long enough
      const chunks = wordCount > 500 ? textChunkerService.chunkText(text) : [];
      
      // Analyze chunks if they exist
      if (chunks.length > 0) {
        const chunkTexts = chunks.map(chunk => chunk.content);
        const chunkResults = await gptZeroService.analyzeBatch(chunkTexts);
        
        chunks.forEach((chunk, index) => {
          chunk.aiScore = chunkResults[index].aiScore;
        });
      }

      res.json({
        aiScore: gptZeroResult.aiScore,
        wordCount,
        chunks,
        needsChunking: wordCount > 500,
      });
    } catch (error) {
      console.error('Text analysis error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Rewrite text endpoint
  app.post("/api/rewrite", async (req, res) => {
    try {
      const rewriteRequest: RewriteRequest = req.body;
      
      // Validate request
      if (!rewriteRequest.inputText || !rewriteRequest.provider) {
        return res.status(400).json({ message: "Input text and provider are required" });
      }

      // Analyze input text
      const inputAnalysis = await gptZeroService.analyzeText(rewriteRequest.inputText);
      
      // Create rewrite job
      const rewriteJob = await storage.createRewriteJob({
        inputText: rewriteRequest.inputText,
        styleText: rewriteRequest.styleText,
        contentMixText: rewriteRequest.contentMixText,
        customInstructions: rewriteRequest.customInstructions,
        selectedPresets: rewriteRequest.selectedPresets,
        provider: rewriteRequest.provider,
        chunks: [],
        selectedChunkIds: rewriteRequest.selectedChunkIds,
        mixingMode: rewriteRequest.mixingMode,
        inputAiScore: inputAnalysis.aiScore,
        status: "processing",
      });

      try {
        // Perform rewrite
        const rewrittenText = await aiProviderService.rewrite(rewriteRequest.provider, {
          inputText: rewriteRequest.inputText,
          styleText: rewriteRequest.styleText,
          contentMixText: rewriteRequest.contentMixText,
          customInstructions: rewriteRequest.customInstructions,
          selectedPresets: rewriteRequest.selectedPresets,
          mixingMode: rewriteRequest.mixingMode,
        });

        // Analyze output text
        const outputAnalysis = await gptZeroService.analyzeText(rewrittenText);

        // Clean markup from rewritten text
        const cleanedRewrittenText = cleanMarkup(rewrittenText);

        // Update job with results
        await storage.updateRewriteJob(rewriteJob.id, {
          outputText: cleanedRewrittenText,
          outputAiScore: outputAnalysis.aiScore,
          status: "completed",
        });

        const response: RewriteResponse = {
          rewrittenText: cleanMarkup(rewrittenText),
          inputAiScore: inputAnalysis.aiScore,
          outputAiScore: outputAnalysis.aiScore,
          jobId: rewriteJob.id,
        };

        res.json(response);
      } catch (error) {
        // Update job with error status
        await storage.updateRewriteJob(rewriteJob.id, {
          status: "failed",
        });
        throw error;
      }
    } catch (error) {
      console.error('Rewrite error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Re-rewrite endpoint
  app.post("/api/re-rewrite/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      const { customInstructions, selectedPresets, provider } = req.body;
      
      const originalJob = await storage.getRewriteJob(jobId);
      if (!originalJob || !originalJob.outputText) {
        return res.status(404).json({ message: "Original job not found or incomplete" });
      }

      // Create new rewrite job using the previous output as input
      const rewriteJob = await storage.createRewriteJob({
        inputText: originalJob.outputText,
        styleText: originalJob.styleText,
        contentMixText: originalJob.contentMixText,
        customInstructions: customInstructions || originalJob.customInstructions,
        selectedPresets: selectedPresets || originalJob.selectedPresets,
        provider: provider || originalJob.provider,
        chunks: [],
        selectedChunkIds: [],
        mixingMode: originalJob.mixingMode,
        inputAiScore: originalJob.outputAiScore,
        status: "processing",
      });

      try {
        // Debug logging for re-rewrite
        console.log("🔥 RE-REWRITE DEBUG - Original Job ID:", jobId);
        console.log("🔥 RE-REWRITE DEBUG - Input text (first 200 chars):", originalJob.outputText?.substring(0, 200));
        console.log("🔥 RE-REWRITE DEBUG - Style text (first 100 chars):", originalJob.styleText?.substring(0, 100) || "none");
        console.log("🔥 RE-REWRITE DEBUG - Provider:", provider || originalJob.provider);
        console.log("🔥 RE-REWRITE DEBUG - Custom instructions:", customInstructions || originalJob.customInstructions || "none");
        console.log("🔥 RE-REWRITE DEBUG - Selected presets:", selectedPresets || originalJob.selectedPresets || "none");
        
        // Perform re-rewrite
        const rewrittenText = await aiProviderService.rewrite(provider || originalJob.provider, {
          inputText: originalJob.outputText,
          styleText: originalJob.styleText,
          contentMixText: originalJob.contentMixText,
          customInstructions: customInstructions || originalJob.customInstructions,
          selectedPresets: selectedPresets || originalJob.selectedPresets,
          mixingMode: originalJob.mixingMode,
        });

        // Analyze new output
        const outputAnalysis = await gptZeroService.analyzeText(rewrittenText);

        // Clean markup from output
        const cleanedRewrittenText = cleanMarkup(rewrittenText);

        // Update job with results
        await storage.updateRewriteJob(rewriteJob.id, {
          outputText: cleanedRewrittenText,
          outputAiScore: outputAnalysis.aiScore,
          status: "completed",
        });

        const response: RewriteResponse = {
          rewrittenText: cleanedRewrittenText,
          inputAiScore: originalJob.outputAiScore || 0,
          outputAiScore: outputAnalysis.aiScore,
          jobId: rewriteJob.id,
        };

        res.json(response);
      } catch (error) {
        await storage.updateRewriteJob(rewriteJob.id, { status: "failed" });
        throw error;
      }
    } catch (error) {
      console.error('Re-rewrite error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get rewrite job status
  app.get("/api/jobs/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      const job = await storage.getRewriteJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      res.json(job);
    } catch (error) {
      console.error('Get job error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // List recent jobs
  app.get("/api/jobs", async (req, res) => {
    try {
      const jobs = await storage.listRewriteJobs();
      res.json(jobs);
    } catch (error) {
      console.error('List jobs error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // API Keys endpoint
  app.post("/api/set-keys", async (req, res) => {
    try {
      const { openai, anthropic, deepseek, perplexity, gptzero } = req.body;
      
      // Store keys in environment variables
      if (openai) process.env.OPENAI_API_KEY = openai;
      if (anthropic) process.env.ANTHROPIC_API_KEY = anthropic;
      if (deepseek) process.env.DEEPSEEK_API_KEY = deepseek;
      if (perplexity) process.env.PERPLEXITY_API_KEY = perplexity;
      if (gptzero) process.env.GPTZERO_API_KEY = gptzero;
      
      console.log("🔑 API Keys updated successfully");
      res.json({ success: true });
    } catch (error) {
      console.error('Set keys error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Download endpoints
  app.post("/api/download/:format", async (req, res) => {
    try {
      const { format } = req.params;
      const { content, filename } = req.body;
      
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ message: "Content is required" });
      }
      
      if (!['pdf', 'docx', 'txt'].includes(format)) {
        return res.status(400).json({ message: "Invalid format. Supported: pdf, docx, txt" });
      }
      
      const baseFilename = filename || 'rewritten-text';
      let buffer: Buffer;
      let mimeType: string;
      let downloadFilename: string;
      
      switch (format) {
        case 'pdf':
          buffer = await documentGeneratorService.generatePDF(content, baseFilename);
          mimeType = 'application/pdf';
          downloadFilename = `${baseFilename}.pdf`;
          break;
        case 'docx':
          buffer = await documentGeneratorService.generateDOCX(content, baseFilename);
          mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          downloadFilename = `${baseFilename}.docx`;
          break;
        case 'txt':
          buffer = documentGeneratorService.generateTXT(content);
          mimeType = 'text/plain';
          downloadFilename = `${baseFilename}.txt`;
          break;
        default:
          return res.status(400).json({ message: "Unsupported format" });
      }
      
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
      res.setHeader('Content-Length', buffer.length.toString());
      
      res.end(buffer);
    } catch (error: any) {
      console.error('Download error:', error);
      res.status(500).json({ message: `Failed to generate ${req.params.format.toUpperCase()} file: ${error.message}` });
    }
  });

  // Chat endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, provider, context } = req.body;
      
      if (!message || !provider) {
        return res.status(400).json({ error: "Message and provider are required" });
      }

      console.log(`🔥 CHAT REQUEST - Provider: ${provider}, Message: "${message}"`);
      console.log(`🔥 CHAT CONTEXT:`, context);

      // Build context-aware system instructions
      let contextInfo = "";
      let providerName = "";
      
      switch (provider) {
        case 'openai':
          providerName = "Zhi 1";
          break;
        case 'anthropic':
          providerName = "Zhi 2";
          break;
        case 'deepseek':
          providerName = "Zhi 3";
          break;
        case 'perplexity':
          providerName = "Zhi 4";
          break;
      }

      if (context) {
        contextInfo = "\n\nCONTEXT - You have access to the following content from the GPT Bypass text rewriting application:\n";
        
        if (context.inputText) {
          contextInfo += `\nINPUT TEXT (Box A - text to be rewritten): "${context.inputText}"\n`;
        }
        
        if (context.styleText) {
          contextInfo += `\nSTYLE SAMPLE (Box B - writing style to mimic): "${context.styleText}"\n`;
        }
        
        if (context.contentMixText) {
          contextInfo += `\nCONTENT REFERENCE (Box C - content to blend/mix): "${context.contentMixText}"\n`;
        }
        
        if (context.outputText) {
          contextInfo += `\nREWRITTEN OUTPUT (Box D - current rewrite result): "${context.outputText}"\n`;
        }
        
        contextInfo += `\nYou can help analyze, improve, or work with any of this content. You understand the text rewriting workflow and can provide insights about style analysis, content mixing, and rewriting strategies.`;
      }

      const systemInstructions = `You are ${providerName}, a helpful AI assistant integrated into a GPT Bypass text rewriting application. Answer the user's question directly and clearly. If asked which LLM you are, respond that you are ${providerName}.${contextInfo}`;

      let response: string;
      
      switch (provider) {
        case 'openai':
          response = await aiProviderService.rewriteWithOpenAI({ 
            inputText: message,
            customInstructions: systemInstructions
          });
          break;
        case 'anthropic':
          response = await aiProviderService.rewriteWithAnthropic({ 
            inputText: message,
            customInstructions: systemInstructions
          });
          break;
        case 'deepseek':
          response = await aiProviderService.rewriteWithDeepSeek({ 
            inputText: message,
            customInstructions: systemInstructions
          });
          break;
        case 'perplexity':
          response = await aiProviderService.rewriteWithPerplexity({ 
            inputText: message,
            customInstructions: systemInstructions
          });
          break;
        default:
          return res.status(400).json({ error: "Invalid provider" });
      }

      console.log(`🔥 CHAT RESPONSE - Length: ${response?.length || 0}`);
      res.json({ response: cleanMarkup(response) });
    } catch (error: any) {
      console.error('Chat error:', error);
      res.status(500).json({ 
        error: `Chat API Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error instanceof Error ? error.toString() : String(error)
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
