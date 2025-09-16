import * as fs from 'fs';
import * as path from 'path';

export interface ProcessedFile {
  filename: string;
  content: string;
  wordCount: number;
}

export class FileProcessorService {
  async processFile(filePath: string, originalName: string): Promise<ProcessedFile> {
    const ext = path.extname(originalName).toLowerCase();
    let content: string;

    try {
      switch (ext) {
        case '.txt':
          content = await this.processTxtFile(filePath);
          break;
        case '.pdf':
          throw new Error('PDF files are not supported. Please convert your PDF to a text file (.txt) or Word document (.doc/.docx).');
        case '.doc':
        case '.docx':
          content = await this.processWordFile(filePath);
          break;
        default:
          throw new Error(`Unsupported file type: ${ext}. Supported formats: .txt, .doc, .docx`);
      }

      const wordCount = this.countWords(content);
      
      return {
        filename: originalName,
        content,
        wordCount,
      };
    } finally {
      // Clean up temporary file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }

  private async processTxtFile(filePath: string): Promise<string> {
    return fs.readFileSync(filePath, 'utf-8');
  }

  private async processWordFile(filePath: string): Promise<string> {
    try {
      // For now, return a placeholder since mammoth requires additional setup
      // In production, would use mammoth library
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch (error) {
      throw new Error('Word document processing failed. Please ensure the file is a valid Word document.');
    }
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  async validateFile(file: Express.Multer.File): Promise<void> {
    const allowedTypes = ['.txt', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (!allowedTypes.includes(ext)) {
      throw new Error(`File type ${ext} is not supported. Please upload a TXT, DOC, or DOCX file.`);
    }

    // Check file size (limit to 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      throw new Error('File size exceeds 50MB limit.');
    }
  }
}

export const fileProcessorService = new FileProcessorService();