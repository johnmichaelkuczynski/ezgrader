import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import FileUpload from './file-upload';
import { MathView } from './math-view';

import { Eye, X, Wand2 } from 'lucide-react';


interface AssignmentPromptBoxProps {
  value: string;
  onChange: (value: string) => void;
}

const AssignmentPromptBox: React.FC<AssignmentPromptBoxProps> = ({ value, onChange }) => {
  const [showMathView, setShowMathView] = useState(false);
  const [referenceMaterials, setReferenceMaterials] = useState<Array<{id: string, name: string, content: string}>>([]);
  const [isFormattingMath, setIsFormattingMath] = useState(false);

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



  return (
    <Card className="border-t-4 border-primary">
      <div className="p-4 bg-blue-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Assignment Prompt
            </h2>
            <p className="text-sm text-gray-600 mt-1">Upload or enter the assignment instructions</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={formatMathNotation}
              disabled={isFormattingMath || !value.trim()}
              className="text-blue-600 border-blue-300 hover:bg-blue-50"
            >
              <Wand2 className="w-4 h-4 mr-1" />
              {isFormattingMath ? 'Formatting...' : 'Format Math'}
            </Button>
            <Label htmlFor="math-view-assignment" className="text-sm">Math View</Label>
            <Switch
              id="math-view-assignment"
              checked={showMathView}
              onCheckedChange={setShowMathView}
            />
          </div>
        </div>
      </div>
      
      <CardContent className="p-4">
        <FileUpload 
          id="assignment-file" 
          className="mb-4" 
          onFileContent={(content) => onChange(content)}
          colorScheme="primary"
        />
        
        {/* Reference Materials Upload */}
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <Label className="text-sm font-medium text-green-800">Reference Materials</Label>
          </div>
          <p className="text-xs text-green-700 mb-3">
            Upload textbooks, articles, or other materials needed for this assignment (PDF, DOC, DOCX, TXT, images)
          </p>
          <FileUpload 
            id="reference-materials" 
            className="bg-white" 
            onFileContent={(content, fileName) => {
              const newMaterial = {
                id: Date.now().toString(),
                name: fileName || 'Reference Material',
                content: content
              };
              setReferenceMaterials(prev => [...prev, newMaterial]);
            }}
            colorScheme="green"
          />
          
          {/* Show uploaded reference materials with view option */}
          {referenceMaterials.length > 0 && (
            <div className="mt-3 space-y-2">
              {referenceMaterials.map((material) => (
                <div key={material.id} className="flex items-center justify-between p-2 bg-white border border-green-300 rounded">
                  <span className="text-sm text-green-800 truncate flex-1">{material.name}</span>
                  <div className="flex items-center space-x-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <Eye className="h-3 w-3" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{material.name}</DialogTitle>
                        </DialogHeader>
                        <div className="text-sm bg-gray-50 p-4 rounded whitespace-pre-wrap">
                          {material.content}
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0 text-red-500"
                      onClick={() => setReferenceMaterials(prev => prev.filter(m => m.id !== material.id))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="relative">
          {showMathView ? (
            <div className="min-h-[256px] border rounded-md">
              <MathView 
                text={value} 
                title="Assignment Prompt"
              />
              {value.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange('')}
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
                id="assignment-prompt"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    // Focus on student submission box
                    const studentTextarea = document.getElementById('student-text');
                    if (studentTextarea) {
                      studentTextarea.focus();
                    }
                  }
                }}
                placeholder="Type or paste assignment prompt here... (Ctrl+Enter to move to next field)"
                className="min-h-[256px] resize-y"
              />
              {value.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange('')}
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
        
        {/* Action buttons */}
        <div className="flex gap-2 mt-2">
          {value.length > 0 && (
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={formatMathNotation}
                disabled={isFormattingMath}
                className="flex-1 text-blue-600 border-blue-300 hover:bg-blue-50"
              >
                <Wand2 className="h-4 w-4 mr-1" />
                {isFormattingMath ? 'Formatting...' : 'Format Math'}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onChange('')}
                className="flex-1 text-gray-500 border-gray-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AssignmentPromptBox;
