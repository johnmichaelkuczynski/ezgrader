import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface GradingFeedbackBoxProps {
  onSubmitFeedback: (feedback: string, gradeAdjustment: 'higher' | 'lower' | 'same' | 'comments_only', applyToFuture: boolean) => void;
  currentGrade?: string;
}

const GradingFeedbackBox: React.FC<GradingFeedbackBoxProps> = ({ 
  onSubmitFeedback, 
  currentGrade = '' 
}) => {
  const [feedback, setFeedback] = useState<string>('');
  const [gradeAdjustment, setGradeAdjustment] = useState<'higher' | 'lower' | 'same' | 'comments_only'>('comments_only');
  const [applyToFuture, setApplyToFuture] = useState<boolean>(true);

  const handleSubmit = () => {
    if (feedback.trim().length === 0) {
      alert('Please enter feedback on how the grading should be improved');
      return;
    }
    onSubmitFeedback(feedback, gradeAdjustment, applyToFuture);
    // Don't clear feedback here - wait for confirmation it was applied
  };

  return (
    <Card className="border-t-4 border-orange-500">
      <div className="p-4 bg-orange-100">
        <h2 className="text-xl font-semibold flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Professor Feedback & Grading Adjustment
        </h2>
        <p className="text-sm text-gray-600 mt-1">Your feedback will generate new comments and a revised grade</p>
      </div>
      
      <CardContent className="p-4">
        <div className="space-y-4">
          <div>
            <Label className="font-medium mb-2 block">Grade Adjustment</Label>
            <RadioGroup
              value={gradeAdjustment}
              onValueChange={(value) => setGradeAdjustment(value as 'higher' | 'lower' | 'same' | 'comments_only')}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="comments_only" id="comments-only" />
                <Label htmlFor="comments-only" className="cursor-pointer font-normal">Re-evaluate completely</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="higher" id="grade-higher" />
                <Label htmlFor="grade-higher" className="cursor-pointer font-normal">Grade should be higher</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="lower" id="grade-lower" />
                <Label htmlFor="grade-lower" className="cursor-pointer font-normal">Grade should be lower</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="same" id="grade-same" />
                <Label htmlFor="grade-same" className="cursor-pointer font-normal">Grade is appropriate</Label>
              </div>
            </RadioGroup>

            {currentGrade && (
              <p className="mt-2 text-sm text-gray-500">
                Current grade: <span className="font-medium">{currentGrade}</span>
              </p>
            )}
          </div>
          
          <div>
            <Label htmlFor="feedback-text" className="font-medium mb-1 block">Instructor Feedback</Label>
            <Textarea
              id="feedback-text"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Explain what's wrong with the current evaluation and how it should be improved. If you've selected 'Re-evaluate completely', the AI will reconsider both the grade and comments based on your feedback."
              className="min-h-[200px] text-base"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="apply-future" 
              checked={applyToFuture}
              onCheckedChange={(checked) => setApplyToFuture(checked as boolean)}
            />
            <Label htmlFor="apply-future" className="text-sm">
              Apply to future submissions in this assignment set
            </Label>
          </div>
          
          <Button
            onClick={handleSubmit}
            className="w-full bg-[#FF7A00] hover:bg-[#ED7000] font-bold text-white shadow-md py-3"
          >
            REGENERATE FEEDBACK & GRADE
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default GradingFeedbackBox;
