import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Copy text to clipboard with fallback for older browsers
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback method for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Avoid scrolling to bottom
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    return successful;
  } catch (err) {
    console.error('Failed to copy text: ', err);
    return false;
  }
}

/**
 * Extracts the grade from AI-generated feedback text
 * Looks for patterns like **GRADE: A** or **GRADE: 90/100**
 * Returns just the numeric or letter grade without descriptions
 */
export function extractGradeFromFeedback(feedback: string): string | null {
  if (!feedback) return null;
  
  console.log("Extracting grade from feedback:", feedback.substring(0, 100) + "...");
  
  // Check if the feedback is actually JSON
  if (feedback.trim().startsWith('{') && feedback.trim().endsWith('}')) {
    try {
      const jsonData = JSON.parse(feedback);
      console.log("Detected JSON response, looking for grade in parsed data");
      
      // Check common patterns for grade in JSON
      if (jsonData.grade) {
        return jsonData.grade;
      }
      
      if (jsonData.score) {
        return jsonData.score.toString();
      }
      
      if (jsonData.result && jsonData.result.grade) {
        return jsonData.result.grade;
      }
      
      // If we couldn't find a direct grade field, convert JSON to text and continue
      feedback = JSON.stringify(jsonData);
    } catch (e) {
      console.log("Failed to parse feedback as JSON:", e);
      // Not JSON or invalid JSON, continue with string parsing
    }
  }
  
  // First, look for the simple GRADE: format we specifically asked LLMs to return
  const basicGradeMatch = feedback.match(/^GRADE:\s*(\d+\/\d+)/im);
  if (basicGradeMatch && basicGradeMatch[1]) {
    console.log("Found basic grade format:", basicGradeMatch[1]);
    return basicGradeMatch[1].trim();
  }
  
  // Look for bolded grade
  const boldGradeMatch = feedback.match(/\*\*GRADE:\s*([^*]+)\*\*/i);
  if (boldGradeMatch && boldGradeMatch[1]) {
    // Extract just the score part (e.g., "40/50" from "40/50 Your outline...")
    const scoreOnly = boldGradeMatch[1].trim().split(/\s+/)[0];
    console.log("Found bolded grade:", scoreOnly);
    return scoreOnly;
  }
  
  // Look for grade format like "Grade: A" or "Grade: 85/100"
  const simpleGradeMatch = feedback.match(/Grade:\s*([\w\/\d\s.+-]+)/i);
  if (simpleGradeMatch && simpleGradeMatch[1]) {
    // Extract just the score part
    const scoreOnly = simpleGradeMatch[1].trim().split(/\s+/)[0];
    console.log("Found simple grade:", scoreOnly);
    return scoreOnly;
  }
  
  // Look for numerical grade patterns (e.g., 90/100, 45/50)
  const numericalGradeMatch = feedback.match(/(\d+)\s*\/\s*(\d+)/i);
  if (numericalGradeMatch) {
    console.log("Found numerical grade:", numericalGradeMatch[0]);
    return numericalGradeMatch[0].trim();
  }
  
  // Look for letter grades (e.g., A, B+, C-)
  const letterGradeMatch = feedback.match(/\b([A-D][+-]?)\b/i);
  if (letterGradeMatch) {
    console.log("Found letter grade:", letterGradeMatch[0]);
    return letterGradeMatch[0].trim();
  }
  
  // Look for percentage grades (e.g., 90%, 85%)
  const percentageGradeMatch = feedback.match(/(\d+)\s*%/);
  if (percentageGradeMatch) {
    console.log("Found percentage grade:", percentageGradeMatch[0]);
    return percentageGradeMatch[0].trim();
  }
  
  console.log("No grade pattern found in feedback");
  return null;
}
