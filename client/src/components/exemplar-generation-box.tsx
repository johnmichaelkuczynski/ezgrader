import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import FileUpload from './file-upload';
import { LLMProvider, LLMModel } from '@/lib/llm-service';

interface ExemplarGenerationBoxProps {
  llmProvider: LLMProvider;
  llmModel: LLMModel;
  temperature: number;
  assignmentText: string;
}

const ExemplarGenerationBox: React.FC<ExemplarGenerationBoxProps> = ({ 
  llmProvider, 
  llmModel, 
  temperature,
  assignmentText
}) => {
  const [referenceText, setReferenceText] = useState<string>("");
  const [instructionsText, setInstructionsText] = useState<string>("");
  const [includeAnnotations, setIncludeAnnotations] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [exemplarResult, setExemplarResult] = useState<string | null>(null);
  
  const handleGenerateExemplar = async () => {
    if (!assignmentText || !instructionsText) {
      return;
    }
    
    setIsGenerating(true);
    
    try {
      const response = await fetch('/api/exemplar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: llmProvider,
          model: llmModel,
          temperature,
          assignmentText,
          referenceText,
          instructionsText,
          includeAnnotations,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate exemplar');
      }
      
      const data = await response.text();
      setExemplarResult(data);
    } catch (error) {
      console.error('Error generating exemplar:', error);
    } finally {
      setIsGenerating(false);
    }
  };
  
  return (
    <Card className="mt-6 border-t-4 border-purple">
      <div className="p-4 bg-purple-light">
        <h2 className="text-xl font-semibold flex items-center">
          <span className="material-icons mr-2">auto_awesome</span>
          Exemplar Generation
        </h2>
        <p className="text-sm text-gray-600 mt-1">Generate model examples of successful assignments</p>
      </div>
      
      <CardContent className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-md font-medium mb-3">Reference Materials</h3>
          <FileUpload 
            id="reference-file" 
            className="mb-4" 
            onFileContent={setReferenceText}
            colorScheme="purple"
          />
          
          <Textarea
            id="reference-text"
            value={referenceText}
            onChange={(e) => setReferenceText(e.target.value)}
            placeholder="Enter reference materials or context for exemplar generation..."
            className="min-h-[160px] resize-y"
          />
            
          <div className="mt-4">
            <h3 className="text-md font-medium mb-3">Generation Instructions</h3>
            <Textarea
              id="exemplar-instructions"
              value={instructionsText}
              onChange={(e) => setInstructionsText(e.target.value)}
              placeholder="Provide specific instructions for the exemplar (e.g., 'Create an A+ essay that demonstrates excellent critical analysis')..."
              className="min-h-[160px] resize-y"
            />
            
            <div className="mt-4 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="include-annotations" 
                  checked={includeAnnotations}
                  onCheckedChange={(checked) => setIncludeAnnotations(checked === true)}
                />
                <Label htmlFor="include-annotations">Include annotations</Label>
              </div>
              <Button 
                onClick={handleGenerateExemplar}
                disabled={isGenerating || !instructionsText}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <span className="material-icons text-sm mr-1">auto_awesome</span>
                Generate Exemplar
              </Button>
            </div>
          </div>
        </div>
        
        <div>
          <h3 className="text-md font-medium mb-3">Generated Exemplar</h3>
          {isGenerating ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mb-4"></div>
              <p className="text-gray-600">
                Waiting for {llmProvider === 'openai' ? 'ZHI 1' : llmProvider === 'anthropic' ? 'ZHI 2' : llmProvider === 'deepseek' ? 'ZHI 3' : 'ZHI 4'} {llmModel} response...
              </p>
            </div>
          ) : exemplarResult ? (
            <div className="raw-output-container h-[450px]">
              {exemplarResult}
            </div>
          ) : (
            <div className="raw-output-container h-[450px]">
              <div className="py-12 text-center">
                <span className="material-icons text-gray-400 text-5xl mb-2">lightbulb</span>
                <p className="text-gray-500">Exemplar will appear here after generation</p>
                <p className="text-xs text-gray-400 mt-1">The generated example will be displayed exactly as returned by the LLM</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ExemplarGenerationBox;
