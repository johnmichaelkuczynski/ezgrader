import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import FileUpload from './file-upload';
import { detectAI } from '@/lib/ai-detection';
import { MathView } from './math-view';
import { useQuery } from '@tanstack/react-query';

import { Wand2 } from 'lucide-react';
// Using inline icon since we're having trouble with the import
const IconSparkles = ({ className = '' }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3l1.57 3.43 3.73.54-2.7 2.63.64 3.7-3.24-1.7-3.24 1.71.64-3.71-2.7-2.63 3.73-.54z"/>
    <path d="M19 8l.53 1.15 1.27.19-.92.89.22 1.26-1.1-.58-1.1.58.21-1.26-.91-.89 1.27-.19z"/>
    <path d="M5 17l.53 1.15 1.27.19-.92.89.22 1.26-1.1-.58-1.1.58.21-1.26-.91-.89 1.27-.19z"/>
  </svg>
);

interface StudentSubmissionBoxProps {
  value: string;
  onChange: (value: string) => void;
  onGradeSubmission?: () => void;
  onDetectStudentName?: (name: string) => void;
}

const StudentSubmissionBox: React.FC<StudentSubmissionBoxProps> = ({ value, onChange, onGradeSubmission, onDetectStudentName }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiProbability, setAiProbability] = useState<number | null>(null);
  const [showMathView, setShowMathView] = useState(false);
  const [isFormattingMath, setIsFormattingMath] = useState(false);

  // Check if user is authenticated to show AI detection
  const { data: user } = useQuery({
    queryKey: ['/api/auth/me'],
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  const isAuthenticated = !!user;

  const formatMathNotation = async () => {
    if (!value.trim()) return;
    
    setIsFormattingMath(true);
    try {
      const response = await fetch('/api/format-math', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: value }),
      });

      if (response.ok) {
        const result = await response.json();
        onChange(result.formattedText);
      } else {
        console.error('Failed to format math notation');
      }
    } catch (error) {
      console.error('Error formatting math notation:', error);
    } finally {
      setIsFormattingMath(false);
    }
  };
  
  // Detect AI when text changes significantly
  useEffect(() => {
    const analyzeText = async () => {
      if (value.length > 100 && isAuthenticated) {
        setIsAnalyzing(true);
        try {
          const result = await detectAI(value);
          setAiProbability(result.aiProbability);
        } catch (error) {
          console.error('Error detecting AI:', error);
        } finally {
          setIsAnalyzing(false);
        }
      }
    };
    
    const timer = setTimeout(() => {
      analyzeText();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [value, isAuthenticated]);
  
  const getAiResultLabel = (probability: number) => {
    if (probability <= 30) return 'Likely Human-Written';
    if (probability <= 70) return 'Possibly AI-Assisted';
    return 'Likely AI-Generated';
  };
  
  const getAiResultColor = (probability: number) => {
    if (probability <= 30) return 'bg-green-500';
    if (probability <= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Process content before passing to parent
  const handleContentChange = (content: string) => {
    // Check if the input is JSON
    if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
      try {
        const jsonData = JSON.parse(content);
        console.log("Detected JSON in student submission input");
        
        // If this is studentSubmissions JSON format, handle it specially
        if (jsonData.studentSubmissions) {
          console.log("Found studentSubmissions structure, extracting content");
          let formattedContent = '';
          
          jsonData.studentSubmissions.forEach((submission: any) => {
            if (submission.studentName && onDetectStudentName) {
              console.log("Detected student name from JSON:", submission.studentName);
              onDetectStudentName(submission.studentName);
            }
            
            if (submission.originalCase) {
              if (submission.originalCase.scenario) {
                formattedContent += `ORIGINAL CASE SCENARIO:\n${submission.originalCase.scenario}\n\n`;
              }
              if (submission.originalCase.analysis) {
                formattedContent += `ANALYSIS:\n${submission.originalCase.analysis}\n\n`;
              }
            }
            
            if (submission.peerResponses && Array.isArray(submission.peerResponses)) {
              formattedContent += `PEER RESPONSES:\n\n`;
              submission.peerResponses.forEach((response: any, index: number) => {
                formattedContent += `RESPONSE ${index + 1}`;
                if (response.responseTo) {
                  formattedContent += ` (to ${response.responseTo})`;
                }
                formattedContent += `:\n${response.content}\n\n`;
              });
            }
          });
          
          if (formattedContent) {
            console.log("Successfully extracted content from JSON structure");
            onChange(formattedContent);
            return;
          }
        }
      } catch (e) {
        console.log("Failed to parse JSON, using raw text");
        // Not JSON or invalid JSON, continue with string parsing
      }
    }
    
    // Default - just pass the raw content
    onChange(content);
  };
  
  // Clear all content and reset file input
  const clearSubmission = () => {
    // Clear text content
    onChange('');
    
    // Reset file upload
    // Get all file input elements inside this component
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach((input) => {
      if (input instanceof HTMLInputElement) {
        input.value = '';
      }
    });
    
    // Reset AI probability
    setAiProbability(null);
    
    console.log("Cleared student submission and file uploads");
  };

  return (
    <Card className="border-t-4 border-blue">
      <div className="p-4 bg-indigo-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              Student Submission
            </h2>
            <p className="text-sm text-gray-600 mt-1">Upload or enter the student's work</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={formatMathNotation}
              disabled={isFormattingMath || !value.trim()}
              className="text-indigo-600 border-indigo-300 hover:bg-indigo-50"
            >
              <Wand2 className="w-4 h-4 mr-1" />
              {isFormattingMath ? 'Formatting...' : 'Format Math'}
            </Button>
            <Label htmlFor="math-view-student" className="text-sm">Math View</Label>
            <Switch
              id="math-view-student"
              checked={showMathView}
              onCheckedChange={setShowMathView}
            />
          </div>
        </div>
      </div>
      
      <CardContent className="p-4">
        <FileUpload 
          id="student-file" 
          className="mb-4" 
          onFileContent={handleContentChange}
          onDetectStudentName={onDetectStudentName}
          colorScheme="blue"
        />
        
        <div className="relative">
          {showMathView ? (
            <div className="min-h-[256px] border rounded-md">
              <MathView 
                text={value} 
                title="Student Submission"
              />
              {value.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearSubmission}
                  className="absolute top-2 right-2 h-6 w-6 p-0 rounded-full bg-gray-200 hover:bg-gray-300"
                  aria-label="Clear text"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </Button>
              )}
            </div>
          ) : (
            <>
              <Textarea
                id="student-text"
                value={value}
                onChange={(e) => handleContentChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey && onGradeSubmission && value.length >= 50) {
                    e.preventDefault();
                    onGradeSubmission();
                  }
                }}
                placeholder="Type or paste student submission here... (Ctrl+Enter to grade)"
                className="min-h-[256px] resize-y"
              />
              {value.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearSubmission}
                  className="absolute top-2 right-2 h-6 w-6 p-0 rounded-full bg-gray-200 hover:bg-gray-300"
                  aria-label="Clear text"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </Button>
              )}
            </>
          )}
        </div>
        
        {/* Clear button (below textarea) */}
        {value.length > 0 && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={clearSubmission}
            className="w-full mt-2 mb-2 text-gray-500 border-gray-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear Submission
          </Button>
        )}
        
        {/* AI Detection Results - ONLY FOR AUTHENTICATED USERS */}
        {isAuthenticated && (
          <div className="mt-4">
            {isAnalyzing ? (
              <div>
                <div className="flex items-center mb-2">
                  <span className="text-sm font-medium mr-2">Analyzing via GPTZero API...</span>
                  <Progress value={50} className="h-1" />
                </div>
              </div>
            ) : aiProbability !== null ? (
              <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-md font-medium">AI Detection Results</h3>
                  {onGradeSubmission && (
                    <Button 
                      onClick={onGradeSubmission}
                      className="inline-flex items-center bg-[#00BFFF] hover:bg-[#00A1FF] font-bold text-white shadow-md text-xs px-3 py-1"
                      disabled={!value || value.length < 50}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      GRADE SUBMISSION
                    </Button>
                  )}
                </div>
                <div className="flex items-center">
                  <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2">
                    <div 
                      className={`${getAiResultColor(aiProbability)} h-2.5 rounded-full`} 
                      style={{ width: `${aiProbability}%` }} 
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700">{aiProbability}%</span>
                </div>
                <p className="text-sm mt-1.5">
                  <span className={`px-2 py-0.5 rounded text-white ${getAiResultColor(aiProbability)}`}>
                    {getAiResultLabel(aiProbability)}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    {aiProbability <= 30 
                      ? 'Scores under 30% typically indicate human authorship' 
                      : aiProbability <= 70 
                        ? 'Scores between 31-70% suggest potential AI assistance'
                        : 'Scores above 70% suggest AI generation'
                    }
                  </span>
                </p>
              </div>
            ) : value.length > 0 ? (
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">Add more text to trigger AI detection</p>
                {onGradeSubmission && value.length >= 50 && (
                  <Button 
                    onClick={onGradeSubmission}
                    className="grade-button inline-flex items-center bg-[#00BFFF] hover:bg-[#00A1FF] font-bold text-white shadow-md text-xs px-3 py-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    GRADE SUBMISSION
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        )}
        
        {/* Grade button for unregistered users - NO AI DETECTION */}
        {!isAuthenticated && value.length >= 50 && onGradeSubmission && (
          <div className="mt-4">
            <Button 
              onClick={onGradeSubmission}
              className="grade-button inline-flex items-center bg-[#00BFFF] hover:bg-[#00A1FF] font-bold text-white shadow-md text-xs px-3 py-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              GRADE SUBMISSION
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StudentSubmissionBox;
