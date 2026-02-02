"use client";

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, Send, Sparkles, ChevronRight, ChevronLeft, Plus } from "lucide-react";
import { theme } from "@/lib/theme";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  contexts?: ContextItem[];
}

interface ContextItem {
  id: string;
  text: string;
  source?: string;
}

interface CoLearningPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  palette: Record<number, string>;
}

export function CoLearningPanel({
  isOpen,
  onToggle,
  palette,
}: CoLearningPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [contexts, setContexts] = useState<ContextItem[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleAddContext = (e: CustomEvent<ContextItem>) => {
      setContexts((prev) => {
        if (prev.some((c) => c.text === e.detail.text)) return prev;
        return [...prev, e.detail];
      });
      if (!isOpen) onToggle();
    };

    window.addEventListener("colearning:addContext", handleAddContext as EventListener);
    return () => {
      window.removeEventListener("colearning:addContext", handleAddContext as EventListener);
    };
  }, [isOpen, onToggle]);

  const removeContext = (id: string) => {
    setContexts((prev) => prev.filter((c) => c.id !== id));
  };

  const clearContexts = () => setContexts([]);

  const startNewConversation = () => {
    setMessages([]);
    setContexts([]);
    setInput("");
  };

  const sendMessage = async () => {
    const messageText = input.trim();
    if (!messageText && contexts.length === 0) return;

    const currentContexts = [...contexts];
    const currentHistory = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: messageText,
      timestamp: new Date(),
      contexts: currentContexts.length > 0 ? currentContexts : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setContexts([]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          contexts: currentContexts.map((c) => ({ text: c.text, source: c.source })),
          history: currentHistory,
        }),
      });

      const data = await res.json();

      if (data.success) {
        const assistantMessage: Message = {
          id: `msg-${Date.now()}-assistant`,
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        throw new Error(data.error || "Failed to get response");
      }
    } catch (err) {
      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-0 top-1/2 -translate-y-1/2 p-2 rounded-l-lg shadow-lg z-40"
        style={{ backgroundColor: palette[500] }}
        title="Agent"
      >
        <ChevronLeft className="w-5 h-5 text-white" />
      </button>
    );
  }

  return (
    <div
      className="w-96 border-l flex flex-col h-full bg-white"
      style={{ borderColor: theme.border }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: theme.border }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" style={{ color: palette[500] }} />
          <h3 className="font-semibold">Agent</h3>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={startNewConversation}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title="New conversation"
            >
              <Plus className="w-4 h-4" style={{ color: theme.textMuted }} />
            </button>
          )}
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="w-4 h-4" style={{ color: theme.textMuted }} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && contexts.length === 0 && (
          <div className="text-center py-8">
            <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-20" />
            <p className="text-sm" style={{ color: theme.textMuted }}>
              Your second hand for the cognitive workspace.
            </p>
            <div className="mt-4 space-y-2">
              <p className="text-xs" style={{ color: theme.textMuted }}>Try asking:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {["What's this?", "Explain simply", "Organize my library"].map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="px-3 py-1.5 text-xs rounded-full border hover:bg-gray-50"
                    style={{ borderColor: theme.border }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                msg.role === "user" ? "rounded-br-md" : "rounded-bl-md"
              }`}
              style={{
                backgroundColor: msg.role === "user" ? palette[500] : "#f4f4f5",
                color: msg.role === "user" ? "white" : theme.text,
              }}
            >
              {/* Show contexts attached to this message */}
              {msg.contexts && msg.contexts.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5 pb-1.5 border-b border-white/20">
                  {msg.contexts.map((ctx) => (
                    <span
                      key={ctx.id}
                      className="text-xs px-1.5 py-0.5 rounded bg-white/20"
                    >
                      {ctx.text.slice(0, 25)}{ctx.text.length > 25 ? "..." : ""}
                    </span>
                  ))}
                </div>
              )}
              {msg.role === "assistant" ? (
                <div className="prose prose-xs prose-neutral prose-tight max-w-none text-[13px] leading-snug [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>p]:my-1.5 [&>ul]:my-1.5 [&>ol]:my-1.5 [&>li]:my-0.5">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-[13px] whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="text-[13px] text-gray-400 animate-pulse">
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area with context chips */}
      <div className="border-t" style={{ borderColor: theme.border }}>
        {/* Context chips */}
        {contexts.length > 0 && (
          <div className="px-3 pt-2 flex flex-wrap gap-1.5">
            {contexts.map((ctx) => (
              <div
                key={ctx.id}
                className="group flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                style={{ backgroundColor: `${palette[500]}15`, color: palette[700] }}
              >
                <span className="truncate max-w-[180px]" title={ctx.text}>
                  {ctx.text.slice(0, 30)}{ctx.text.length > 30 ? "..." : ""}
                </span>
                <button
                  onClick={() => removeContext(ctx.id)}
                  className="opacity-50 hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {/* Input */}
        <div className="flex items-end gap-2 p-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={contexts.length > 0 ? "Ask about context..." : "Ask anything..."}
            className="flex-1 resize-none text-sm outline-none max-h-32 bg-transparent"
            rows={1}
            style={{ color: theme.text }}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || (!input.trim() && contexts.length === 0)}
            className="p-1.5 rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: palette[500], color: "white" }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to trigger adding context to co-learning panel
 */
export function useCoLearning() {
  const addContext = (text: string, source?: string) => {
    const event = new CustomEvent("colearning:addContext", {
      detail: {
        id: `ctx-${Date.now()}`,
        text,
        source,
      },
    });
    window.dispatchEvent(event);
  };

  return { addContext };
}
