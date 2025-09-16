import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Download, Upload, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// LLM Provider options for AI Text Rewriter (using SHEN branding)
const LLM_PROVIDERS = [
  { value: "anthropic", label: "SHEN 1" },
  { value: "openai", label: "SHEN 2" },
  { value: "deepseek", label: "SHEN 3" },
  { value: "perplexity", label: "SHEN 4" },
];

interface AITextRewriterProps {
  className?: string;
}

export default function AITextRewriter({ className }: AITextRewriterProps) {
  const [inputText, setInputText] = useState("");
  const [styleSample, setStyleSample] = useState("");
  const [outputText, setOutputText] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [llmProvider, setLlmProvider] = useState("anthropic"); // Default to Anthropic
  const [llmModel, setLlmModel] = useState("claude-3-7-sonnet");
  const [temperature, setTemperature] = useState(0.7);
  
  const [isRewriting, setIsRewriting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [inputAiScore, setInputAiScore] = useState<number | null>(null);
  const [outputAiScore, setOutputAiScore] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const { toast } = useToast();

  // Default style sample (The Raven Paradox)
  const defaultStyleSample = `Carl Hempel's ravens paradox illustrates a fundamental problem with inductive reasoning. Consider the statement "All ravens are black." According to the logic of confirmation, observing a black raven should support this hypothesis. However, the statement is logically equivalent to "All non-black things are non-ravens." By this equivalence, observing a white shoe—which is indeed non-black and non-raven—should equally support our original hypothesis about ravens.

This leads to the paradoxical conclusion that examining white shoes in our living room provides evidence about the color of ravens in the wild. While logically sound, this violates our intuitive understanding of relevant evidence. The paradox reveals the complexity inherent in inductive inference and highlights how formal logical structures can diverge from practical reasoning.

Hempel proposed that the paradox dissolves when we consider the relative informativeness of different observations, but the underlying tension between logical validity and intuitive relevance remains a subject of philosophical debate.`;

  // Set default style sample on component mount
  useEffect(() => {
    if (!styleSample) {
      setStyleSample(defaultStyleSample);
    }
  }, []);

  const handleAnalyzeText = async (text: string) => {
    if (!text.trim()) return null;
    
    setIsAnalyzing(true);
    try {
      const response = await apiRequest("POST", "/api/ai-rewriter/analyze-text", { text });
      const data = await response.json();
      return data.aiScore;
    } catch (error) {
      console.error("Error analyzing text:", error);
      toast({
        title: "Analysis Error", 
        description: "Failed to analyze text with GPTZero",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRewrite = async () => {
    if (!inputText.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter text to rewrite in Box A",
        variant: "destructive"
      });
      return;
    }

    setIsRewriting(true);
    try {
      // Analyze input text first
      const inputScore = await handleAnalyzeText(inputText);
      if (inputScore !== null) {
        setInputAiScore(inputScore);
      }

      // Perform rewrite
      const response = await apiRequest("POST", "/api/ai-rewriter/rewrite", {
        inputText: inputText.trim(),
        styleSample: styleSample.trim() || null,
        customInstructions: customInstructions.trim() || null,
        llmProvider,
        llmModel,
        temperature,
      });

      const data = await response.json();
      setOutputText(data.rewrittenText);
      setOutputAiScore(data.outputAiScore);
      setSessionId(data.sessionId);
      
      toast({
        title: "Rewrite Complete",
        description: `Input: ${inputAiScore ?? data.inputAiScore ?? 0}% AI • Output: ${data.outputAiScore ?? outputAiScore ?? 0}% AI`,
      });

    } catch (error: any) {
      console.error("Error rewriting text:", error);
      toast({
        title: "Rewrite Error",
        description: error.message || "Failed to rewrite text",
        variant: "destructive"
      });
    } finally {
      setIsRewriting(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/ai-rewriter/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();
      setInputText(result.content);
      setInputAiScore(result.aiScore);
      
      toast({
        title: "File Uploaded",
        description: `Loaded ${result.wordCount} words (${result.aiScore}% AI)`,
      });

    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast({
        title: "Upload Error",
        description: error.message || "Failed to upload file",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (format: 'pdf' | 'docx' | 'txt') => {
    if (!outputText.trim()) {
      toast({
        title: "No Content",
        description: "No rewritten text to download",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch(`/api/ai-rewriter/download/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: outputText,
          filename: "rewritten-text",
        }),
      });

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rewritten-text.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Complete",
        description: `Downloaded rewritten text as ${format.toUpperCase()}`,
      });

    } catch (error: any) {
      console.error("Error downloading file:", error);
      toast({
        title: "Download Error",
        description: error.message || `Failed to download ${format.toUpperCase()}`,
        variant: "destructive"
      });
    }
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            AI Text Rewriter
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Rewrite content to exactly match the style of your reference text at the most granular level possible.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* LLM Provider Selection */}
          <div className="space-y-2">
            <Label htmlFor="llm-provider">LLM Provider</Label>
            <Select value={llmProvider} onValueChange={setLlmProvider}>
              <SelectTrigger data-testid="select-llm-provider">
                <SelectValue placeholder="Select LLM Provider" />
              </SelectTrigger>
              <SelectContent>
                {LLM_PROVIDERS.map((provider) => (
                  <SelectItem key={provider.value} value={provider.value}>
                    {provider.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Three Main Boxes Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Box A - Input Text */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="input-text">Box A - Input Text</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                    data-testid="input-file-upload"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById("file-upload")?.click()}
                    disabled={isUploading}
                    data-testid="button-upload-file"
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </Button>
                  {inputAiScore !== null && (
                    <span className="text-xs text-muted-foreground">
                      {inputAiScore}% AI
                    </span>
                  )}
                </div>
              </div>
              <Textarea
                id="input-text"
                placeholder="Enter or upload text to be rewritten..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
                data-testid="textarea-input-text"
              />
            </div>

            {/* Box B - Style Sample */}
            <div className="space-y-2">
              <Label htmlFor="style-sample">Box B - Style Sample</Label>
              <Textarea
                id="style-sample"
                placeholder="Enter text whose writing style you want to mimic..."
                value={styleSample}
                onChange={(e) => setStyleSample(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
                data-testid="textarea-style-sample"
              />
            </div>

            {/* Box C - Output Text */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="output-text">Box C - Rewritten Output</Label>
                <div className="flex items-center gap-2">
                  {outputAiScore !== null && (
                    <span className="text-xs text-muted-foreground">
                      {outputAiScore}% AI
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload('txt')}
                    disabled={!outputText}
                    data-testid="button-download-txt"
                  >
                    <Download className="h-4 w-4" />
                    TXT
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload('docx')}
                    disabled={!outputText}
                    data-testid="button-download-docx"
                  >
                    <Download className="h-4 w-4" />
                    DOCX
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload('pdf')}
                    disabled={!outputText}
                    data-testid="button-download-pdf"
                  >
                    <Download className="h-4 w-4" />
                    PDF
                  </Button>
                </div>
              </div>
              <Textarea
                id="output-text"
                placeholder="Rewritten text will appear here..."
                value={outputText}
                readOnly
                className="min-h-[300px] font-mono text-sm bg-muted"
                data-testid="textarea-output-text"
              />
            </div>
          </div>

          {/* Custom Instructions */}
          <div className="space-y-2">
            <Label htmlFor="custom-instructions">Custom Instructions (Optional)</Label>
            <Textarea
              id="custom-instructions"
              placeholder="Add any specific instructions for the rewriting process..."
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              className="min-h-[80px]"
              data-testid="textarea-custom-instructions"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4">
            <Button
              onClick={handleRewrite}
              disabled={isRewriting || !inputText.trim()}
              className="px-8"
              data-testid="button-rewrite"
            >
              {isRewriting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rewriting...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Rewrite Text
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}