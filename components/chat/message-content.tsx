'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { CodeBlock } from './code-block';

interface MessageContentProps {
  content: string;
  isUser?: boolean;
}

export function MessageContent({ content, isUser }: MessageContentProps) {
  // User messages render as plain text (no markdown processing)
  if (isUser) {
    return (
      <div
        className="text-sm leading-relaxed break-words overflow-hidden whitespace-pre-wrap"
        style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
      >
        {content}
      </div>
    );
  }

  // AI messages render with full markdown support
  return (
    <div
      className="text-sm leading-relaxed break-words overflow-hidden prose prose-sm dark:prose-invert max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1"
      style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          // Code blocks with syntax highlighting
          code(props) {
            const { node, className, children, ...rest } = props;
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : 'text';
            const value = String(children).replace(/\n$/, '');
            const isInline = !match;

            if (!isInline && match) {
              // Fenced code block
              return <CodeBlock language={language!} value={value} />;
            }

            // Inline code
            return (
              <code
                className="bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono"
                {...rest}
              >
                {children}
              </code>
            );
          },

          // Links with XSS protection
          a(props) {
            const { node, href, children, ...rest } = props;
            // Block javascript: protocol links
            if (href?.startsWith('javascript:')) {
              return <>{children}</>;
            }

            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
                {...rest}
              >
                {children}
              </a>
            );
          },

          // Paragraphs with spacing
          p(props) {
            const { node, children, ...rest } = props;
            return (
              <p className="mb-2 last:mb-0" {...rest}>
                {children}
              </p>
            );
          },

          // Tables with styling and mobile scroll
          table(props) {
            const { node, children, ...rest } = props;
            return (
              <div className="overflow-x-auto my-2">
                <table className="border-collapse w-full" {...rest}>
                  {children}
                </table>
              </div>
            );
          },

          // Table headers
          th(props) {
            const { node, children, ...rest } = props;
            return (
              <th
                className="border border-border px-3 py-1 text-left bg-muted/50 text-sm font-semibold"
                {...rest}
              >
                {children}
              </th>
            );
          },

          // Table cells
          td(props) {
            const { node, children, ...rest } = props;
            return (
              <td className="border border-border px-3 py-1 text-sm" {...rest}>
                {children}
              </td>
            );
          },

          // Pre tags (let CodeBlock handle its own container)
          pre(props) {
            const { node, children, ...rest } = props;
            return <>{children}</>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
