// email-service.ts
interface EmailRequest {
  fromEmail?: string;
  toEmail: string;
  subject: string;
  message: string;
}

interface EmailResponse {
  success: boolean;
  error?: string;
}

export async function sendEmail(request: EmailRequest): Promise<EmailResponse> {
  try {
    // First clean any markdown formatting from the message to ensure it renders properly
    let cleanedMessage = request.message;
    
    // Remove markdown headings
    cleanedMessage = cleanedMessage.replace(/^#+\s+/gm, '');
    
    // Remove markdown emphasis (bold, italics)
    cleanedMessage = cleanedMessage.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold
    cleanedMessage = cleanedMessage.replace(/\*(.*?)\*/g, '$1');     // Italics
    cleanedMessage = cleanedMessage.replace(/__(.*?)__/g, '$1');     // Bold with underscore
    cleanedMessage = cleanedMessage.replace(/_(.*?)_/g, '$1');       // Italics with underscore
    
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: request.toEmail,
        subject: request.subject,
        content: cleanedMessage
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send email');
    }
    
    console.log('Email sent successfully');
    return { success: true };
  } catch (error) {
    console.error('Error sending email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
