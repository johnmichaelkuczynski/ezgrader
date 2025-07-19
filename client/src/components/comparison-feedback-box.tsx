import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';

interface ComparisonFeedbackBoxProps {
  currentComparison: any; // The current comparison results
  onSubmitFeedback: (
    feedback: string, 
    gradeAdjustment: 'higher' | 'lower' | 'same' | 'comments_only',
    applyToFuture: boolean
  ) => void;
  isProcessing?: boolean;
}

const ComparisonFeedbackBox: React.FC<ComparisonFeedbackBoxProps> = ({
  currentComparison,
  onSubmitFeedback,
  isProcessing = false
}) => {
  const [professorFeedback, setProfessorFeedback] = useState('');
  const [gradeAdjustment, setGradeAdjustment] = useState<'higher' | 'lower' | 'same' | 'comments_only'>('comments_only');
  const [applyToFuture, setApplyToFuture] = useState(false);
  // Use local state for UI feedback while clicking the button
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Combined processing state (either from parent or local)
  const isProcessingFeedback = isProcessing || isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!professorFeedback.trim()) {
      alert('Please provide your feedback before submitting.');
      return;
    }
    
    if (isProcessingFeedback) {
      return; // Prevent multiple submissions
    }
    
    setIsSubmitting(true);
    
    try {
      onSubmitFeedback(professorFeedback, gradeAdjustment, applyToFuture);
      // Note: We don't reset isSubmitting here because the parent component will handle the loading state
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
      setIsSubmitting(false); // Only reset local state if there's an error
    }
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
        <p className="text-sm text-gray-600 mt-1">Your feedback will generate new comments and revised grades</p>
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
                <RadioGroupItem value="comments_only" id="compare-comments-only" />
                <Label htmlFor="compare-comments-only" className="cursor-pointer font-normal">Re-evaluate both submissions completely</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="higher" id="compare-grade-higher" />
                <Label htmlFor="compare-grade-higher" className="cursor-pointer font-normal">One or both grades should be higher (specify in comments)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="lower" id="compare-grade-lower" />
                <Label htmlFor="compare-grade-lower" className="cursor-pointer font-normal">One or both grades should be lower (specify in comments)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="same" id="compare-grade-appropriate" />
                <Label htmlFor="compare-grade-appropriate" className="cursor-pointer font-normal">Grades are appropriate but improve comments</Label>
              </div>
            </RadioGroup>
          </div>
          
          <div>
            <Label htmlFor="compare-professor-feedback" className="font-medium mb-2 block">Instructor Feedback</Label>
            <Textarea
              id="compare-professor-feedback"
              placeholder="Explain what's wrong with the current evaluation and how it should be improved. For grade adjustments, be specific about which student's grade needs adjustment (e.g., 'Student 1's grade should be higher because...'). If you've selected to re-evaluate both submissions, the AI will reconsider all grades and comments."
              className="min-h-32"
              value={professorFeedback}
              onChange={(e) => setProfessorFeedback(e.target.value)}
            />
          </div>
          
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox 
              id="compare-apply-to-future" 
              checked={applyToFuture}
              onCheckedChange={(checked) => setApplyToFuture(checked === true)}
            />
            <Label 
              htmlFor="compare-apply-to-future"
              className="text-sm font-normal cursor-pointer"
            >
              Apply to future submissions in this assignment set
            </Label>
          </div>
          
          <Button 
            type="button" 
            className="w-full bg-orange-500 hover:bg-orange-600"
            onClick={handleSubmit}
            disabled={isProcessingFeedback || !professorFeedback.trim()}
          >
            {isProcessingFeedback ? (
              <>
                <span className="animate-spin mr-2">⟳</span>
                Processing...
              </>
            ) : (
              'REGENERATE FEEDBACK & GRADES'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ComparisonFeedbackBox;