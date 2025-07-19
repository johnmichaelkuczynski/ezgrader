import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { detectAI } from "@/lib/ai-detection";

interface PaperImprovementBoxProps {
  studentText: string;
  llmProvider: string;
  llmModel: string;
  temperature: number;
  onUseAsSubmission?: (improvedText: string) => void;
}

const PaperImprovementBox: React.FC<PaperImprovementBoxProps> = ({ 
  studentText, 
  llmProvider, 
  llmModel,
  temperature,
  onUseAsSubmission
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [improvedText, setImprovedText] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiProbability, setAiProbability] = useState<number | null>(null);

  const generateImprovedPaper = async () => {
    if (!studentText.trim()) {
      alert('Please enter or upload student text first');
      return;
    }

    setIsGenerating(true);
    setImprovedText(null);

    try {
      const instructions = `Please improve this student submission to earn a higher grade while STRICTLY maintaining the same format required by the assignment. If the assignment asks for an outline, create a better outline - not an essay. If it asks for a lab report, create a better lab report. Never change the required format of the assignment.

Focus on improving the content while keeping the exact same type of document requested in the assignment. Make it higher quality but in exactly the format that was assigned.`;

      const response = await fetch('/api/exemplar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider: llmProvider,
          model: llmModel,
          temperature: 0.7, // Fixed optimal temperature for paper improvement
          assignmentText: document.querySelector('#assignment-prompt')?.textContent || '',
          referenceText: studentText,
          instructionsText: instructions,
          includeAnnotations: false,
          isImprovement: true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate improved paper');
      }

      const improvedContent = await response.text();
      setImprovedText(improvedContent);
    } catch (error) {
      console.error('Error generating improved paper:', error);
      alert('Failed to generate improved paper. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyToClipboard = () => {
    if (improvedText) {
      navigator.clipboard.writeText(improvedText);
      alert('Improved paper copied to clipboard');
    }
  };
  
  // AI detection for improved text
  useEffect(() => {
    const analyzeImprovedText = async () => {
      if (improvedText && improvedText.length > 100) {
        setIsAnalyzing(true);
        try {
          const result = await detectAI(improvedText);
          setAiProbability(result.aiProbability);
        } catch (error) {
          console.error('Error detecting AI in improved text:', error);
        } finally {
          setIsAnalyzing(false);
        }
      }
    };
    
    if (improvedText) {
      analyzeImprovedText();
    } else {
      // Reset AI detection when text is cleared
      setAiProbability(null);
    }
  }, [improvedText]);
  
  // Helper function to get AI detection result label and color
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

  return (
    <Card className="border-t-4 border-purple-500">
      <div className="p-4 bg-purple-100">
        <h2 className="text-xl font-semibold flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Paper Improvement
        </h2>
        <p className="text-sm text-gray-600 mt-1">Create improved papers that will receive higher grades</p>
      </div>
      
      <CardContent className="p-4">
        {!isGenerating && !improvedText ? (
          <div>
            <p className="text-sm mb-4">This tool significantly enhances the student's submission to create a higher-quality paper that will earn better grades. It improves both content and structure while keeping the same general topic.</p>
            
            <div className="space-y-2">
              <Button 
                onClick={generateImprovedPaper}
                disabled={!studentText.trim()}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Improve
              </Button>
            </div>
          </div>
        ) : isGenerating ? (
          <div className="py-12 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mb-4"></div>
            <p className="text-gray-600">Improving paper...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-md font-medium">Higher-Grade Version</h3>
            </div>
            
            {/* AI Detection Status */}
            {aiProbability !== null && (
              <div className="my-2 p-2 border rounded bg-gray-50">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span className="text-sm font-medium">AI Detection:</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${getAiResultColor(aiProbability)} text-white font-medium`}>
                    {getAiResultLabel(aiProbability)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${getAiResultColor(aiProbability)}`} 
                    style={{ width: `${aiProbability}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  AI Probability: {aiProbability}%
                </p>
              </div>
            )}
            {isAnalyzing && (
              <div className="my-2 p-2 border rounded bg-gray-50 flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500 mr-2"></div>
                <p className="text-xs text-gray-500">Analyzing for AI content...</p>
              </div>
            )}
            
            <Textarea
              value={improvedText || ''}
              readOnly
              className="min-h-[400px] resize-y font-mono text-sm h-full w-full"
            />
            
            {/* Clear button */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setImprovedText('')}
              className="w-full mt-2 mb-2 text-gray-500 border-gray-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear Text
            </Button>
            
            {/* Simple Copy Button */}
            <Button
              onClick={() => {
                navigator.clipboard.writeText(improvedText || '');
                alert('Improved text copied to clipboard!');
              }}
              className="w-full mb-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 border border-gray-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy
            </Button>
            
            {/* "Grade This Version" Button */}
            <Button
              onClick={() => {
                if (improvedText && onUseAsSubmission) {
                  // First send paper to student submission box
                  onUseAsSubmission(improvedText);
                  
                  // Then trigger grading immediately without waiting for user interaction
                  setTimeout(() => {
                    // Find and click the grade button programmatically
                    const gradeButton = document.querySelector('.grade-button');
                    if (gradeButton) {
                      (gradeButton as HTMLButtonElement).click();
                    }
                  }, 500); // Short delay to ensure state updates properly
                }
              }}
              disabled={!improvedText || !onUseAsSubmission}
              className="w-full mb-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 text-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Grade This Version
            </Button>

            <div className="grid grid-cols-3 gap-2">
              <Button 
                variant="outline" 
                onClick={() => setImprovedText(null)}
                className="flex-1"
              >
                Reset
              </Button>
              <Button 
                onClick={generateImprovedPaper}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                Improve
              </Button>
              <Button
                onClick={() => {
                  // Create a blob and trigger download
                  if (improvedText) {
                    const blob = new Blob([improvedText], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'improved-paper.txt';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }
                }}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PaperImprovementBox;