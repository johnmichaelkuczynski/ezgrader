import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";

interface ServiceStatusProps {
  className?: string;
}

interface ServiceStatus {
  openai: string;
  anthropic: string;
  perplexity: string;
  gptzero: string;
  sendgrid: string;
}

export default function ServiceStatus({ className }: ServiceStatusProps) {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check the services when the component mounts
  useEffect(() => {
    checkServices();
  }, []);

  // Function to check all API services
  const checkServices = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/check-services');
      
      if (!response.ok) {
        throw new Error(`Error checking services: ${response.status}`);
      }
      
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      console.error('Failed to check services:', err);
      setError('Failed to check services. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Function to render status icon
  const getStatusIcon = (serviceStatus: string) => {
    if (serviceStatus === 'working' || serviceStatus === 'configured') {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    } else {
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          API Services Status
          <Button 
            variant="outline" 
            size="sm" 
            onClick={checkServices} 
            disabled={loading}
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </>
            )}
          </Button>
        </CardTitle>
        <CardDescription>
          Status of the connected AI and email services
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {error ? (
          <div className="text-red-500 mb-4">{error}</div>
        ) : !status ? (
          <div className="text-gray-400 mb-4">Checking services...</div>
        ) : (
          <div className="grid gap-3">
            <div className="flex items-center justify-between py-2 border-b">
              <div className="font-medium">ZHI 1</div>
              <div className="flex items-center">
                {getStatusIcon(status.openai)}
                <span className="ml-2 text-sm">
                  {status.openai === 'working' ? 'Working' : status.openai}
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between py-2 border-b">
              <div className="font-medium">ZHI 2</div>
              <div className="flex items-center">
                {getStatusIcon(status.anthropic)}
                <span className="ml-2 text-sm">
                  {status.anthropic === 'working' ? 'Working' : status.anthropic}
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between py-2 border-b">
              <div className="font-medium">ZHI 4</div>
              <div className="flex items-center">
                {getStatusIcon(status.perplexity)}
                <span className="ml-2 text-sm">
                  {status.perplexity === 'working' ? 'Working' : status.perplexity}
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between py-2 border-b">
              <div className="font-medium">GPTZero</div>
              <div className="flex items-center">
                {getStatusIcon(status.gptzero)}
                <span className="ml-2 text-sm">
                  {status.gptzero === 'working' ? 'Working' : status.gptzero}
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div className="font-medium">SendGrid</div>
              <div className="flex items-center">
                {getStatusIcon(status.sendgrid)}
                <span className="ml-2 text-sm">
                  {status.sendgrid === 'configured' ? 'Configured' : status.sendgrid}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}