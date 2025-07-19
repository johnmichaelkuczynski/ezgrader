import { useState } from 'react';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface StudentGrade {
  submissionId: number;
  studentName: string;
  assignmentId: number;
  assignmentTitle: string;
  grade: string | null;
  submissionDate: string;
  results: string;
}

interface StudentGradesTableProps {
  grades: StudentGrade[];
}

export default function StudentGradesTable({ grades }: StudentGradesTableProps) {
  const [selectedGrade, setSelectedGrade] = useState<StudentGrade | null>(null);
  
  if (!grades || grades.length === 0) {
    return (
      <div className="p-8 text-center border rounded-lg bg-gray-50">
        <h3 className="text-lg font-medium text-gray-700">No grades recorded yet</h3>
        <p className="mt-2 text-sm text-gray-500">
          Grade some student submissions to see them appear here.
        </p>
      </div>
    );
  }
  
  return (
    <div className="rounded-md border">
      <Table>
        <TableCaption>Student Grades & Feedback Records</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Student Name</TableHead>
            <TableHead>Assignment</TableHead>
            <TableHead>Grade</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grades.map((grade) => (
            <TableRow key={grade.submissionId}>
              <TableCell className="font-medium">{grade.studentName}</TableCell>
              <TableCell>{grade.assignmentTitle}</TableCell>
              <TableCell className="font-bold">{grade.grade || 'No Grade'}</TableCell>
              <TableCell>{new Date(grade.submissionDate).toLocaleDateString()}</TableCell>
              <TableCell>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedGrade(grade)}
                >
                  View Feedback
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {/* Feedback Viewer Dialog */}
      <Dialog open={!!selectedGrade} onOpenChange={(open) => !open && setSelectedGrade(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Feedback for {selectedGrade?.studentName}
              {selectedGrade?.grade && (
                <span className="ml-2 text-green-600">Grade: {selectedGrade.grade}</span>
              )}
            </DialogTitle>
            <DialogDescription>
              Assignment: {selectedGrade?.assignmentTitle}
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 p-4 border rounded bg-gray-50 whitespace-pre-wrap font-mono text-sm">
            {selectedGrade?.results}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
