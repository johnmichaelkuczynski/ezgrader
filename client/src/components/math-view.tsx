import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, Code, BarChart3, Bot } from 'lucide-react';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import PDFExport from './pdf-export';

interface MathViewProps {
  text: string;
  title?: string;
  showAiDetection?: boolean;
  aiDetectionResult?: {
    probability: number;
    isAI: boolean;
  } | null;
}

export function MathView({ text, title = "Content", showAiDetection = false, aiDetectionResult }: MathViewProps) {
  const [activeView, setActiveView] = useState<'normal' | 'math'>('normal');
  
  // Calculate word count
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  
  // Detect potential LaTeX expressions including common patterns
  const hasLaTeX = /\$.*?\$|\\\[.*?\\\]|\\\(.*?\\\)|\\begin\{.*?\}.*?\\end\{.*?\}|\\[a-zA-Z]+\{.*?\}|\\rightarrow|\\therefore|\\forall|\\exists|\\land|\\lor|\\neg|\\to|\\iff|\\subset|\\supset|\\in|\\notin|\\cap|\\cup|\\emptyset|\\mathbb|\\mathcal|\\textbf|\\textit|\\emph|P\(|Q\(|R\(|S\(|F\(|logical|quantifier|predicate|formula|axiom|theorem|proof|inference|semantics|syntax/.test(text);
  
  // Process text for math rendering
  const processedText = useMemo(() => {
    let processed = text;
    
    // Handle inline math with $ delimiters
    processed = processed.replace(/\$([^$]+)\$/g, (match, mathContent) => {
      try {
        return katex.renderToString(mathContent, { displayMode: false });
      } catch (e) {
        return match; // Return original if KaTeX fails
      }
    });
    
    // Handle display math with $$ delimiters
    processed = processed.replace(/\$\$([^$]+)\$\$/g, (match, mathContent) => {
      try {
        return katex.renderToString(mathContent, { displayMode: true });
      } catch (e) {
        return match; // Return original if KaTeX fails
      }
    });
    
    // Handle LaTeX \[ \] delimiters
    processed = processed.replace(/\\\[([^\]]+)\\\]/g, (match, mathContent) => {
      try {
        return katex.renderToString(mathContent, { displayMode: true });
      } catch (e) {
        return match; // Return original if KaTeX fails
      }
    });
    
    // Handle LaTeX \( \) delimiters
    processed = processed.replace(/\\\(([^)]+)\\\)/g, (match, mathContent) => {
      try {
        return katex.renderToString(mathContent, { displayMode: false });
      } catch (e) {
        return match; // Return original if KaTeX fails
      }
    });
    
    // Convert newlines to HTML breaks for proper rendering
    processed = processed.replace(/\n/g, '<br>');
    
    return processed;
  }, [text]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            {hasLaTeX && (
              <Badge variant="secondary" className="text-xs">
                <Code className="w-3 h-3 mr-1" />
                Math Content
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              <BarChart3 className="w-3 h-3 mr-1" />
              {wordCount} words
            </Badge>
            {showAiDetection && aiDetectionResult && (
              <Badge 
                variant={aiDetectionResult.isAI ? "destructive" : "default"} 
                className="text-xs"
              >
                <Bot className="w-3 h-3 mr-1" />
                {aiDetectionResult.probability}% {aiDetectionResult.isAI ? 'AI' : 'Human-like'}
              </Badge>
            )}
            <PDFExport 
              content={text}
              title={title}
              fileName={title.toLowerCase().replace(/\s+/g, '-')}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={hasLaTeX ? activeView : 'normal'} onValueChange={(value) => setActiveView(value as 'normal' | 'math')}>
          {hasLaTeX && (
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="normal" className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Normal View
              </TabsTrigger>
              <TabsTrigger value="math" className="flex items-center gap-2">
                <Code className="w-4 h-4" />
                Math View
              </TabsTrigger>
            </TabsList>
          )}
          
          <TabsContent value="normal" className="mt-0">
            <div className="max-h-64 overflow-y-auto bg-gray-50 border rounded-lg p-4">
              <div className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                {text}
              </div>
            </div>
          </TabsContent>
          
          {hasLaTeX && (
            <TabsContent value="math" className="mt-0">
              <div className="max-h-64 overflow-y-auto bg-white border rounded-lg p-4">
                <div 
                  className="text-sm text-gray-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: processedText }}
                />
              </div>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}