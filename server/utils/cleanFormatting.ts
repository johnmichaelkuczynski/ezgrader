/**
 * Utility function to clean formatting from LLM responses
 * Removes markdown, JSON, code blocks, and citations
 */
export function cleanLLMResponse(text: string): string {
  if (!text) return '';
  
  // First pass: Remove markdown formatting
  let cleanResult = text
    .replace(/#{1,6}\s*(.*?)(?=\n|$)/g, '$1') // Remove all header markdown (# through ######) but keep the content
    .replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')   // Remove all asterisks for bold/italic formatting but keep the content
    .replace(/_{1,3}(.*?)_{1,3}/g, '$1')     // Remove all underscores for formatting but keep the content
    .replace(/`{1,3}(.*?)`{1,3}/g, '$1')     // Remove all backticks for code formatting but keep the content
    .replace(/\n\s*[-+*]\s+/g, '\n') // Remove list markers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Replace markdown links with just the text
    .replace(/\n{3,}/g, '\n\n'); // Replace multiple consecutive newlines with just two
    
  // Second pass: Remove additional markdown patterns that might be missed
  cleanResult = cleanResult
    .replace(/\*\*\*(.*?)\*\*\*/g, '$1') // Bold italic
    .replace(/\*\*(.*?)\*\*/g, '$1')     // Bold
    .replace(/\*(.*?)\*/g, '$1')         // Italic
    .replace(/__(.*?)__/g, '$1')         // Bold with underscores
    .replace(/_(.*?)_/g, '$1')           // Italic with underscores
    .replace(/###\s*/g, '')              // Additional cleanup for header markdown
    .replace(/##\s*/g, '')
    .replace(/#\s*/g, '');
    
  // Third pass: Aggressive cleanup to remove JSON code, citations, and references
  cleanResult = cleanResult
    .replace(/```(?:json|javascript|python)?\s*[\s\S]*?```/g, '') // Remove any code blocks with triple backticks
    .replace(/\{\s*"citations"[\s\S]*?\}\s*/g, '') // Remove citations JSON objects
    .replace(/\{\s*"id"[\s\S]*?\}\s*/g, '') // Remove any JSON objects with ID fields
    .replace(/\[\d+\]/g, '') // Remove citation reference numbers like [1], [2], etc.
    .replace(/\{\s*[\s\S]*?\}\s*/g, '') // Attempt to remove any remaining JSON objects
    .replace(/\n\s*\d+\.\s+https?:\/\/.*$/gm, '') // Remove numbered URLs
    .replace(/\n\s*https?:\/\/.*$/gm, '') // Remove URLs on their own lines
    .replace(/\n\s*Citations:[\s\S]*?(?=\n\n|\n$|$)/g, ''); // Remove citation sections

  // Final cleanup: Remove extra whitespace and handle any artifacts
  cleanResult = cleanResult
    .replace(/\n{3,}/g, '\n\n') // Replace multiple consecutive newlines with just two again
    .replace(/^\s+|\s+$/g, ''); // Trim start and end whitespace
    
  return cleanResult;
}