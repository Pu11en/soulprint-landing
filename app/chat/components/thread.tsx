"use client";

import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";
import { ArrowDown, Copy, Check, Send, Mic, RefreshCw, Menu, Plus } from "lucide-react";
import { useState, type FC } from "react";
import { cn } from "@/lib/utils";

export const Thread: FC = () => {
  return (
    <ThreadPrimitive.Root className="thread-root">
      {/* Header */}
      <header className="thread-header">
        <button className="header-btn">
          <Menu className="w-5 h-5" />
        </button>
        
        <div className="header-center">
          <div className="header-avatar">
            <img src="/logo.svg" alt="" className="header-avatar-img" />
          </div>
          <div className="header-info">
            <span className="header-name">SoulPrint</span>
            <span className="header-status">Online</span>
          </div>
        </div>

        <button className="header-btn primary">
          <Plus className="w-5 h-5" />
        </button>
      </header>

      {/* Messages */}
      <ThreadPrimitive.Viewport className="thread-viewport">
        <ThreadPrimitive.Empty>
          <ThreadWelcome />
        </ThreadPrimitive.Empty>

        <ThreadPrimitive.Messages
          components={{
            UserMessage,
            AssistantMessage,
          }}
        />

        <ThreadScrollToBottom />
      </ThreadPrimitive.Viewport>

      {/* Composer */}
      <Composer />
    </ThreadPrimitive.Root>
  );
};

const ThreadWelcome: FC = () => {
  return (
    <div className="welcome-container">
      <div className="welcome-avatar">
        <img src="/logo.svg" alt="SoulPrint" className="w-12 h-12" />
      </div>
      <h1 className="welcome-title">Hello!</h1>
      <p className="welcome-subtitle">How can I help you today?</p>
      
      <div className="welcome-suggestions">
        <ThreadPrimitive.Suggestion prompt="Tell me about yourself" autoSend>
          <span className="suggestion-btn">Tell me about yourself</span>
        </ThreadPrimitive.Suggestion>
        <ThreadPrimitive.Suggestion prompt="What can you help me with?" autoSend>
          <span className="suggestion-btn">What can you help me with?</span>
        </ThreadPrimitive.Suggestion>
        <ThreadPrimitive.Suggestion prompt="Let's brainstorm ideas" autoSend>
          <span className="suggestion-btn">Let's brainstorm ideas</span>
        </ThreadPrimitive.Suggestion>
      </div>
    </div>
  );
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom className="scroll-to-bottom">
      <ArrowDown className="w-5 h-5" />
    </ThreadPrimitive.ScrollToBottom>
  );
};

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="message-row user">
      <div className="message-bubble user">
        <MessagePrimitive.Content />
        <MessageActions />
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="message-row assistant">
      <div className="message-bubble assistant">
        <MessagePrimitive.Content />
        <MessageActions />
      </div>
    </MessagePrimitive.Root>
  );
};

const MessageActions: FC = () => {
  const [copied, setCopied] = useState(false);

  return (
    <ActionBarPrimitive.Root className="message-actions">
      <ActionBarPrimitive.Copy
        copiedDuration={2000}
        onClick={() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="action-btn"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </ActionBarPrimitive.Copy>
      
      <ActionBarPrimitive.Reload className="action-btn">
        <RefreshCw className="w-3.5 h-3.5" />
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
};

const Composer: FC = () => {
  return (
    <ComposerPrimitive.Root className="composer-root">
      <ComposerPrimitive.Input
        placeholder="Message..."
        className="composer-input"
        rows={1}
        autoFocus
      />
      
      <ComposerPrimitive.Send className="composer-send">
        <Send className="w-5 h-5" />
      </ComposerPrimitive.Send>
    </ComposerPrimitive.Root>
  );
};
