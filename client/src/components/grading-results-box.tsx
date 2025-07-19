import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { extractGradeFromFeedback, copyToClipboard } from '@/lib/utils';
import { GradingCharts, extractChartData, ChartData } from '@/components/ui/chart';
import { CopyButton } from '@/components/ui/copy-button';
import { toast } from '@/hooks/use-toast';
import { MathView } from './math-view';
import PDFExport from './pdf-export';

interface GradingResultsBoxProps {
  isLoading: boolean;
  result: string | null;
  loadingText: string;
  onEmailResults: () => void;
  studentName?: string;
  onSaveGrade?: (grade: string, feedback: string, studentName: string, overrideGrade?: string, instructorNote?: string) => void;
}

const GradingResultsBox: React.FC<GradingResultsBoxProps> = ({ 
  isLoading, 
  result, 
  loadingText,
  onEmailResults,
  studentName = '',
  onSaveGrade
}) => {
  const [editableFeedback, setEditableFeedback] = useState<string>(result || '');
  const [studentNameInput, setStudentNameInput] = useState<string>(studentName);
  const [extracted, setExtracted] = useState<string | null>(null);
  const [manualGradeOverride, setManualGradeOverride] = useState<string>('');
  const [showMathView, setShowMathView] = useState(false);
  const [instructorNote, setInstructorNote] = useState<string>('');
  const [showOverrideOptions, setShowOverrideOptions] = useState<boolean>(false);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  
  // Function to attempt to detect student name from submission
  const detectStudentName = (text: string) => {
    if (!text || studentNameInput) return; // Don't overwrite existing name
    
    // Common patterns for student names (Name: John Smith, Student: Jane Doe, etc)
    const namePatterns = [
      /name\s*:\s*([\w\s-]+?)(?=[\n\r]|\.|$)/i,
      /student(?:'s)?\s*name\s*:\s*([\w\s-]+?)(?=[\n\r]|\.|$)/i,
      /by\s*:\s*([\w\s-]+?)(?=[\n\r]|\.|$)/i,
      /submitted by\s*:\s*([\w\s-]+?)(?=[\n\r]|\.|$)/i,
    ];
    
    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const detectedName = match[1].trim();
        if (detectedName.length > 1 && detectedName.length < 50) { // Reasonable name length
          setStudentNameInput(detectedName);
          return;
        }
      }
    }
  };
  
  // Update state when new result comes in - PURE PASS-THROUGH MODE
  useEffect(() => {
    if (result) {
      // Following REPLIT INTEGRATION INSTRUCTIONS for grading app:
      // Application must directly pass through user input to the LLM without processing
      // All LLM output must be delivered directly to the user without post-processing
      console.log("Extracting grade from feedback:", result);
      
      // Just pass the result through directly without JSON processing
      // This ensures we're a pure conduit between LLM and user
      setEditableFeedback(result);
      
      // We only extract the grade for display purposes, no other processing
      const extractedGrade = extractGradeFromFeedback(result);
      if (extractedGrade) {
        console.log("Successfully extracted grade:", extractedGrade);
        setExtracted(extractedGrade);
      } else {
        console.log("No grade could be extracted from the feedback");
      }
      
      // Try to detect student name from submission - minimal processing
      detectStudentName(result);
      
      // No chart extraction - pure text only
      setChartData(null);
      console.log("No chart data could be extracted");
    }
  }, [result]);
  
  const handleSaveGrade = () => {
    if (!editableFeedback) return;
    
    // If no student name provided, ask for one
    if (!studentNameInput && onSaveGrade) {
      alert('Please enter a student name before saving');
      return;
    }
    
    // Get the grade either from manual input, extracted value, or ask user
    let effectiveGrade = manualGradeOverride;
    
    if (!effectiveGrade) {
      if (extracted) {
        // If there's an extracted grade, offer to use it or override
        if (confirm(`Use detected grade ${extracted}? Click OK to use this grade or Cancel to enter your own.`)) {
          effectiveGrade = extracted;
        } else {
          const userGrade = prompt('Enter the grade (e.g. A, B+, 95/100):');
          if (userGrade) effectiveGrade = userGrade;
        }
      } else {
        // No extracted grade, must enter manually
        const userGrade = prompt('Enter the grade (e.g. A, B+, 95/100):');
        if (userGrade) effectiveGrade = userGrade;
      }
    }
    
    if (effectiveGrade && onSaveGrade) {
      // Prepend instructor note if provided
      let finalFeedback = editableFeedback;
      if (instructorNote) {
        finalFeedback = `INSTRUCTOR NOTE: ${instructorNote}\n\n${editableFeedback}`;
      }
      
      onSaveGrade(effectiveGrade, finalFeedback, studentNameInput);
      alert(`Grade ${effectiveGrade} saved for student: ${studentNameInput}`);
    }
  };
  
  const toggleOverrideOptions = () => {
    setShowOverrideOptions(!showOverrideOptions);
  };
  
  return (
    <Card className="border-t-4 border-green">
      <div className="p-4 bg-emerald-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Grading Results
            </h2>
            <p className="text-sm text-gray-600 mt-1">Edit feedback directly in the textbox below</p>
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor="math-view-results" className="text-sm">Math View</Label>
            <Switch
              id="math-view-results"
              checked={showMathView}
              onCheckedChange={setShowMathView}
            />
          </div>
        </div>
      </div>
      
      <CardContent className="p-4">
        {isLoading ? (
          <div id="grading-loading" className="py-12 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mb-4"></div>
            <p className="text-gray-600">{loadingText}</p>
          </div>
        ) : editableFeedback ? (
          <>
            {/* Student Name Field with Auto-Detection */}
            <div className="mb-4">
              <label htmlFor="student-name" className="block text-sm font-medium mb-1">Student Name</label>
              <input 
                type="text" 
                id="student-name"
                className="w-full p-2 border rounded" 
                value={studentNameInput} 
                onChange={(e) => setStudentNameInput(e.target.value)} 
                placeholder="Enter student name"
              />
            </div>
            
            {/* PROMINENT GRADE DISPLAY - JUST THE SCORE */}
            {extracted && (
              <div className="mb-6 p-4 bg-gradient-to-r from-green-500 to-green-700 rounded-lg shadow-lg text-center">
                <h3 className="text-white text-lg font-bold mb-1">GRADE</h3>
                <div className="bg-white rounded-md py-3 px-6 inline-block shadow-inner">
                  <span className="text-3xl font-bold text-green-700">{extracted.split(' ')[0]}</span>
                </div>
              </div>
            )}
            
            {/* Charts display section */}
            {chartData && (
              <div className="mb-6 mt-4">
                <GradingCharts data={chartData} />
              </div>
            )}
            
            <div className="mb-4 space-y-2">
              
              <div className="flex justify-end">
                <Button 
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleOverrideOptions}
                  className="text-xs flex items-center gap-1 text-[#00BFFF] border-[#00BFFF] hover:bg-blue-50 font-medium"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  {showOverrideOptions ? 'HIDE OVERRIDE OPTIONS' : 'OVERRIDE GRADE'}
                </Button>
              </div>
              
              {showOverrideOptions && (
                <div className="p-4 border border-red-300 rounded-md bg-red-50">
                  <h4 className="font-medium text-red-800 mb-2">Override AI Grade</h4>
                  
                  <div className="mb-3">
                    <label htmlFor="override-grade" className="block text-sm font-medium mb-1 text-red-800">Manual Grade Override</label>
                    <input
                      id="override-grade"
                      type="text"
                      value={manualGradeOverride}
                      onChange={(e) => setManualGradeOverride(e.target.value)}
                      className="w-full p-2 border border-red-300 rounded focus:ring-red-500 focus:border-red-500"
                      placeholder="Enter corrected grade (e.g., A, B+, 95/100)"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="instructor-note" className="block text-sm font-medium mb-1 text-red-800">Instructor Note (appears at top of feedback)</label>
                    <Textarea
                      id="instructor-note"
                      value={instructorNote}
                      onChange={(e) => setInstructorNote(e.target.value)}
                      className="w-full p-2 border border-red-300 rounded focus:ring-red-500 focus:border-red-500"
                      placeholder="Add your reasoning for the grade change here..."
                    />
                  </div>
                </div>
              )}
            </div>
            
            <div className="relative">
              {showMathView ? (
                <div className="min-h-[300px] border rounded">
                  <MathView 
                    text={editableFeedback} 
                    title="Grading Feedback"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditableFeedback('')}
                    className="absolute top-2 right-2 h-6 w-6 p-0 rounded-full bg-gray-200 hover:bg-gray-300"
                    aria-label="Clear text"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </Button>
                </div>
              ) : (
                <>
                  {/* Check if feedback is HTML content and render with dangerouslySetInnerHTML if needed */}
                  {editableFeedback && editableFeedback.includes('<') && editableFeedback.includes('>') ? (
                    <div 
                      className="min-h-[300px] prose max-w-none p-4 border rounded bg-white overflow-auto" 
                      dangerouslySetInnerHTML={{ __html: editableFeedback }}
                    />
                  ) : (
                    <Textarea
                      value={editableFeedback}
                      onChange={(e) => setEditableFeedback(e.target.value)}
                      className="min-h-[300px] font-mono text-sm w-full p-4 border rounded"
                      placeholder="Feedback will appear here"
                    />
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditableFeedback('')}
                    className="absolute top-2 right-2 h-6 w-6 p-0 rounded-full bg-gray-200 hover:bg-gray-300"
                    aria-label="Clear text"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </Button>
                </>
              )}
            </div>
            
            {/* Clear button (below textarea) */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setEditableFeedback('');
                setManualGradeOverride('');
                setInstructorNote('');
                setExtracted('');
                setStudentNameInput('');
                setChartData(null);
                setShowOverrideOptions(false);
              }}
              className="w-full mt-2 mb-2 text-gray-500 border-gray-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear Feedback
            </Button>
            
            {/* Simple Copy Button */}
            <Button
              onClick={() => {
                navigator.clipboard.writeText(editableFeedback);
                alert('Feedback copied to clipboard!');
              }}
              className="w-full mt-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 border border-gray-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy
            </Button>
            
            <div className="mt-6 border-t pt-4" id="results-actions">
              <h3 className="text-md font-medium mb-3">Actions</h3>
              <div className="flex flex-wrap gap-2">
                <Button 
                  className="inline-flex items-center bg-[#00BFFF] hover:bg-[#00A1FF] font-bold text-white shadow-md"
                  onClick={handleSaveGrade}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  SAVE GRADE
                </Button>
                
                {/* Copy Button */}
                <CopyButton 
                  text={editableFeedback}
                  variant="secondary"
                  label="COPY FEEDBACK"
                  className="inline-flex items-center bg-gray-200 hover:bg-gray-300 font-bold shadow-md"
                />
                
                <Button 
                  className="inline-flex items-center bg-[#00BFFF] hover:bg-[#00A1FF] font-bold text-white shadow-md" 
                  onClick={onEmailResults}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  EMAIL RESULTS
                </Button>
                <Button variant="outline" className="inline-flex items-center text-[#00BFFF] font-bold border-[#00BFFF] hover:bg-blue-50">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  DOWNLOAD
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div id="no-results" className="py-12 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-500">Grade will appear here after submission</p>
            <p className="text-xs text-gray-400 mt-1">The complete feedback will be shown and editable</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GradingResultsBox;
