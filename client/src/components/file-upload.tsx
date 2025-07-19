import React, { useState, useRef, DragEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Eye, X, FileText } from 'lucide-react';
import { processFile } from '@/lib/document-processor';

interface FileUploadProps {
  id: string;
  className?: string;
  onFileContent: (content: string, fileName?: string) => void;
  onDetectStudentName?: (name: string) => void;
  colorScheme?: 'primary' | 'orange' | 'blue' | 'green' | 'purple';
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  id, 
  className = '', 
  onFileContent,
  onDetectStudentName,
  colorScheme = 'primary' 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const colorClasses = {
    primary: 'text-primary',
    orange: 'text-orange',
    blue: 'text-blue',
    green: 'text-green',
    purple: 'text-purple',
  };
  
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFile(e.dataTransfer.files[0]);
    }
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleFile(e.target.files[0]);
    }
  };
  
  const handleFile = async (file: File) => {
    setIsLoading(true);
    setFileName(file.name);
    setUploadedFile(file);
    
    // If it's a PDF, create a URL for display
    if (file.type === 'application/pdf') {
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
    } else {
      setPdfUrl(null);
    }
    
    try {
      const content = await processFile(file);
      onFileContent(content, file.name);
      
      // Try to extract student name from the content
      if (onDetectStudentName) {
        // First check if name is at the beginning of the document (very common pattern)
        const firstLineMatch = content.trim().split('\n')[0];
        if (firstLineMatch && firstLineMatch.length > 2 && firstLineMatch.length < 50 && !/^(title|assignment|course|due|date|professor|instructor)/i.test(firstLineMatch)) {
          console.log('Detected student name from first line:', firstLineMatch);
          onDetectStudentName(firstLineMatch.trim());
        } else {
          // Try multiple patterns to detect student name
          const studentNamePatterns = [
            // Standard name patterns
            /name\s*:\s*([\w\s'.,-]+?)(?=[\n\r]|\.|$)/i,
            /student(?:'s)?\s*name\s*:\s*([\w\s'.,-]+?)(?=[\n\r]|\.|$)/i,
            /author\s*:\s*([\w\s'.,-]+?)(?=[\n\r]|\.|$)/i,
            /by\s*:\s*([\w\s'.,-]+?)(?=[\n\r]|\.|$)/i,
            /written\s*by\s*:\s*([\w\s'.,-]+?)(?=[\n\r]|\.|$)/i,
            /submitted\s*by\s*:\s*([\w\s'.,-]+?)(?=[\n\r]|\.|$)/i,
            // Canvas/LMS patterns
            /^([A-Z][a-z]+ [A-Z][a-z]+)\s*$/m,
            // Name at start of line patterns
            /^([A-Z][a-z]+ [A-Z][a-z]+(?: [A-Z][a-z]+)?)\s*[\n\r]/m,
            // Email patterns to extract name before @
            /([a-zA-Z]+\.[a-zA-Z]+)@/,
          ];
          
          for (const pattern of studentNamePatterns) {
            const match = content.match(pattern);
            if (match) {
              let detectedName = match[1].trim();
              
              // Clean up the detected name
              detectedName = detectedName.replace(/[^\w\s'.,-]/g, '').trim();
              
              // If it's an email pattern, convert to readable name
              if (detectedName.includes('.')) {
                detectedName = detectedName.split('.').map(part => 
                  part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
                ).join(' ');
              }
              
              // Validate the name (should be reasonable length and contain letters)
              if (detectedName.length >= 3 && detectedName.length <= 50 && /[a-zA-Z]/.test(detectedName)) {
                console.log('Detected student name:', detectedName);
                onDetectStudentName(detectedName);
                break;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing file:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const clearFile = () => {
    setFileName(null);
    setUploadedFile(null);
    setPdfUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  return (
    <div className={className}>
      <div 
        className={`file-drop-area h-24 flex flex-col items-center justify-center ${isDragging ? 'drag-over' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isLoading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mb-2"></div>
            <p className="text-sm text-gray-500">Processing file...</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-gray-500 text-sm mt-2">Drag & drop PDF, DOCX, TXT, or image files here</p>
              <span className={`text-xs ${colorClasses[colorScheme]} mt-1`}>or click to browse</span>
            </div>
            <input 
              type="file" 
              className="file-input" 
              id={id} 
              ref={fileInputRef}
              accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.gif,.bmp,.webp"
              onChange={handleFileChange}
            />
          </>
        )}
      </div>
      
      {fileName && (
        <div className="mt-2 p-2 bg-gray-100 rounded flex items-center justify-between">
          <div className="flex items-center">
            <FileText className="h-5 w-5 text-green-500 mr-2" />
            <span className="text-sm font-medium file-name truncate">{fileName}</span>
          </div>
          <div className="flex items-center gap-2">
            {pdfUrl && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-1" />
                    View PDF
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>PDF Viewer - {fileName}</DialogTitle>
                  </DialogHeader>
                  <div className="flex-1 overflow-hidden">
                    <iframe
                      src={pdfUrl}
                      className="w-full h-full border-0"
                      title="PDF Viewer"
                    />
                  </div>
                </DialogContent>
              </Dialog>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearFile} 
              className="ml-auto text-red-500 p-1 h-auto"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;