import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import FileUpload from './file-upload';
import { MathView } from './math-view';

import { Wand2, Trash2 } from 'lucide-react';

interface GradingInstructionsBoxProps {
  value: string;
  onChange: (value: string) => void;
}

const GradingInstructionsBox: React.FC<GradingInstructionsBoxProps> = ({ value, onChange }) => {
  const [showMathView, setShowMathView] = useState(false);
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
    <Card className="border-t-4 border-orange">
      <div className="p-4 bg-amber-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Grading Instructions
            </h2>
            <p className="text-sm text-gray-600 mt-1">Upload or enter the grading criteria and rubric</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={formatMathNotation}
              disabled={isFormattingMath || !value.trim()}
              className="text-orange-600 border-orange-300 hover:bg-orange-50"
            >
              <Wand2 className="w-4 h-4 mr-1" />
              {isFormattingMath ? 'Formatting...' : 'Format Math'}
            </Button>
            <Label htmlFor="math-view-grading" className="text-sm">Math View</Label>
            <Switch
              id="math-view-grading"
              checked={showMathView}
              onCheckedChange={setShowMathView}
            />
          </div>
        </div>
      </div>
      
      <CardContent className="p-4">
        <FileUpload 
          id="grading-file" 
          className="mb-4" 
          onFileContent={onChange} 
          colorScheme="orange"
        />
        
        <div className="relative">
          {showMathView ? (
            <div className="min-h-[256px] border rounded-md">
              <MathView 
                text={value} 
                title="Grading Instructions"
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
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ) : (
            <>
              <Textarea
                id="grading-text"
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
                placeholder="Type or paste grading instructions here... (Ctrl+Enter to move to next field)"
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
                  <Trash2 className="h-3.5 w-3.5" />
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
            onClick={() => onChange('')}
            className="w-full mt-2 mb-2 text-gray-500 border-gray-300"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear Instructions
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default GradingInstructionsBox;
