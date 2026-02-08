'use client';

import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from 'next-themes';

interface CodeBlockProps {
  language: string;
  value: string;
}

export function CodeBlock({ language, value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const { resolvedTheme } = useTheme();

  // Select theme based on resolved theme (actual applied theme)
  const syntaxTheme = resolvedTheme === 'dark' ? vscDarkPlus : vs;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div className="relative group my-4 rounded-lg overflow-hidden border border-border">
      {/* Header bar with language label and copy button */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border">
        <span className="text-xs text-muted-foreground font-mono">{language}</span>
        <button
          onClick={handleCopy}
          aria-label="Copy code"
          className="text-xs px-2 py-1 rounded bg-background/50 hover:bg-background border border-border/50 transition-colors opacity-70 hover:opacity-100 md:opacity-0 md:group-hover:opacity-100"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Syntax highlighter */}
      <SyntaxHighlighter
        language={language}
        style={syntaxTheme}
        customStyle={{
          margin: 0,
          fontSize: '0.875rem',
          padding: '1rem',
        }}
        showLineNumbers={false}
        wrapLongLines={true}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
}

export default CodeBlock;
