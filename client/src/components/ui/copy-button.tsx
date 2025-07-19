import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { copyToClipboard } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface CopyButtonProps {
  text: string;
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  iconOnly?: boolean;
  label?: string;
}

export function CopyButton({
  text,
  className = '',
  size = 'sm',
  variant = 'outline',
  iconOnly = false,
  label = 'Copy'
}: CopyButtonProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    if (!text) return;

    const success = await copyToClipboard(text);
    
    if (success) {
      setIsCopied(true);
      // No toast notification - just silently copy to clipboard
      
      // Reset after 1.5 seconds
      setTimeout(() => {
        setIsCopied(false);
      }, 1500);
    } else {
      // Only show toast for actual errors
      toast({
        title: "Failed to copy",
        description: "Could not copy text to clipboard",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  return (
    <Button
      onClick={handleCopy}
      className={className}
      size={size}
      variant={variant}
      type="button"
    >
      {isCopied ? (
        <>
          {!iconOnly && <span>Copied!</span>}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 ${!iconOnly ? 'ml-2' : ''}`}>
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </>
      ) : (
        <>
          {!iconOnly && <span>{label}</span>}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 ${!iconOnly ? 'ml-2' : ''}`}>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        </>
      )}
    </Button>
  );
}