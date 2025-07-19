import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Upload, FileText, File, Image } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AssignmentAttachment } from "@shared/schema";

interface AssignmentAttachmentsProps {
  assignmentId: number;
}

export default function AssignmentAttachments({ assignmentId }: AssignmentAttachmentsProps) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing attachments
  const { data: attachments = [], isLoading } = useQuery<AssignmentAttachment[]>({
    queryKey: ['/api/assignments', assignmentId, 'attachments'],
    enabled: !!assignmentId,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/assignments/${assignmentId}/attachments`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "File Uploaded",
        description: "Reference material has been successfully uploaded and processed.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/assignments', assignmentId, 'attachments'] });
      setIsUploading(false);
      setUploadProgress(0);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsUploading(false);
      setUploadProgress(0);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (attachmentId: number) => {
      const response = await fetch(`/api/attachments/${attachmentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete attachment');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "File Deleted",
        description: "Reference material has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/assignments', assignmentId, 'attachments'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (200MB limit)
    if (file.size > 200 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select a file smaller than 200MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    uploadMutation.mutate(file);
  };

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <File className="h-4 w-4" />;
    
    if (mimeType.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    } else if (mimeType === 'application/pdf') {
      return <FileText className="h-4 w-4" />;
    } else {
      return <File className="h-4 w-4" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className="border-t-4 border-green-500">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Upload className="h-5 w-5 mr-2 text-green-600" />
          Reference Materials
        </CardTitle>
        <p className="text-sm text-gray-600">
          Upload textbooks, articles, or other materials needed for this assignment
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Upload Section */}
        <div>
          <Label htmlFor="reference-upload" className="block mb-2">
            Upload Reference Material
          </Label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Upload PDF, DOC, DOCX, TXT, or image files (up to 200MB)
              </p>
              <input
                id="reference-upload"
                type="file"
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('reference-upload')?.click()}
                disabled={isUploading}
              >
                {isUploading ? 'Processing...' : 'Choose File'}
              </Button>
            </div>
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Uploading and processing...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}
        </div>

        {/* Existing Attachments */}
        {isLoading ? (
          <div className="text-center py-4 text-gray-500">Loading attachments...</div>
        ) : attachments.length > 0 ? (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Uploaded Materials</h4>
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  {getFileIcon(attachment.mimeType)}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {attachment.originalName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(attachment.fileSize)} • {attachment.uploadedAt ? new Date(attachment.uploadedAt as unknown as string).toLocaleDateString() : 'Unknown date'}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMutation.mutate(attachment.id)}
                  disabled={deleteMutation.isPending}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            No reference materials uploaded yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}