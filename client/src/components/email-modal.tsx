import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { sendEmail } from '@/lib/email-service';
import { useToast } from '@/hooks/use-toast';

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  gradingResult: string;
}

const EmailModal: React.FC<EmailModalProps> = ({ isOpen, onClose, gradingResult }) => {
  // Auto-fill email from localStorage
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState('Your Assignment Feedback');
  const [message, setMessage] = useState(
    'Here is your graded assignment with feedback. Please review the comments and let me know if you have any questions.'
  );
  const [includeDetailedFeedback, setIncludeDetailedFeedback] = useState(true);
  const [isSending, setIsSending] = useState(false);
  
  const { toast } = useToast();

  // Load saved email on component mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('savedEmail');
    if (savedEmail) {
      setToEmail(savedEmail);
    }
  }, [isOpen]);

  // Save email when it changes
  const handleEmailChange = (value: string) => {
    setToEmail(value);
    if (value) {
      localStorage.setItem('savedEmail', value);
    }
  };
  
  const handleSubmit = async () => {
    if (!toEmail) {
      toast({
        title: "Missing information",
        description: "Please fill in the recipient email address",
        variant: "destructive"
      });
      return;
    }
    
    setIsSending(true);
    
    try {
      // Construct the email content with or without the detailed feedback
      const emailContent = includeDetailedFeedback 
        ? `${message}\n\n${gradingResult}` 
        : message;
      
      // Send the email using the updated service
      const result = await sendEmail({
        toEmail,
        subject,
        message: emailContent
      });
      
      if (result.success) {
        toast({
          title: "Email sent",
          description: "The feedback has been emailed successfully",
        });
        onClose();
      } else {
        throw new Error(result.error || 'Failed to send email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: "Failed to send email",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Email Grading Results</DialogTitle>
          <DialogDescription>
            Send the grading results to the student using the verified sender email
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="to-email">To (Student Email)</Label>
            <Input
              id="to-email"
              type="email"
              value={toEmail}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="student@university.edu"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="h-24"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="include-feedback" 
              checked={includeDetailedFeedback} 
              onCheckedChange={(checked) => setIncludeDetailedFeedback(checked === true)}
            />
            <Label htmlFor="include-feedback">Include detailed feedback</Label>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSending}>
            {isSending ? 'Sending...' : 'Send Email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EmailModal;
