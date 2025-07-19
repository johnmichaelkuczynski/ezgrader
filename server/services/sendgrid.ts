import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  console.warn('SENDGRID_API_KEY environment variable is not set, email functionality will not work');
}

if (!process.env.SENDGRID_VERIFIED_SENDER) {
  console.warn('SENDGRID_VERIFIED_SENDER environment variable is not set, using default no-reply@example.com');
}

const mailService = new MailService();

// Initialize the service if the API key is provided
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

// Internal interface for SendGrid parameters
interface EmailParams {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

// Internal interface for MailService that includes "from" field
interface SendGridMailParams extends EmailParams {
  from: string;  // Verified sender email
}

/**
 * Send an email using SendGrid
 * @param params Email parameters including recipient, subject, and content
 * @returns True if email was sent successfully, false otherwise
 */
export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SendGrid API key is not configured');
    }

    const fromEmail = process.env.SENDGRID_VERIFIED_SENDER || 'no-reply@example.com';
    
    // Clean text content by removing markdown formatting if present
    let cleanText = params.text || '';
    cleanText = cleanMarkdownFormatting(cleanText);
    
    // Generate HTML version if only text is provided
    let htmlContent = params.html || '';
    if (!htmlContent && cleanText) {
      htmlContent = textToHtml(cleanText);
    }
    
    const mailParams: SendGridMailParams = {
      to: params.to,
      from: fromEmail,
      subject: params.subject,
      text: cleanText,
      html: htmlContent,
    };
    
    await mailService.send(mailParams);
    
    console.log(`Email sent successfully to ${params.to}`);
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

/**
 * Remove markdown formatting from text
 * @param text Text with potential markdown formatting
 * @returns Cleaned text without markdown symbols
 */
function cleanMarkdownFormatting(text: string): string {
  // Remove headers (# Header)
  let cleaned = text.replace(/^#{1,6}\s+/gm, '');
  
  // Remove bold/italic formatting
  cleaned = cleaned.replace(/(\*\*|__)(.*?)\1/g, '$2'); // Bold
  cleaned = cleaned.replace(/(\*|_)(.*?)\1/g, '$2');    // Italic
  
  // Remove code blocks
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
  
  // Remove blockquotes
  cleaned = cleaned.replace(/^>\s+/gm, '');
  
  // Remove horizontal rules
  cleaned = cleaned.replace(/^\s*(\*|-|_){3,}\s*$/gm, '');

  // Remove markdown links but keep the text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
  
  // Remove citation references like [1], [2], [3][4][5]
  cleaned = cleaned.replace(/\[\d+\]/g, '');         // Remove [1], [2], etc.
  cleaned = cleaned.replace(/\[\d+\]\[\d+\]/g, '');  // Remove [1][2], etc. when adjacent
  cleaned = cleaned.replace(/\[\d+\-\d+\]/g, '');    // Remove [1-3], etc.
  
  return cleaned;
}

/**
 * Convert plain text to HTML with proper formatting
 * @param text Plain text to convert
 * @returns HTML formatted version of the text
 */
function textToHtml(text: string): string {
  // Replace newlines with <br> tags
  let html = text.replace(/\n/g, '<br>');
  
  // Add basic HTML structure
  html = `
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            padding: 20px;
          }
          .header {
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          .footer {
            border-top: 1px solid #eee;
            padding-top: 10px;
            margin-top: 20px;
            font-size: 0.8em;
            color: #777;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>Assignment Grading Results</h2>
        </div>
        <div class="content">
          ${html}
        </div>
        <div class="footer">
          <p>This email was sent from the AI Grading Platform.</p>
        </div>
      </body>
    </html>
  `;
  
  return html;
}