import mammoth from 'mammoth';
import Tesseract from 'tesseract.js';
import { extractMathWithMathpix } from './mathpix-ocr';

// OCR fallback for when PDF text extraction fails
async function extractTextViaOCR(file: File): Promise<string> {
  try {
    console.log('Starting OCR extraction for:', file.name);
    
    // For PDFs, we'll use Tesseract directly on the file
    if (file.type === 'application/pdf') {
      const { data: { text } } = await Tesseract.recognize(file, 'eng', {
        logger: m => console.log(m)
      });
      
      if (text && text.trim().length > 10) {
        console.log('OCR extraction successful');
        return text.trim();
      } else {
        throw new Error('OCR produced insufficient text');
      }
    } else {
      // For images, use Tesseract directly
      const { data: { text } } = await Tesseract.recognize(file, 'eng');
      return text.trim();
    }
  } catch (error) {
    console.error('OCR extraction failed:', error);
    throw error;
  }
}

// Process and extract text from PDF files using PDF.js
async function extractPdfText(file: File): Promise<string> {
  try {
    // Import PDF.js dynamically with simplified configuration
    const pdfjsLib = await import('pdfjs-dist');
    
    // Disable worker entirely to avoid CDN issues
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ 
      data: arrayBuffer
    }).promise;
    
    let fullText = '';
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (pageText) {
          fullText += `\n\n=== Page ${pageNum} ===\n${pageText}`;
        }
      } catch (pageError) {
        console.warn(`Failed to extract text from page ${pageNum}:`, pageError);
        fullText += `\n\n=== Page ${pageNum} ===\n[Error extracting text from this page]`;
      }
    }
    
    if (!fullText.trim()) {
      throw new Error('No readable text found in PDF');
    }
    
    console.log('PDF text extraction completed successfully');
    return fullText.trim();
    
  } catch (error) {
    console.error('PDF processing error:', error);
    // Try OCR as backup for scanned PDFs
    try {
      console.log('PDF text extraction failed, attempting OCR...');
      return await extractTextViaOCR(file);
    } catch (ocrError) {
      console.error('OCR also failed:', ocrError);
      throw new Error('Unable to extract text from PDF - both text extraction and OCR failed');
    }
  }
}

// Process and extract text from DOCX files
async function extractDocxText(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    
    if (!result.value || result.value.trim().length === 0) {
      throw new Error('No text found in document');
    }
    
    return result.value.trim();
  } catch (error) {
    console.error('DOCX processing error:', error);
    throw new Error(`Failed to extract text from Word document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Process and extract text from image files using OCR
async function extractImageText(file: File): Promise<string> {
  try {
    const { data: { text } } = await Tesseract.recognize(file, 'eng', {
      logger: m => console.log(m)
    });
    
    if (!text || text.trim().length === 0) {
      throw new Error('No text found in image');
    }
    
    return text.trim();
  } catch (error) {
    console.error('Image OCR error:', error);
    throw new Error(`Failed to extract text from image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Main function to process any supported file type
export async function processFile(file: File): Promise<string> {
  console.log('Processing file:', file.name, 'Type:', file.type);
  
  try {
    // Try Mathpix OCR first for PDFs and images that might contain mathematical content
    if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
      console.log('Attempting Mathpix OCR for PDF with potential mathematical content...');
      try {
        const mathpixResult = await extractMathWithMathpix(file);
        if (mathpixResult && mathpixResult.trim().length > 10) {
          console.log('Mathpix OCR successful, extracted text length:', mathpixResult.length);
          return mathpixResult;
        }
      } catch (mathpixError) {
        console.log('Mathpix failed for PDF, falling back to PDF.js:', mathpixError);
      }
    }
    
    // Process based on file type
    if (file.type === 'application/pdf') {
      return await extractPdfText(file);
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return await extractDocxText(file);
    } else if (file.type.startsWith('image/')) {
      return await extractImageText(file);
    } else if (file.type === 'text/plain') {
      const text = await file.text();
      if (!text.trim()) {
        throw new Error('Text file is empty');
      }
      return text.trim();
    } else {
      throw new Error(`Unsupported file type: ${file.type}`);
    }
    
  } catch (error) {
    console.error('File processing error:', error);
    throw error;
  }
}

// Clean and normalize mathematical symbols in extracted text
export function cleanMathematicalText(text: string): string {
  if (!text) return '';
  
  // Replace common mathematical Unicode symbols with readable equivalents
  const extractedText = text
    .replace(/\s*≤\s*/g, ' <= ')
    .replace(/\s*≥\s*/g, ' >= ')
    .replace(/\s*≠\s*/g, ' != ')
    .replace(/\s*≈\s*/g, ' ~= ')
    .replace(/∞/g, 'infinity')
    .replace(/∑/g, 'sum')
    .replace(/∫/g, 'integral')
    .replace(/√/g, 'sqrt')
    .replace(/π/g, 'pi')
    .replace(/α/g, 'alpha')
    .replace(/β/g, 'beta')
    .replace(/γ/g, 'gamma')
    .replace(/δ/g, 'delta')
    .replace(/θ/g, 'theta')
    .replace(/λ/g, 'lambda')
    .replace(/μ/g, 'mu')
    .replace(/σ/g, 'sigma')
    // Clean up spacing
    .replace(/\s+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();
  
  if (!extractedText || extractedText.length < 3) {
    throw new Error('Extracted text is too short or empty');
  }
  
  return extractedText;
}

// Split large text into chunks for AI processing
export function splitIntoChunks(text: string, maxChunkSize: number = 8000): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }
  
  const chunks: string[] = [];
  const sentences = text.split(/[.!?]+/);
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if ((currentChunk + '. ' + sentence).length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        // If single sentence is too long, split by words
        const words = sentence.split(' ');
        for (const word of words) {
          if ((currentChunk + ' ' + word).length > maxChunkSize) {
            if (currentChunk) {
              chunks.push(currentChunk.trim());
              currentChunk = word;
            } else {
              chunks.push(word); // Single word longer than chunk size
            }
          } else {
            currentChunk += (currentChunk ? ' ' : '') + word;
          }
        }
      }
    } else {
      currentChunk += (currentChunk ? '. ' : '') + sentence;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length > 0);
}

// Function to combine chunked AI responses
export function combineChunkedResponses(responses: string[]): string {
  if (responses.length === 1) {
    return responses[0];
  }
  
  return responses
    .map((response, index) => `Part ${index + 1}:\n${response}`)
    .join('\n\n---\n\n');
}