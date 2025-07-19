import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PlusCircle, Save, RefreshCw, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Assignment {
  id: number;
  title: string;
  prompt: string;
  gradingInstructions: string;
}

interface AssignmentSelectorProps {
  assignmentText: string;
  gradingText: string;
  onAssignmentChange: (assignment: { prompt: string; gradingInstructions: string }) => void;
  onAssignmentSelect?: (assignmentId: number | null) => void;
}

export default function AssignmentSelector({ 
  assignmentText, 
  gradingText, 
  onAssignmentChange,
  onAssignmentSelect
}: AssignmentSelectorProps) {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Fetch assignments on component mount
  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Fetching assignments...');
      const response = await fetch('/api/assignments');
      
      console.log('Assignments response status:', response.status);
      
      if (!response.ok) {
        throw new Error('Failed to fetch assignments');
      }
      
      const data = await response.json();
      console.log('Assignments fetched successfully:', data);
      setAssignments(data);
    } catch (err) {
      console.error('Error fetching assignments:', err);
      setError('Failed to load assignments. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignmentSelect = async (id: string) => {
    if (id === "") {
      return;
    }
    
    console.log(`Selected assignment ID: ${id}`);
    setSelectedAssignmentId(id);
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching assignment details for ID: ${id}`);
      const response = await fetch(`/api/assignments/${id}`);
      
      console.log(`Assignment details response status: ${response.status}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch assignment details');
      }
      
      const assignment = await response.json();
      console.log('Assignment details fetched successfully:', assignment);
      
      onAssignmentChange({
        prompt: assignment.prompt,
        gradingInstructions: assignment.gradingInstructions
      });
      
      // Notify parent that an assignment is selected for editing
      if (onAssignmentSelect) {
        onAssignmentSelect(parseInt(id));
      }
    } catch (err) {
      console.error('Error fetching assignment details:', err);
      setError('Failed to load assignment details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAssignment = async () => {
    if (!selectedAssignmentId) {
      return;
    }
    
    const assignment = assignments.find(a => a.id === parseInt(selectedAssignmentId));
    if (!assignment) {
      return;
    }
    
    const confirmed = confirm(`Are you sure you want to delete "${assignment.title}"?`);
    if (!confirmed) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/assignments/${selectedAssignmentId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete assignment');
      }
      
      // Remove from local state
      setAssignments(assignments.filter(a => a.id !== parseInt(selectedAssignmentId)));
      setSelectedAssignmentId("");
      
      // Clear the form
      onAssignmentChange({
        prompt: "",
        gradingInstructions: ""
      });
      
      if (onAssignmentSelect) {
        onAssignmentSelect(null);
      }
      
      // Refresh the main assignments list cache
      const event = new CustomEvent('assignmentSaved');
      window.dispatchEvent(event);
      
      toast({
        title: "Assignment Deleted",
        description: `"${assignment.title}" has been deleted successfully.`,
      });
    } catch (err) {
      console.error('Error deleting assignment:', err);
      setError('Failed to delete assignment. Please try again.');
      toast({
        title: "Error",
        description: "Failed to delete assignment.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAssignment = async () => {
    if (!newTitle.trim()) {
      setSaveError('Please enter a title for the assignment');
      return;
    }
    
    if (!assignmentText.trim()) {
      setSaveError('Assignment prompt cannot be empty');
      return;
    }
    
    setIsSaving(true);
    setSaveError(null);
    
    try {
      // Use the user we just created with ID 1
      const userId = 1;
      
      // Create the payload with default grading instructions if empty
      const payload = {
        userId,
        title: newTitle,
        prompt: assignmentText,
        gradingInstructions: gradingText.trim() || "Follow the assignment prompt closely and provide thoughtful analysis with clear reasoning.",
      };
      console.log('Saving assignment with payload:', payload);
      
      // Make the API request
      const response = await fetch('/api/assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      // Log the response for debugging
      console.log('Save assignment response status:', response.status);
      
      // Handle error response
      if (!response.ok) {
        let errorMessage = 'Failed to save assignment';
        try {
          const errorData = await response.json();
          console.error('Error response from server:', errorData);
          errorMessage = errorData.message || errorMessage;
        } catch (jsonError) {
          console.error('Error parsing error response:', jsonError);
        }
        throw new Error(errorMessage);
      }
      
      const savedAssignment = await response.json();
      
      // Update assignments list
      setAssignments([...assignments, savedAssignment]);
      setSelectedAssignmentId(String(savedAssignment.id));
      
      // Refresh the main assignments list cache
      const event = new CustomEvent('assignmentSaved', { detail: savedAssignment });
      window.dispatchEvent(event);
      
      // Close dialog
      setIsSaveDialogOpen(false);
      setNewTitle("");
    } catch (err) {
      console.error('Error saving assignment:', err);
      setSaveError('Failed to save assignment. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Select
            value={selectedAssignmentId}
            onValueChange={handleAssignmentSelect}
            disabled={isLoading}
          >
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select an assignment" />
            </SelectTrigger>
            <SelectContent>
              {assignments.map((assignment) => (
                <SelectItem key={assignment.id} value={String(assignment.id)}>
                  {assignment.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="icon" 
            onClick={fetchAssignments}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          
          {selectedAssignmentId && (
            <Button
              variant="outline"
              size="icon"
              onClick={handleDeleteAssignment}
              disabled={isLoading}
              className="text-red-600 hover:text-red-800 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <Button
          onClick={() => setIsSaveDialogOpen(true)}
          disabled={!assignmentText.trim()}
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          Save Assignment
        </Button>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Assignment</DialogTitle>
            <DialogDescription>
              Save the current assignment prompt and grading instructions for reuse.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Assignment Title</Label>
              <Input
                id="title"
                placeholder="Enter a title for this assignment"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            
            {saveError && (
              <Alert variant="destructive">
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAssignment} disabled={isSaving}>
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
