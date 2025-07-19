import React from 'react';

export function IconSparkles({ className = '' }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      className={className} 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M12 3l1.57 3.43 3.73.54-2.7 2.63.64 3.7-3.24-1.7-3.24 1.71.64-3.71-2.7-2.63 3.73-.54z"/>
      <path d="M19 8l.53 1.15 1.27.19-.92.89.22 1.26-1.1-.58-1.1.58.21-1.26-.91-.89 1.27-.19z"/>
      <path d="M5 17l.53 1.15 1.27.19-.92.89.22 1.26-1.1-.58-1.1.58.21-1.26-.91-.89 1.27-.19z"/>
    </svg>
  );
}
