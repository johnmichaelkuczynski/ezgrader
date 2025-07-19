/**
 * REPLIT CHUNKING IMPLEMENTATION
 * 
 * This module implements the chunking strategy for handling extremely long student submissions
 * according to the Replit chunking specification.
 */

import { generateOpenAIResponse } from "../services/openai";
import { generateAnthropicResponse } from "../services/anthropic";
import { generatePerplexityResponse } from "../services/perplexity";

// Token counting - using more accurate estimates for different models
// Based on OpenAI, Claude and Perplexity documentation
const CHARS_PER_TOKEN = 4; // Average for English text
const WORDS_PER_TOKEN = 0.75; // Approximately 4 tokens for 3 words

// Default thresholds - increased to handle extremely large documents
const TOKEN_THRESHOLD = 8000; // Minimum threshold to start chunking
const CHUNK_SIZE_TOKENS = 8000; // Chunk size increased to process large assignments more efficiently

// Estimated token counts for different providers
// Updated token thresholds based on Replit specifications for handling extremely large documents (up to 400K words)
const PROVIDER_THRESHOLDS: Record<string, number> = {
  'openai': 8000,       // OpenAI GPT-4o has a ~128k context window (~32K tokens)
  'anthropic': 20000,   // Claude 3 has up to a 200K token context window
  'perplexity': 40000,  // Perplexity LLama 3.1 Sonar models have a 128K context window
  'default': 8000
};

/**
 * Estimates token count using a hybrid approach of character and word counts
 * This is more accurate for extremely large documents
 */
function estimateTokenCount(text: string): number {
  // Use both character-based and word-based estimates and take the higher one
  // This helps account for different languages and text with special characters
  const charBasedEstimate = Math.ceil(text.length / CHARS_PER_TOKEN);
  
  // Count words for word-based estimate
  // This handles cases where there might be very long words or technical terms
  const wordCount = text.split(/\s+/).length;
  const wordBasedEstimate = Math.ceil(wordCount / WORDS_PER_TOKEN);
  
  // Return the higher estimate to be conservative
  return Math.max(charBasedEstimate, wordBasedEstimate);
}

/**
 * Checks if the combined inputs exceed the token threshold and need to be processed in chunks
 * This handles extremely large assignments up to 400K words by intelligently determining when chunking is needed
 */
export function needsChunking(
  provider: string,
  assignmentText: string,
  gradingText: string, 
  studentText: string
): boolean {
  const threshold = PROVIDER_THRESHOLDS[provider] || PROVIDER_THRESHOLDS.default;
  
  // Get detailed token counts for each component
  const assignmentTokens = estimateTokenCount(assignmentText);
  const gradingTokens = estimateTokenCount(gradingText);
  const studentTokens = estimateTokenCount(studentText);
  const totalTokens = assignmentTokens + gradingTokens + studentTokens;
  
  // Get word counts for logging purposes
  const assignmentWords = assignmentText.split(/\s+/).length;
  const gradingWords = gradingText.split(/\s+/).length;
  const studentWords = studentText.split(/\s+/).length;
  const totalWords = assignmentWords + gradingWords + studentWords;
  
  // Log detailed information for monitoring
  console.log(`Document Statistics:`);
  console.log(`- Assignment: ${assignmentWords} words, ~${assignmentTokens} tokens`);
  console.log(`- Grading Instructions: ${gradingWords} words, ~${gradingTokens} tokens`);
  console.log(`- Student Text: ${studentWords} words, ~${studentTokens} tokens`);
  console.log(`- Total: ${totalWords} words, ~${totalTokens} tokens`);
  console.log(`- Threshold for ${provider}: ${threshold} tokens`);
  console.log(`- Chunking needed: ${totalTokens > threshold ? 'YES' : 'NO'}`);
  
  // Force chunking for extremely large documents regardless of provider
  if (totalWords > 50000) {
    console.log(`NOTICE: Document is extremely large (${totalWords} words). Forcing chunking.`);
    return true;
  }
  
  return totalTokens > threshold;
}

/**
 * Split student text into chunks that respect sentence boundaries
 */
function splitIntoChunks(text: string, chunkSizeTokens: number = CHUNK_SIZE_TOKENS): string[] {
  // Split into paragraphs first
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentTokenCount = 0;
  
  // Process each paragraph
  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokenCount(paragraph);
    
    // If this paragraph would exceed the chunk size and we have content, create new chunk
    if (currentTokenCount + paragraphTokens > chunkSizeTokens && currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n\n'));
      currentChunk = [];
      currentTokenCount = 0;
    }
    
    // If paragraph is larger than chunk size, split into sentences
    if (paragraphTokens > chunkSizeTokens) {
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      let sentenceChunk: string[] = [];
      let sentenceTokenCount = 0;
      
      for (const sentence of sentences) {
        const sentenceTokens = estimateTokenCount(sentence);
        
        if (sentenceTokenCount + sentenceTokens > chunkSizeTokens && sentenceChunk.length > 0) {
          // Add completed sentence chunk
          if (currentTokenCount + sentenceTokenCount > chunkSizeTokens) {
            chunks.push(currentChunk.join('\n\n'));
            currentChunk = [sentenceChunk.join(' ')];
            currentTokenCount = sentenceTokenCount;
          } else {
            currentChunk.push(sentenceChunk.join(' '));
            currentTokenCount += sentenceTokenCount;
          }
          
          sentenceChunk = [];
          sentenceTokenCount = 0;
        }
        
        sentenceChunk.push(sentence);
        sentenceTokenCount += sentenceTokens;
      }
      
      // Add any remaining sentences
      if (sentenceChunk.length > 0) {
        if (currentTokenCount + sentenceTokenCount > chunkSizeTokens && currentChunk.length > 0) {
          chunks.push(currentChunk.join('\n\n'));
          currentChunk = [sentenceChunk.join(' ')];
          currentTokenCount = sentenceTokenCount;
        } else {
          currentChunk.push(sentenceChunk.join(' '));
          currentTokenCount += sentenceTokenCount;
        }
      }
    } else {
      // Regular paragraph - add to current chunk
      currentChunk.push(paragraph);
      currentTokenCount += paragraphTokens;
    }
  }
  
  // Add final chunk if not empty
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n\n'));
  }
  
  console.log(`Split text into ${chunks.length} chunks`);
  return chunks;
}

