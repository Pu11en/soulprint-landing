"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { Thread } from "./components/thread";
import "./liquid-glass.css";

export function AssistantChat() {
  const runtime = useChatRuntime();

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="chat-container">
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
}
