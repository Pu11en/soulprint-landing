'use client';

import React from 'react';

interface MessageContentProps {
  content: string;
  textColor: string;
}

export function MessageContent({ content, textColor }: MessageContentProps) {
  // Parse content for basic formatting
  const formatText = (text: string) => {
    // Split into paragraphs (double newline)
    const paragraphs = text.split(/\n\n+/);
    
    return paragraphs.map((paragraph, pIndex) => {
      // Check if it's a list item
      const lines = paragraph.split('\n');
      
      const formattedLines = lines.map((line, lIndex) => {
        // Handle bullet points
        if (line.match(/^[\-\•\*]\s/)) {
          return (
            <div key={lIndex} className="flex gap-2 pl-1">
              <span className="text-[#8E8E93]">•</span>
              <span>{formatInlineText(line.replace(/^[\-\•\*]\s/, ''))}</span>
            </div>
          );
        }
        
        // Handle numbered lists
        if (line.match(/^\d+[\.\)]\s/)) {
          const num = line.match(/^(\d+)[\.\)]\s/)?.[1];
          return (
            <div key={lIndex} className="flex gap-2 pl-1">
              <span className="text-[#8E8E93] min-w-[1.2em]">{num}.</span>
              <span>{formatInlineText(line.replace(/^\d+[\.\)]\s/, ''))}</span>
            </div>
          );
        }
        
        // Regular line
        return (
          <React.Fragment key={lIndex}>
            {formatInlineText(line)}
            {lIndex < lines.length - 1 && <br />}
          </React.Fragment>
        );
      });
      
      return (
        <div key={pIndex} className={pIndex > 0 ? 'mt-3' : ''}>
          {formattedLines}
        </div>
      );
    });
  };
  
  // Handle inline formatting (bold, italic, code)
  const formatInlineText = (text: string): React.ReactNode => {
    // Split by bold markers **text**
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    
    return parts.map((part, i) => {
      // Bold text
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      
      // Check for inline code `text`
      const codeParts = part.split(/(`[^`]+`)/g);
      return codeParts.map((codePart, j) => {
        if (codePart.startsWith('`') && codePart.endsWith('`')) {
          return (
            <code 
              key={`${i}-${j}`} 
              className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-[13px] font-mono"
            >
              {codePart.slice(1, -1)}
            </code>
          );
        }
        
        // Check for _italic_ or *italic*
        const italicParts = codePart.split(/(_[^_]+_|\*[^*]+\*)/g);
        return italicParts.map((italicPart, k) => {
          if ((italicPart.startsWith('_') && italicPart.endsWith('_')) ||
              (italicPart.startsWith('*') && italicPart.endsWith('*') && !italicPart.startsWith('**'))) {
            return (
              <em key={`${i}-${j}-${k}`} className="italic">
                {italicPart.slice(1, -1)}
              </em>
            );
          }
          return italicPart;
        });
      });
    });
  };

  return (
    <div 
      className="text-[14px] leading-[1.5] break-words overflow-hidden"
      style={{ color: textColor, wordBreak: 'break-word', overflowWrap: 'anywhere' }}
    >
      {formatText(content)}
    </div>
  );
}