/**
 * Process a student submission using chunking according to Replit specifications
 */
export async function processWithChunking(
  provider: string,
  model: string,
  temperature: number,
  assignmentText: string,
  gradingText: string,
  studentText: string,
  gradingDepth?: 'short' | 'medium' | 'long',
): Promise<string> {
  // Split the student text into appropriate chunks
  const studentChunks = splitIntoChunks(studentText);
  console.log(`Chunking enabled. Processing ${studentChunks.length} chunks...`);
  
  // Process each chunk with the appropriate LLM provider
  const chunkResults: string[] = [];
  
  // For extremely large submissions, we'll use a more efficient approach
  // that focuses on analyzing and summarizing each chunk without being too verbose
  for (let i = 0; i < studentChunks.length; i++) {
    const chunk = studentChunks[i];
    console.log(`Processing chunk ${i+1}/${studentChunks.length}, size: ${estimateTokenCount(chunk)} tokens`);
    
    // Simpler chunk-specific instructions that request only the essential analysis
    const chunkInstructions = `
This is CHUNK ${i+1} OF ${studentChunks.length} of a student submission.

Please analyze this portion of text directly. DO NOT grade or provide feedback yet.
Just analyze the content objectively with these points:
- Main arguments or claims presented
- Quality of evidence/reasoning
- Writing clarity
- Academic sophistication level
- Any notable strengths or weaknesses

Be direct and concise. Plain text only, no formatting.
`;

    // Combine the chunk instructions with only the essential information from grading instructions
    const combinedInstructions = `${gradingText}\n\n${chunkInstructions}`;
    
    let chunkResult: string;
    
    try {
      switch (provider) {
        case 'openai':
          chunkResult = await generateOpenAIResponse({
            model,
            temperature,
            assignmentText,
            gradingText: combinedInstructions,
            studentText: chunk,
            gradingDepth,
            includeCharts: false
          });
          break;
        case 'anthropic':
          chunkResult = await generateAnthropicResponse({
            model,
            temperature,
            assignmentText,
            gradingText: combinedInstructions,
            studentText: chunk,
            gradingDepth,
            includeCharts: false
          });
          break;
        case 'perplexity':
        default:
          chunkResult = await generatePerplexityResponse({
            model,
            temperature,
            assignmentText,
            gradingText: combinedInstructions,
            studentText: chunk,
            gradingDepth,
            includeCharts: false
          });
      }
      
      chunkResults.push(chunkResult);
    } catch (error) {
      console.error(`Error processing chunk ${i+1}:`, error);
      throw error;
    }
  }
  
  // Final pass to merge all chunks and generate the final grade
  console.log('Performing final pass with all chunk summaries...');
  
  const combinedSummaries = chunkResults.join('\n\n---\n\n');
  
  // Simplified final instructions focusing on producing plain text output
  const finalInstructions = `
I need you to grade this student paper. You have analysis for each section of the paper below:

${combinedSummaries}

Important requirements:
1. Start with a numerical grade (e.g., GRADE: 42/50)
2. Give direct, honest feedback about the paper's quality
3. Be specific about strengths and weaknesses
4. NO JSON FORMAT - plain text only
5. NO markdown formatting - plain text only
6. Address specific content and arguments from the paper
7. Use a direct, conversational tone like a professor speaking honestly to a student
8. DO NOT use evaluation rubrics or categories

Your response should be simple and direct:
GRADE: XX/50

[Your honest, specific feedback about the paper's content, argument quality, and effectiveness.]

[More specific feedback addressing what would make the paper better or why it's strong, with references to actual content.]

I emphasize: NO JSON, NO MARKDOWN, NO STRUCTURE except plain text paragraphs.

${gradingText}
`;

  // Final call to generate overall feedback
  let finalResult: string;
  
  try {
    switch (provider) {
      case 'openai':
        finalResult = await generateOpenAIResponse({
          model,
          temperature,
          assignmentText,
          gradingText: finalInstructions,
          studentText: '', // Not needed for final pass
          gradingDepth,
          includeCharts: false
        });
        break;
      case 'anthropic':
        finalResult = await generateAnthropicResponse({
          model,
          temperature,
          assignmentText,
          gradingText: finalInstructions,
          studentText: '', // Not needed for final pass
          gradingDepth,
          includeCharts: false
        });
        break;
      case 'perplexity':
      default:
        finalResult = await generatePerplexityResponse({
          model,
          temperature,
          assignmentText,
          gradingText: finalInstructions,
          studentText: '', // Not needed for final pass
          gradingDepth,
          includeCharts: false
        });
    }
    
    return finalResult;
  } catch (error) {
    console.error('Error in final grading pass:', error);
    throw error;
  }
}