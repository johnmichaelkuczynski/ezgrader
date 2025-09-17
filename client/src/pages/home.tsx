import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import AssignmentPromptBox from "@/components/assignment-prompt-box";
import GradingInstructionsBox from "@/components/grading-instructions-box";
import StudentSubmissionBox from "@/components/student-submission-box";
import GradingResultsBox from "@/components/grading-results-box";
import GradingFeedbackBox from "@/components/grading-feedback-box";
import AssignmentSelector from "@/components/assignment-selector";
import EmailModal from "@/components/email-modal";
import StudentGradesTable from "@/components/student-grades-table";
import PaperImprovementBox from "@/components/paper-improvement-box";
import AssignmentComparison from "@/components/assignment-comparison";
import AssignmentAttachments from "@/components/assignment-attachments";
import { MathView } from "@/components/math-view";
import ChatWithAI from "@/components/chat-with-ai";
import AITextRewriter from "@/components/ai-text-rewriter";
import PDFExport from "@/components/pdf-export";

import GradeLevelSelector, { GradeLevel } from "@/components/grade-level-selector";
import { LLMProvider, LLMModel, GradingDepth } from "@/lib/llm-service";
import { extractGradeFromFeedback } from "@/lib/utils";
import { Loader2, RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { processFile } from "@/lib/document-processor";

export default function Home() {
  const [llmProvider, setLlmProvider] = useState<LLMProvider>("openai");
  const [llmModel, setLlmModel] = useState<LLMModel>("gpt-4o");
  const [temperature, setTemperature] = useState<number>(0.7);
  const [gradingDepth, setGradingDepth] = useState<GradingDepth>("medium");
  const [includeCharts, setIncludeCharts] = useState<boolean>(true);
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>("undergraduate_regular");
  
  const [assignmentText, setAssignmentText] = useState<string>("");
  const [gradingText, setGradingText] = useState<string>("");
  const [studentText, setStudentText] = useState<string>("");
  const [isGrading, setIsGrading] = useState<boolean>(false);
  const [gradingResult, setGradingResult] = useState<string | null>(null);
  const [chartData, setChartData] = useState<any | null>(null);
  
  // AI Text Rewriter state
  const [aiTextRewriterInput, setAiTextRewriterInput] = useState<string>("");
  
  const [isEmailModalOpen, setIsEmailModalOpen] = useState<boolean>(false);
  const [currentAssignmentId, setCurrentAssignmentId] = useState<number | null>(null);
  const [editingAssignmentId, setEditingAssignmentId] = useState<number | null>(null);
  const [isSavingAssignment, setIsSavingAssignment] = useState<boolean>(false);
  const [studentName, setStudentName] = useState<string>("");
  const [showGradeHistory, setShowGradeHistory] = useState<boolean>(false);
  
  // State for exemplar generation
  const [isGeneratingExemplar, setIsGeneratingExemplar] = useState<boolean>(false);
  const [exemplarResult, setExemplarResult] = useState<string | null>(null);
  
  // State for perfect answer generation
  const [isGeneratingPerfectAnswer, setIsGeneratingPerfectAnswer] = useState<boolean>(false);
  const [perfectAnswer, setPerfectAnswer] = useState<string | null>(null);
  const [perfectAssignmentText, setPerfectAssignmentText] = useState<string>('');
  const [critique, setCritique] = useState<string>('');
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [perfectAnswerAiDetection, setPerfectAnswerAiDetection] = useState<{probability: number, isAI: boolean} | null>(null);
  const [emailContentType, setEmailContentType] = useState<'grading' | 'perfect'>('grading');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Session draft restoration function
  const checkAndRestoreSessionDraft = async () => {
    let restoredFromSession = false;
    
    try {
      const response = await fetch('/api/session-draft');
      if (response.ok) {
        const data = await response.json();
        if (data.hasDraft) {
          // Restore the perfect answer from session
          setPerfectAnswer(data.perfectAnswer);
          setPerfectAssignmentText(data.assignmentText);
          
          // Store in localStorage as backup
          localStorage.setItem('draftPerfectAnswer', JSON.stringify({
            perfectAnswer: data.perfectAnswer,
            assignmentText: data.assignmentText,
            timestamp: data.timestamp
          }));
          
          restoredFromSession = true;
          
          // Clear session draft to prevent repeated restores
          try {
            await fetch('/api/clear-session-draft', { method: 'POST' });
            console.log('Session draft cleared after successful restoration');
          } catch (clearError) {
            console.error('Error clearing session draft:', clearError);
          }
          
          toast({
            title: "Draft Restored",
            description: "Your previously generated answer has been restored.",
          });
        }
      }
    } catch (error) {
      console.error('Error checking session draft:', error);
    }
    
    // Always check localStorage if we didn't restore from session
    if (!restoredFromSession) {
      try {
        const localDraft = localStorage.getItem('draftPerfectAnswer');
        if (localDraft) {
          const draftData = JSON.parse(localDraft);
          const draftAge = new Date().getTime() - new Date(draftData.timestamp).getTime();
          const maxAge = 24 * 60 * 60 * 1000; // 24 hours
          
          if (draftAge < maxAge) {
            setPerfectAnswer(draftData.perfectAnswer);
            setPerfectAssignmentText(draftData.assignmentText);
            
            toast({
              title: "Draft Restored",
              description: "Your previously generated answer has been restored from local storage.",
            });
          } else {
            localStorage.removeItem('draftPerfectAnswer');
          }
        }
      } catch (localError) {
        console.error('Error restoring from localStorage:', localError);
      }
    }
  };

  // Check for authentication and restore drafts on component mount
  useEffect(() => {
    const checkAuthAndRestore = async () => {
      let isAuthenticated = false;
      
      try {
        const authResponse = await fetch('/api/auth/me');
        if (authResponse.ok) {
          isAuthenticated = true;
          // User is authenticated, check for session drafts first
          await checkAndRestoreSessionDraft();
        } else if (authResponse.status === 401) {
          // Not authenticated, but that's expected for logged-out users
          console.log('User not authenticated, skipping session draft check');
        } else {
          console.warn('Auth check failed with status:', authResponse.status);
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
      }
      
      // For non-authenticated users or if session restore failed, 
      // still check localStorage as fallback
      if (!isAuthenticated) {
        try {
          const localDraft = localStorage.getItem('draftPerfectAnswer');
          if (localDraft) {
            const draftData = JSON.parse(localDraft);
            const draftAge = new Date().getTime() - new Date(draftData.timestamp).getTime();
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours
            
            if (draftAge < maxAge) {
              setPerfectAnswer(draftData.perfectAnswer);
              setPerfectAssignmentText(draftData.assignmentText);
              
              toast({
                title: "Draft Restored", 
                description: "Your previously generated answer has been restored from local storage.",
              });
            } else {
              localStorage.removeItem('draftPerfectAnswer');
            }
          }
        } catch (localError) {
          console.error('Error restoring from localStorage (non-auth):', localError);
        }
      }
    };
    
    checkAuthAndRestore();
  }, []);

  // Function to clear all fields (New Assignment)
  const handleNewAssignment = () => {
    setAssignmentText('');
    setGradingText('');
    setStudentText('');
    setGradingResult(null);
    setPerfectAnswer(null);
    setPerfectAssignmentText('');
    setCritique('');
    setPerfectAnswerAiDetection(null);
    setStudentName('');
    setCurrentAssignmentId(null);
    setEditingAssignmentId(null);
    setChartData(null);
    toast({
      title: "New Assignment",
      description: "All fields have been cleared for a new assignment.",
    });
  };

  // Update existing assignment function
  const handleUpdateAssignment = async () => {
    if (!editingAssignmentId || !assignmentText.trim()) {
      toast({
        title: "Error",
        description: "Cannot save - missing assignment content or ID.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingAssignment(true);
    
    try {
      const response = await fetch(`/api/assignments/${editingAssignmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: assignmentText,
          gradingInstructions: gradingText.trim() || "Follow the assignment prompt closely and provide thoughtful analysis with clear reasoning."
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update assignment');
      }

      // Refresh assignments list
      queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
      
      toast({
        title: "Assignment Updated",
        description: "Your changes have been saved successfully.",
      });
      
    } catch (error) {
      console.error('Error updating assignment:', error);
      toast({
        title: "Error",
        description: "Failed to update assignment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingAssignment(false);
    }
  };

  // Generate perfect answer function
  const handleGeneratePerfectAnswer = async () => {
    if (!perfectAssignmentText.trim()) {
      toast({
        title: "Error",
        description: "Please enter an assignment prompt first.",
        variant: "destructive",
      });
      return;
    }
    
    setIsGeneratingPerfectAnswer(true);
    setPerfectAnswer(''); // Clear previous answer
    
    try {
      // Check if assignment requires chunked processing
      const wordCountMatch = perfectAssignmentText.match(/(\d+)\s*words?/i);
      const requiredWords = wordCountMatch ? parseInt(wordCountMatch[1]) : 1000;
      const needsChunking = requiredWords > 1500; // Higher threshold to avoid chunking for moderate assignments
      
      if (needsChunking) {
        // Use chunked processing with real-time updates
        const response = await fetch('/api/generate-perfect-answer-chunked', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            assignmentText: perfectAssignmentText,
            gradeLevel,
            provider: llmProvider,
            model: llmModel,
            temperature: 0.3,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to start chunked generation');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let chunkCount = 0;
        let totalChunks = 0;

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  if (data.type === 'chunk') {
                    chunkCount = data.chunkNumber;
                    totalChunks = data.totalChunks;
                    
                    // Update the perfect answer with the new chunk immediately
                    setPerfectAnswer(data.fullText);
                    
                    toast({
                      title: `Part ${chunkCount}/${totalChunks} Complete`,
                      description: `Writing section ${chunkCount} of ${totalChunks}...`,
                    });
                    
                  } else if (data.type === 'complete') {
                    setPerfectAnswer(data.fullText);
                    
                    // Run AI detection on final result - only for registered users
                    setTimeout(async () => {
                      try {
                        // Check if user is logged in before running AI detection
                        const authResponse = await fetch('/api/auth/me');
                        if (!authResponse.ok) {
                          // User not logged in - skip AI detection
                          return;
                        }
                        
                        const aiResponse = await fetch('/api/detect-ai', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ text: data.fullText })
                        });
                        if (aiResponse.ok) {
                          const aiData = await aiResponse.json();
                          setPerfectAnswerAiDetection({
                            probability: aiData.aiProbability,
                            isAI: aiData.isAIGenerated
                          });
                        }
                      } catch (error) {
                        console.error('AI detection failed:', error);
                      }
                    }, 1000);

                    toast({
                      title: "Perfect Answer Complete!",
                      description: `All ${totalChunks} sections generated successfully.`,
                    });
                    setIsGeneratingPerfectAnswer(false);
                    return;
                    
                  } else if (data.type === 'error') {
                    throw new Error(data.message);
                  }
                } catch (parseError) {
                  console.error('Error parsing chunk data:', parseError);
                }
              }
            }
          }
        }

      } else {
        // Use regular processing for smaller assignments
        const response = await fetch('/api/generate-perfect-answer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            assignmentText: perfectAssignmentText,
            gradeLevel,
            provider: llmProvider,
            model: llmModel,
            temperature: 0.3,
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to generate perfect answer');
        }
        
        const data = await response.json();
        setPerfectAnswer(data.perfectAnswer);
        
        // Automatically detect AI content - only for registered users
        try {
          // Check if user is logged in before running AI detection
          const authResponse = await fetch('/api/auth/me');
          if (!authResponse.ok) {
            // User not logged in - skip AI detection
            return;
          }
          
          const aiResponse = await fetch('/api/detect-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: data.perfectAnswer })
          });
          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            setPerfectAnswerAiDetection({
              probability: aiData.aiProbability,
              isAI: aiData.isAIGenerated
            });
          }
        } catch (error) {
          console.error('AI detection failed:', error);
        }

        toast({
          title: "Perfect Answer Generated!",
          description: "100/100 answer generated in the Perfect Assignment box.",
        });
        setIsGeneratingPerfectAnswer(false);
      }
      
    } catch (error) {
      console.error('Error generating perfect answer:', error);
      toast({
        title: "Error",
        description: "Failed to generate perfect answer. Please try again.",
        variant: "destructive",
      });
      setIsGeneratingPerfectAnswer(false);
    }
  };

  // Grade assignment function
  const handleGradeAssignment = async () => {
    if (!studentText) {
      toast({
        title: "Missing Student Submission",
        description: "Please provide a student submission to grade.",
        variant: "destructive",
      });
      return;
    }
    
    // Use defaults if fields are empty
    const finalAssignmentText = assignmentText || "Grade the following student submission";
    const finalGradingText = gradingText || "Please grade this submission using standard academic criteria. Provide a numeric grade and detailed feedback.";
    
    setIsGrading(true);
    setGradingResult(null);
    
    try {
      const response = await fetch('/api/grade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: llmProvider,
          model: llmModel,
          temperature,
          assignmentText: finalAssignmentText,
          gradingText: finalGradingText,
          studentText,
          gradingDepth,
          includeCharts,
          gradeLevel,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to grade assignment');
      }
      
      const data = await response.json();
      
      if (data.isPreview) {
        setGradingResult(data.result + "\n\n[PREVIEW ONLY - Register and purchase credits to see the complete response]");
      } else {
        setGradingResult(data.result);
      }
      
    } catch (error) {
      console.error('Error grading assignment:', error);
      setGradingResult(`Error: ${error instanceof Error ? error.message : 'Failed to process document'}. Please try again.`);
    } finally {
      setIsGrading(false);
    }
  };

  // Configure available models based on selected provider
  const getModelsForProvider = () => {
    switch(llmProvider) {
      case 'deepseek':
        return [
          { value: 'deepseek-chat', label: 'SHEN 5' },
          { value: 'deepseek-coder', label: 'SHEN 5 CODER' },
        ];
      case 'openai':
        return [
          { value: 'gpt-4o', label: 'SHEN 1' },
          { value: 'gpt-4-turbo', label: 'SHEN 2' },
        ];
      case 'anthropic':
        return [
          { value: 'claude-3-7-sonnet-20250219', label: 'SHEN 3' },
          { value: 'claude-3-opus', label: 'SHEN 4' },
        ];
      case 'perplexity':
        return [
          { value: 'llama-3.1-sonar-small-128k-online', label: 'SHEN 6 (SMALL)' },
          { value: 'llama-3.1-sonar-large-128k-online', label: 'SHEN 6 (LARGE)' },
          { value: 'llama-3.1-sonar-huge-128k-online', label: 'SHEN 6 (HUGE)' },
        ];
      default:
        return [];
    }
  };

  // Handle assignment selection
  const handleAssignmentSelect = (assignmentId: number) => {
    const assignment = assignments?.find((a: any) => a.id === assignmentId);
    if (assignment) {
      setAssignmentText(assignment.prompt);
      setCurrentAssignmentId(assignmentId);
    }
  };

  // Handle regenerating perfect answer based on critique
  const handleRegeneratePerfectAnswer = async () => {
    if (!critique.trim() || !perfectAnswer) return;
    
    setIsRegenerating(true);
    try {
      const response = await fetch('/api/regenerate-perfect-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assignmentText: perfectAssignmentText,
          gradingText,
          currentAnswer: perfectAnswer,
          critique: critique,
          llmProvider,
          llmModel,
          temperature,
          gradeLevel
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate perfect answer');
      }

      const data = await response.json();
      setPerfectAnswer(data.perfectAnswer);
      setCritique(''); // Clear critique after successful regeneration
      
      toast({
        title: "Perfect Answer Regenerated",
        description: "The perfect answer has been updated based on your critique.",
      });
    } catch (error) {
      console.error('Error regenerating perfect answer:', error);
      toast({
        title: "Error",
        description: "Failed to regenerate perfect answer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  // Fetch assignments
  const { data: assignments = [] } = useQuery({
    queryKey: ['/api/assignments'],
    queryFn: async () => {
      const res = await fetch('/api/assignments');
      if (res.status === 401) {
        // User not authenticated, return empty array
        return [];
      }
      if (!res.ok) {
        throw new Error('Failed to fetch assignments');
      }
      return res.json();
    },
  });

  // Listen for assignment saves to refresh the list
  useEffect(() => {
    const handleAssignmentSaved = () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
    };
    
    window.addEventListener('assignmentSaved', handleAssignmentSaved);
    return () => window.removeEventListener('assignmentSaved', handleAssignmentSaved);
  }, [queryClient]);

  // Fetch student grades
  const { data: studentGrades = [] } = useQuery({
    queryKey: ['/api/student-grades'],
    queryFn: () => fetch('/api/student-grades').then(res => res.json()),
  });

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <main className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 text-center relative">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">AI Grading Platform</h1>
          <p className="text-gray-600">Advanced assignment evaluation with perfect OCR and A+ answer generation</p>
          
          {/* Contact Us Link - positioned discretely in top left */}
          <a 
            href="mailto:contact@zhisystems.ai"
            className="absolute top-0 left-0 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Contact Us
          </a>
          
          {/* New Assignment Button - positioned in top right */}
          <Button
            onClick={handleNewAssignment}
            variant="outline"
            className="absolute top-0 right-0 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            New Assignment
          </Button>
        </div>



        {/* Tabs */}
        <Tabs defaultValue="grading" className="mb-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="grading">Grading</TabsTrigger>
            <TabsTrigger value="compare">Compare Assignments</TabsTrigger>
            <TabsTrigger value="grades">Student Grades</TabsTrigger>
          </TabsList>
        
          <TabsContent value="grading" className="mt-4">
            <div className="space-y-6">
              {/* Controls Row */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <Label htmlFor="llm-provider">AI Provider</Label>
                      <Select 
                        value={llmProvider} 
                        onValueChange={(value) => {
                          setLlmProvider(value as LLMProvider);
                          if (value === 'deepseek') setLlmModel('deepseek-chat');
                          else if (value === 'openai') setLlmModel('gpt-4o');
                          else if (value === 'anthropic') setLlmModel('claude-3-7-sonnet-20250219');
                          else if (value === 'perplexity') setLlmModel('llama-3.1-sonar-large-128k-online');
                        }}
                      >
                        <SelectTrigger className="w-[180px]" id="llm-provider">
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="deepseek">ZHI 3</SelectItem>
                          <SelectItem value="openai">ZHI 1</SelectItem>
                          <SelectItem value="anthropic">ZHI 2</SelectItem>
                          <SelectItem value="perplexity">ZHI 4</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="llm-model">Model</Label>
                      <Select value={llmModel} onValueChange={(value) => setLlmModel(value as LLMModel)}>
                        <SelectTrigger className="w-[220px]" id="llm-model">
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent>
                          {getModelsForProvider().map((model) => (
                            <SelectItem key={model.value} value={model.value}>
                              {model.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <GradeLevelSelector 
                      value={gradeLevel} 
                      onChange={setGradeLevel} 
                    />
                    
                    <div className="w-[180px]">
                      <Label htmlFor="temperature">Temperature: {temperature}</Label>
                      <Slider
                        id="temperature"
                        min={0}
                        max={1}
                        step={0.1}
                        value={[temperature]}
                        onValueChange={(value) => setTemperature(value[0])}
                        className="mt-2"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Assignment Selection */}
              <AssignmentSelector 
                assignmentText={assignmentText}
                gradingText={gradingText}
                onAssignmentChange={(assignment) => {
                  setAssignmentText(assignment.prompt);
                  setGradingText(assignment.gradingInstructions);
                }}
                onAssignmentSelect={(assignmentId) => {
                  setEditingAssignmentId(assignmentId);
                }}
              />
              
              {/* Update Assignment Button */}
              {editingAssignmentId && (
                <div className="flex justify-center mb-4">
                  <Button
                    onClick={handleUpdateAssignment}
                    disabled={isSavingAssignment || !assignmentText.trim()}
                    variant="default"
                    size="lg"
                  >
                    {isSavingAssignment ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Updating Assignment...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Update Assignment
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <AssignmentPromptBox 
                  value={assignmentText} 
                  onChange={setAssignmentText} 
                />
                
                <GradingInstructionsBox 
                  value={gradingText} 
                  onChange={setGradingText} 
                />
                
                <StudentSubmissionBox 
                  value={studentText} 
                  onChange={setStudentText} 
                  onGradeSubmission={handleGradeAssignment}
                  onDetectStudentName={setStudentName}
                />
              </div>


              
              {/* Results Grid - Top Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <GradingResultsBox
                  result={gradingResult}
                  isLoading={isGrading}
                  onEmailResults={() => {
                  setEmailContentType('grading');
                  setIsEmailModalOpen(true);
                }}
                  onClear={() => setGradingResult(null)}
                />

                <GradingFeedbackBox 
                  result={gradingResult}
                  studentName={studentName}
                  onStudentNameChange={setStudentName}
                />

                <PaperImprovementBox 
                  assignmentText={assignmentText}
                  gradingText={gradingText}
                  studentText={studentText}
                  gradingResult={gradingResult}
                  llmProvider={llmProvider}
                  llmModel={llmModel}
                  temperature={temperature}
                  gradeLevel={gradeLevel}
                  onUseAsSubmission={setStudentText}
                  onSendToHumanizer={setAiTextRewriterInput}
                />
              </div>

              {/* Perfect Assignment Box - 7th Box */}
              <div className="mt-6">
                <Card className="border-2 border-green-500">
                  <CardHeader className="bg-green-50 pb-4">
                    <CardTitle className="text-green-800 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Perfect Assignment Generator (100/100)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-4">
                      {/* Select Saved Assignment */}
                      <div>
                        <Label className="block mb-2">Select Saved Assignment</Label>
                        <Select
                          value=""
                          onValueChange={(value) => {
                            const assignment = assignments?.find((a: any) => a.id === parseInt(value));
                            if (assignment) {
                              setPerfectAssignmentText(assignment.prompt);
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose from saved assignments..." />
                          </SelectTrigger>
                          <SelectContent>
                            {assignments?.map((assignment: any) => (
                              <SelectItem key={assignment.id} value={assignment.id.toString()}>
                                {assignment.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Assignment Text Input */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <Label htmlFor="perfect-assignment-text">Assignment Instructions</Label>
                          <span className="text-xs text-gray-500">
                            Words: {perfectAssignmentText.split(/\s+/).filter(word => word.length > 0).length}
                          </span>
                        </div>
                        <Textarea
                          id="perfect-assignment-text"
                          placeholder="Enter the assignment prompt that needs a perfect 100/100 answer... (Ctrl+Enter to generate)"
                          value={perfectAssignmentText}
                          onChange={(e) => setPerfectAssignmentText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.ctrlKey && !isGeneratingPerfectAnswer && perfectAssignmentText.trim()) {
                              e.preventDefault();
                              handleGeneratePerfectAnswer();
                            }
                          }}
                          className="min-h-[120px]"
                        />
                      </div>

                      {/* File Upload for Perfect Answer */}
                      <div>
                        <Label className="block mb-2">Upload Assignment Document (Optional)</Label>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const content = await processFile(file);
                                setPerfectAssignmentText(prev => prev ? prev + '\n\n' + content : content);
                                toast({
                                  title: "File Processed",
                                  description: "Document content added to assignment text.",
                                });
                              } catch (error) {
                                toast({
                                  title: "Error",
                                  description: "Failed to process document.",
                                  variant: "destructive",
                                });
                              }
                            }
                          }}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 border-2 border-dashed border-green-300 bg-green-50 p-4 rounded-lg"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={handleGeneratePerfectAnswer}
                          disabled={!perfectAssignmentText.trim() || isGeneratingPerfectAnswer}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          {isGeneratingPerfectAnswer ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Generating Perfect Answer...
                            </>
                          ) : (
                            'Generate Perfect Assignment Answer'
                          )}
                        </Button>
                        <Button
                          onClick={() => {
                            setPerfectAssignmentText('');
                            setPerfectAnswer(null);
                            setPerfectAnswerAiDetection(null);
                            setCritique('');
                            toast({
                              title: "Perfect Answer Generator Cleared",
                              description: "All fields have been cleared.",
                            });
                          }}
                          disabled={isGeneratingPerfectAnswer}
                          variant="outline"
                          className="px-4"
                          data-testid="button-clear-perfect-answer"
                        >
                          Clear
                        </Button>
                      </div>
                      
                      {/* Progress Window - Shows during generation */}
                      {isGeneratingPerfectAnswer && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-blue-800">Generating Perfect Answer</h4>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          </div>
                          <div className="max-h-96 overflow-y-auto bg-white rounded p-3 border">
                            {perfectAnswer ? (
                              <div>
                                <MathView 
                                  text={perfectAnswer + " ⏳"}
                                  title="Generating..."
                                />
                              </div>
                            ) : (
                              <div className="text-gray-500 text-sm">Starting generation...</div>
                            )}
                          </div>
                        </div>
                      )}

                      {perfectAnswer && !isGeneratingPerfectAnswer && (
                        <div className="space-y-2">
                          <MathView 
                            text={perfectAnswer}
                            title="Perfect Assignment Answer (100/100 A+)"
                            showAiDetection={true}
                            aiDetectionResult={perfectAnswerAiDetection}
                          />
                          <div className="flex gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  Critique & Regenerate
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Critique Perfect Answer</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-sm font-medium mb-2">Current Perfect Answer:</label>
                                    <div className="bg-gray-50 p-3 rounded border max-h-40 overflow-y-auto text-sm">
                                      {perfectAnswer}
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium mb-2">Your Critique/Improvements:</label>
                                    <Textarea
                                      value={critique}
                                      onChange={(e) => setCritique(e.target.value)}
                                      placeholder="Enter your critique and suggestions for improvement..."
                                      className="min-h-[100px]"
                                    />
                                  </div>
                                  <Button
                                    onClick={handleRegeneratePerfectAnswer}
                                    disabled={!critique || isRegenerating}
                                    className="w-full"
                                  >
                                    {isRegenerating ? 'Regenerating...' : 'Regenerate Based on Critique'}
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setStudentText(perfectAnswer)}
                              className="border-purple-600 text-purple-600 hover:bg-purple-50"
                              title="Send to Student Submission for Verification"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                              Verify
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigator.clipboard.writeText(perfectAnswer)}
                            >
                              Copy
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Create Word document download
                                const docContent = `Perfect Assignment Answer\n\n${perfectAnswer}`;
                                const blob = new Blob(['\ufeff', docContent], { 
                                  type: 'application/msword'
                                });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'perfect-assignment.doc';
                                a.click();
                                URL.revokeObjectURL(url);
                              }}
                            >
                              Download Word
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Open print dialog for PDF saving
                                const printWindow = window.open('', '_blank');
                                if (printWindow) {
                                  printWindow.document.write(`
                                    <html>
                                      <head>
                                        <title>Perfect Assignment Answer</title>
                                        <style>
                                          @page { margin: 0.5in; size: auto; }
                                          @media print { 
                                            @page { margin: 0.5in; }
                                            body { -webkit-print-color-adjust: exact; }
                                          }
                                          body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
                                          h1 { color: #333; border-bottom: 2px solid #333; }
                                          .content { white-space: pre-wrap; }
                                        </style>
                                      </head>
                                      <body>
                                        <h1>Perfect Assignment Answer (100/100)</h1>
                                        <div class="content">${perfectAnswer}</div>
                                      </body>
                                    </html>
                                  `);
                                  printWindow.document.close();
                                  printWindow.print();
                                }
                              }}
                            >
                              Save as PDF
                            </Button>
                            <PDFExport 
                              content={perfectAnswer}
                              title="Perfect Assignment Answer (100/100 A+)"
                              fileName="perfect-assignment-answer"
                              className="mr-2"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Open email modal for perfect answer
                                setEmailContentType('perfect');
                                setIsEmailModalOpen(true);
                              }}
                            >
                              Email Results
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="compare" className="mt-4">
            <AssignmentComparison 
              assignments={assignments}
              llmProvider={llmProvider}
              llmModel={llmModel}
              temperature={temperature}
              gradeLevel={gradeLevel}
            />
          </TabsContent>
          
          <TabsContent value="grades" className="mt-4">
            <StudentGradesTable grades={studentGrades} />
          </TabsContent>
        </Tabs>
      </main>



      {/* Email Modal */}
      <EmailModal 
        isOpen={isEmailModalOpen} 
        onClose={() => setIsEmailModalOpen(false)} 
        gradingResult={emailContentType === 'perfect' ? 
          (perfectAnswer ? 
            `Perfect Assignment Answer (100/100 A+)\n\nWord Count: ${perfectAnswer.split(/\s+/).filter(word => word.length > 0).length}\n${perfectAnswerAiDetection ? `AI Detection: ${perfectAnswerAiDetection.probability}% ${perfectAnswerAiDetection.isAI ? 'AI Generated' : 'Human-like'}\n` : ''}\n${perfectAnswer}` 
            : 'No perfect answer generated yet') 
          : (gradingResult || '')}
      />

      {/* Chat with AI */}
      <div className="mt-6">
        <ChatWithAI
          assignmentText={assignmentText}
          gradingText={gradingText}
          studentText={studentText}
          resultText={gradingResult || ''}
          onSendToAssignment={setAssignmentText}
          onSendToStudent={setStudentText}
          onSendToGrading={setGradingText}
          onSendToPerfectGenerator={setPerfectAssignmentText}
          onSendToHumanizer={setAiTextRewriterInput}
        />
      </div>

      {/* AI Text Rewriter */}
      <div className="mt-6">
        <AITextRewriter 
          onSendToStudentSubmission={setStudentText}
          onSendToBoxA={setAiTextRewriterInput}
          initialInputText={aiTextRewriterInput}
        />
      </div>
    </div>
  );
}