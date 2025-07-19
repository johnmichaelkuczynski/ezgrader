// Mathpix OCR API integration for mathematical notation extraction
export interface MathpixResponse {
  text: string;
  latex_styled?: string;
  confidence?: number;
  confidence_rate?: number;
}

export async function extractMathWithMathpix(file: File): Promise<string> {
  try {
    console.log('Starting Mathpix OCR for:', file.name);
    
    // Convert file to base64
    const base64 = await fileToBase64(file);
    
    const response = await fetch('/api/mathpix-ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        src: base64,
        formats: ['text', 'latex_styled'],
        data_options: {
          include_asciimath: true,
          include_latex: true,
          include_mathml: false,
          include_table_html: true,
          include_tsv: false
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Mathpix API error: ${response.status}`);
    }

    const result: MathpixResponse = await response.json();
    
    if (!result.text) {
      throw new Error('No text extracted from document');
    }

    console.log('Mathpix OCR completed successfully');
    return result.text;
    
  } catch (error) {
    console.error('Mathpix OCR error:', error);
    throw new Error(`Failed to extract mathematical content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix to get just the base64 data
      const base64 = result.split(',')[1];
      resolve(`data:${file.type};base64,${base64}`);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}