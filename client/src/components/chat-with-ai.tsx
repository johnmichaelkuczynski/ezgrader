import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, ArrowUp, Copy, Bot, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { GraphGenerator, type GraphData } from './graph-generator';
import PDFExport from './pdf-export';


interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  graphs?: GraphData[];
}

interface ChatWithAIProps {
  assignmentText: string;
  gradingText: string;
  studentText: string;
  resultText: string;
  onSendToAssignment: (text: string) => void;
  onSendToStudent: (text: string) => void;
  onSendToGrading: (text: string) => void;
  onSendToPerfectGenerator?: (text: string) => void;
  onSendToHumanizer?: (text: string) => void;
}

const ChatWithAI: React.FC<ChatWithAIProps> = ({
  assignmentText,
  gradingText,
  studentText,
  resultText,
  onSendToAssignment,
  onSendToStudent,
  onSendToGrading,
  onSendToPerfectGenerator,
  onSendToHumanizer
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const contextContent = `
Assignment Prompt: ${assignmentText || 'Not provided'}
Grading Instructions: ${gradingText || 'Not provided'}
Student Submission: ${studentText || 'Not provided'}
Results: ${resultText || 'Not provided'}
      `.trim();

      const response = await fetch('/api/chat-with-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputText,
          context: contextContent,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Check if response contains graph requests and generate them
      let graphs: GraphData[] = [];
      if (data.response) {
        const graphMatches = data.response.match(/\[GRAPH:(.*?)\]/g);
        if (graphMatches) {
          console.log('Found graph requests:', graphMatches);
          for (const match of graphMatches) {
            try {
              const description = match.replace(/\[GRAPH:(.*?)\]/, '$1');
              console.log('Generating graph for:', description);
              const graphResponse = await fetch('/api/generate-graph', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  description: description.trim(),
                  context: contextContent
                }),
              });

              if (graphResponse.ok) {
                const graphData = await graphResponse.json();
                console.log('Generated graph:', graphData);
                graphs.push(graphData);
              } else {
                console.error('Graph generation failed:', await graphResponse.text());
              }
            } catch (error) {
              console.error('Error generating graph:', error);
            }
          }
        }
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'I apologize, but I couldn\'t generate a response.',
        timestamp: new Date(),
        graphs: graphs.length > 0 ? graphs : undefined,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Card className="border-t-4 border-green-500">
      <CardHeader 
        className="cursor-pointer bg-green-50 hover:bg-green-100 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <MessageCircle className="h-6 w-6 mr-2 text-green-600" />
            Chat with AI
            <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800">
              Context Aware
            </Badge>
          </div>
          <Button variant="ghost" size="sm">
            {isExpanded ? 'Collapse' : 'Expand'}
          </Button>
        </CardTitle>
        <p className="text-sm text-gray-600">
          Chat with AI about anything. I'm aware of your assignment, grading instructions, and submissions above.
        </p>
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-4">
          {/* Chat Messages */}
          <ScrollArea 
            ref={scrollAreaRef}
            className="h-96 w-full border rounded-lg p-4 mb-4 bg-gray-50"
          >
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-20">
                <Bot className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>Start a conversation! I can help you with:</p>
                <ul className="text-sm mt-2 space-y-1">
                  <li>• Creating assignments and exam questions</li>
                  <li>• Analyzing student submissions</li>
                  <li>• Improving grading criteria</li>
                  <li>• General academic discussions</li>
                </ul>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white border shadow-sm'
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        {message.role === 'assistant' && (
                          <Bot className="h-4 w-4 mt-1 text-green-600" />
                        )}
                        {message.role === 'user' && (
                          <User className="h-4 w-4 mt-1 text-blue-100" />
                        )}
                        <div className="flex-1">
                          <div className="whitespace-pre-wrap text-sm">
                            {message.content.replace(/\[GRAPH:.*?\]/g, '')}
                          </div>
                          
                          {/* Render graphs */}
                          {message.graphs && message.graphs.length > 0 && (
                            <div className="mt-4 space-y-4">
                              {message.graphs.map((graph, index) => (
                                <div key={index} className="border rounded-lg p-2 bg-gray-50">
                                  <GraphGenerator graphData={graph} />
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <span className={`text-xs ${
                              message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                            }`}>
                              {message.timestamp.toLocaleTimeString()}
                            </span>
                            {message.role === 'assistant' && (
                              <div className="flex space-x-1">
                                <PDFExport 
                                  content={message.content}
                                  title={`Chat Response - ${message.timestamp.toLocaleDateString()}`}
                                  fileName={`chat-response-${message.id}`}
                                  className="scale-75"
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => onSendToPerfectGenerator?.(message.content)}
                                  title="Send to Perfect Assignment Generator"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                  </svg>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => copyToClipboard(message.content)}
                                  title="Copy to clipboard"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-blue-600"
                                  onClick={() => onSendToAssignment(message.content)}
                                  title="Send to Assignment Box"
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-purple-600"
                                  onClick={() => onSendToStudent(message.content)}
                                  title="Send to Student Submission Box"
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-orange-600"
                                  onClick={() => onSendToGrading(message.content)}
                                  title="Send to Grading Instructions Box"
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </Button>
                                {onSendToPerfectGenerator && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-green-600"
                                    onClick={() => onSendToPerfectGenerator(message.content)}
                                    title="Send to Perfect Assignment Generator"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                  </Button>
                                )}
                                {onSendToHumanizer && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-red-600"
                                    onClick={() => onSendToHumanizer(message.content)}
                                    title="Send to AI Text Rewriter (Humanizer)"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border shadow-sm rounded-lg p-3 max-w-[80%]">
                  <div className="flex items-center space-x-2">
                    <Bot className="h-4 w-4 text-green-600" />
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>

          {/* Input Area */}
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything... I can see your assignment content above."
                className="min-h-[60px] max-h-[200px] resize-none pr-12"
                disabled={isLoading}
              />

            </div>
            <Button
              onClick={sendMessage}
              disabled={!inputText.trim() || isLoading}
              className="bg-green-600 hover:bg-green-700 px-4"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Context Info */}
          <div className="mt-2 text-xs text-gray-500 bg-gray-100 p-2 rounded">
            <strong>Context available:</strong>
            {assignmentText && " Assignment Prompt"}
            {gradingText && " • Grading Instructions"}
            {studentText && " • Student Submission"}
            {resultText && " • Grading Results"}
            {!assignmentText && !gradingText && !studentText && !resultText && " None (you can still chat!)"}
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default ChatWithAI;