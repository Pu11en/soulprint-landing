import React from 'react';
import { cn } from '@/utils/cn';

interface ErrorProps {
  message?: string;
  variant?: 'inline' | 'card' | 'toast';
  className?: string;
  onRetry?: () => void;
  retryText?: string;
}

const Error: React.FC<ErrorProps> = ({ 
  message = 'Something went wrong', 
  variant = 'inline',
  className = '',
  onRetry,
  retryText = 'Try again'
}) => {
  const baseClasses = 'text-red-600';
  
  const variantClasses = {
    inline: 'text-sm',
    card: 'p-4 border border-red-200 rounded-md bg-red-50',
    toast: 'p-3 border border-red-200 rounded-md bg-red-50 shadow-md'
  };

  return (
    <div className={cn(baseClasses, variantClasses[variant], className)}>
      <div className="flex items-start">
        <svg
          className="h-5 w-5 flex-shrink-0 text-red-400"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
        <div className="ml-3 flex-1">
          <p className={cn(
            variant === 'inline' ? 'text-sm' : 'text-sm font-medium text-red-800'
          )}>
            {message}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 text-sm text-red-600 underline hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              {retryText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Error;