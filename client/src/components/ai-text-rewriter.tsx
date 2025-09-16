import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Download, Upload, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

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

interface StyleSample {
  id: number;
  name: string;
  content: string;
  description?: string;
  category: string;
  isDefault: boolean;
}

interface InstructionPreset {
  id: number;
  name: string;
  instructions: string;
  description?: string;
  category: string;
  isDefault: boolean;
}

export default function AITextRewriter({ className }: AITextRewriterProps) {
  const [inputText, setInputText] = useState("");
  const [styleSample, setStyleSample] = useState("");
  const [selectedStyleSampleId, setSelectedStyleSampleId] = useState<number | null>(null);
  const [selectedPresets, setSelectedPresets] = useState<number[]>([]);
  const [outputText, setOutputText] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [llmProvider, setLlmProvider] = useState("anthropic"); // Default to Anthropic
  const [llmModel, setLlmModel] = useState("claude-3-7-sonnet");
  const [temperature, setTemperature] = useState(0.7);
  
  const [isRewriting, setIsRewriting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingStyleSample, setIsUploadingStyleSample] = useState(false);
  
  const [inputAiScore, setInputAiScore] = useState<number | null>(null);
  const [outputAiScore, setOutputAiScore] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const { toast } = useToast();

  // Fetch style samples and instruction presets from backend
  const { data: styleSamples = [], isLoading: isLoadingStyleSamples } = useQuery<StyleSample[]>({
    queryKey: ["/api/ai-rewriter/style-samples"],
  });

  const { data: instructionPresets = [], isLoading: isLoadingPresets } = useQuery<InstructionPreset[]>({
    queryKey: ["/api/ai-rewriter/instruction-presets"],
  });

  // Handle style sample selection
  const handleStyleSampleChange = (value: string) => {
    if (value === "custom") {
      setSelectedStyleSampleId(null);
      setStyleSample("");
    } else {
      const sampleId = parseInt(value);
      const sample = styleSamples.find((s: StyleSample) => s.id === sampleId);
      if (sample) {
        setSelectedStyleSampleId(sampleId);
        setStyleSample(sample.content);
      }
    }
  };

  // Handle preset selection
  const handlePresetToggle = (presetId: number) => {
    setSelectedPresets(prev => {
      if (prev.includes(presetId)) {
        return prev.filter(id => id !== presetId);
      } else {
        return [...prev, presetId];
      }
    });
  };

  // Build combined custom instructions from selected presets
  const buildCustomInstructions = () => {
    const selectedPresetInstructions = selectedPresets
      .map(id => instructionPresets.find(p => p.id === id)?.instructions)
      .filter(Boolean)
      .join('. ');
    
    const userInstructions = customInstructions.trim();
    
    if (selectedPresetInstructions && userInstructions) {
      return `${selectedPresetInstructions}. ${userInstructions}`;
    }
    
    return selectedPresetInstructions || userInstructions || null;
  };

  // Set default style sample when samples are loaded
  useEffect(() => {
    if (styleSamples.length > 0 && !selectedStyleSampleId && !styleSample) {
      const defaultSample = styleSamples.find((s: StyleSample) => s.isDefault) || styleSamples[0];
      if (defaultSample) {
        setSelectedStyleSampleId(defaultSample.id);
        setStyleSample(defaultSample.content);
      }
    }
  }, [styleSamples, selectedStyleSampleId, styleSample]);

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
        customInstructions: buildCustomInstructions(),
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

  const handleStyleSampleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingStyleSample(true);
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
      setStyleSample(result.content);
      setSelectedStyleSampleId(null); // Switch to custom when uploading
      
      toast({
        title: "Style Sample Uploaded",
        description: `Loaded ${result.wordCount} words for style reference`,
      });

    } catch (error: any) {
      console.error("Error uploading style sample:", error);
      toast({
        title: "Upload Error",
        description: error.message || "Failed to upload style sample",
        variant: "destructive"
      });
    } finally {
      setIsUploadingStyleSample(false);
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
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* Writing Samples */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Writing Samples</h3>
                <Select value={selectedStyleSampleId?.toString() || "custom"} onValueChange={handleStyleSampleChange}>
                  <SelectTrigger data-testid="select-style-sample">
                    <SelectValue placeholder="Select writing sample" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom Text</SelectItem>
                    {isLoadingStyleSamples ? (
                      <SelectItem value="loading" disabled>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Loading...
                      </SelectItem>
                    ) : (
                      styleSamples.map((sample: StyleSample) => (
                        <SelectItem key={sample.id} value={sample.id.toString()}>
                          {sample.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {selectedStyleSampleId && (
                  <div className="text-xs text-muted-foreground">
                    {styleSamples.find(s => s.id === selectedStyleSampleId)?.description || "Click to preview writing style"}
                  </div>
                )}
              </div>

              {/* Style Presets */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Style Presets</h3>
                <p className="text-xs text-muted-foreground">
                  Presets 1-8 are most effective for humanization
                </p>
                <div className="space-y-3">
                  {isLoadingPresets ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading presets...</span>
                    </div>
                  ) : (
                    instructionPresets.map((preset) => (
                      <div key={preset.id} className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`preset-${preset.id}`}
                            checked={selectedPresets.includes(preset.id)}
                            onCheckedChange={() => handlePresetToggle(preset.id)}
                            data-testid={`checkbox-preset-${preset.id}`}
                          />
                          <label
                            htmlFor={`preset-${preset.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {preset.name}
                            {preset.isDefault && <span className="ml-1 text-red-500">★</span>}
                          </label>
                        </div>
                        {preset.description && (
                          <p className="text-xs text-muted-foreground ml-6">
                            {preset.description}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

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
            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-3 space-y-6">
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="style-sample">Box B - Style Sample</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt"
                        onChange={handleStyleSampleUpload}
                        className="hidden"
                        id="style-sample-upload"
                        data-testid="input-style-sample-upload"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById("style-sample-upload")?.click()}
                        disabled={isUploadingStyleSample}
                        data-testid="button-upload-style-sample"
                      >
                        {isUploadingStyleSample ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    id="style-sample"
                    placeholder="Select from dropdown or upload your own style sample..."
                    value={styleSample}
                    onChange={(e) => {
                      setStyleSample(e.target.value);
                      setSelectedStyleSampleId(null); // Switch to custom when manually editing
                    }}
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
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}