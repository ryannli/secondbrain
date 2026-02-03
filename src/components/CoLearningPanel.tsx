"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, Send, Sparkles, ChevronRight, ChevronLeft, Plus, ChevronDown, Trash2, MessageSquare, Wrench } from "lucide-react";
import { theme } from "@/lib/theme";
import { AgentConversationSummary, AgentMessage, AgentContext } from "@/lib/types";

/**
 * Parse message content and separate text from tool calls
 * Tool calls are marked as [[TOOL:name]]
 */
function parseMessageContent(content: string): Array<{ type: "text" | "tools"; content: string; tools?: string[] }> {
  const segments: Array<{ type: "text" | "tools"; content: string; tools?: string[] }> = [];
  const toolPattern = /\[\[TOOL:(\w+)\]\]/g;

  let lastIndex = 0;
  let match;
  let pendingTools: string[] = [];

  while ((match = toolPattern.exec(content)) !== null) {
    // Add text before this tool (if any and not just whitespace)
    const textBefore = content.slice(lastIndex, match.index).trim();
    if (textBefore) {
      // If we have pending tools, flush them first
      if (pendingTools.length > 0) {
        segments.push({ type: "tools", content: "", tools: pendingTools });
        pendingTools = [];
      }
      segments.push({ type: "text", content: textBefore });
    }

    // Accumulate tool calls
    pendingTools.push(match[1]);
    lastIndex = match.index + match[0].length;
  }

  // Flush any remaining tools
  if (pendingTools.length > 0) {
    segments.push({ type: "tools", content: "", tools: pendingTools });
  }

  // Add remaining text after last tool
  const remainingText = content.slice(lastIndex).trim();
  if (remainingText) {
    segments.push({ type: "text", content: remainingText });
  }

  return segments;
}

/**
 * Collapsible tool calls section
 */
function ToolCallsSection({ tools, isStreaming }: { tools: string[]; isStreaming?: boolean }) {
  const [isOpen, setIsOpen] = useState(isStreaming);

  // Auto-expand while streaming
  useEffect(() => {
    if (isStreaming) setIsOpen(true);
  }, [isStreaming]);

  const uniqueTools = [...new Set(tools)];
  const summary = uniqueTools.length <= 2
    ? uniqueTools.join(", ")
    : `${uniqueTools.slice(0, 2).join(", ")} +${uniqueTools.length - 2} more`;

  return (
    <div className="my-2 text-xs border rounded-lg overflow-hidden" style={{ borderColor: theme.border }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-2 py-1.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <Wrench className="w-3 h-3 text-gray-400" />
        <span className="text-gray-600 flex-1">
          {isStreaming ? "Working..." : `Used ${tools.length} tools`}
          <span className="text-gray-400 ml-1">({summary})</span>
        </span>
        <ChevronDown
          className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? "" : "-rotate-90"}`}
        />
      </button>
      {isOpen && (
        <div className="px-2 py-1.5 bg-gray-50/50 text-gray-500 space-y-0.5">
          {tools.map((tool, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span>{tool}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
  width?: number;
}

export function CoLearningPanel({
  isOpen,
  onToggle,
  palette,
  width = 384,
}: CoLearningPanelProps) {
  // Conversation state
  const [conversations, setConversations] = useState<AgentConversationSummary[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [showConversationList, setShowConversationList] = useState(false);

  // Input state
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [contexts, setContexts] = useState<ContextItem[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationListRef = useRef<HTMLDivElement>(null);

  // Load conversation list on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle context events
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (conversationListRef.current && !conversationListRef.current.contains(e.target as Node)) {
        setShowConversationList(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadConversations = async () => {
    try {
      const res = await fetch("/api/conversations");
      const data = await res.json();
      if (data.success) {
        setConversations(data.conversations);
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  };

  const loadConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      if (data.success) {
        setCurrentConversationId(id);
        setMessages(data.conversation.messages);
        setShowConversationList(false);
      }
    } catch (err) {
      console.error("Failed to load conversation:", err);
    }
  };

  const saveConversation = useCallback(async (msgs: AgentMessage[], convId: string | null) => {
    if (msgs.length === 0) return convId;

    try {
      if (convId) {
        // Update existing
        await fetch(`/api/conversations/${convId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: msgs }),
        });
        return convId;
      } else {
        // Create new
        const firstUserMsg = msgs.find((m) => m.role === "user");
        const title = firstUserMsg?.content.slice(0, 50) || "New conversation";
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, messages: msgs }),
        });
        const data = await res.json();
        if (data.success) {
          loadConversations(); // Refresh list
          return data.conversation.id;
        }
      }
    } catch (err) {
      console.error("Failed to save conversation:", err);
    }
    return convId;
  }, []);

  const deleteConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (currentConversationId === id) {
          setCurrentConversationId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  const removeContext = (id: string) => {
    setContexts((prev) => prev.filter((c) => c.id !== id));
  };

  const startNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setContexts([]);
    setInput("");
    setShowConversationList(false);
  };

  const sendMessage = async () => {
    const messageText = input.trim();
    if (!messageText && contexts.length === 0) return;

    const currentContexts = [...contexts];
    const currentHistory = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));

    const userMessage: AgentMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: messageText,
      timestamp: new Date().toISOString(),
      contexts: currentContexts.length > 0 ? currentContexts.map((c) => ({
        id: c.id,
        text: c.text,
        source: c.source,
      })) : undefined,
    };

    const assistantMessageId = `msg-${Date.now()}-assistant`;
    const newMessages = [...messages, userMessage];

    // Add empty assistant message that will be filled by streaming
    const initialAssistantMessage: AgentMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };

    setMessages([...newMessages, initialAssistantMessage]);
    setInput("");
    setContexts([]);
    setIsLoading(true);

    // Save conversation immediately with user message (before streaming)
    let convId = currentConversationId;
    try {
      convId = await saveConversation(newMessages, currentConversationId);
      if (convId && convId !== currentConversationId) {
        setCurrentConversationId(convId);
      }
    } catch (e) {
      console.error("Failed to save conversation early:", e);
    }

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

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      // Handle streaming response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;

          // Update the assistant message with accumulated content
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: fullContent }
                : msg
            )
          );
        }
      }

      // Final update and save
      const finalMessages = newMessages.concat({
        ...initialAssistantMessage,
        content: fullContent.trim(),
      });
      setMessages(finalMessages);

      // Save final conversation with assistant response
      await saveConversation(finalMessages, convId);
    } catch (err) {
      const errorMessage: AgentMessage = {
        id: `msg-${Date.now()}-error`,
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev.slice(0, -1), errorMessage]);
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

  const currentConv = conversations.find((c) => c.id === currentConversationId);

  return (
    <div
      className="border-l flex flex-col h-full bg-white"
      style={{ width, borderColor: theme.border }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: theme.border }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Sparkles className="w-5 h-5 flex-shrink-0" style={{ color: palette[500] }} />

          {/* Conversation selector */}
          <div className="relative flex-1 min-w-0" ref={conversationListRef}>
            <button
              onClick={() => setShowConversationList(!showConversationList)}
              className="flex items-center gap-1 hover:bg-gray-100 rounded px-2 py-1 transition-colors max-w-full"
            >
              <span className="font-semibold truncate">
                {currentConv ? currentConv.title : "Agent"}
              </span>
              <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: theme.textMuted }} />
            </button>

            {/* Dropdown */}
            {showConversationList && (
              <div
                className="absolute top-full left-0 mt-1 w-72 bg-white border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto"
                style={{ borderColor: theme.border }}
              >
                {/* Conversation list */}
                {conversations.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-center" style={{ color: theme.textMuted }}>
                    No conversation history
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`group flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer ${
                        conv.id === currentConversationId ? "bg-gray-50" : ""
                      }`}
                      onClick={() => loadConversation(conv.id)}
                    >
                      <MessageSquare className="w-4 h-4 flex-shrink-0" style={{ color: theme.textMuted }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{conv.title}</p>
                        <p className="text-xs truncate" style={{ color: theme.textMuted }}>
                          {conv.messageCount} messages
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(conv.id);
                        }}
                        className="p-1 rounded hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={startNewConversation}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            title="New conversation"
          >
            <Plus className="w-4 h-4" style={{ color: theme.textMuted }} />
          </button>
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

            {/* Recent conversations */}
            {conversations.length > 0 && (
              <div className="mt-6 pt-4 border-t" style={{ borderColor: theme.border }}>
                <p className="text-xs mb-2" style={{ color: theme.textMuted }}>Recent conversations:</p>
                <div className="space-y-1">
                  {conversations.slice(0, 3).map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => loadConversation(conv.id)}
                      className="w-full px-3 py-2 text-left text-sm rounded-lg hover:bg-gray-50 truncate"
                      style={{ color: theme.text }}
                    >
                      {conv.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {messages.map((msg) => (
          // Don't render empty assistant messages (streaming placeholder)
          msg.role === "assistant" && !msg.content ? null : (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 break-words ${
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
                <div className="text-[13px] leading-snug">
                  {parseMessageContent(msg.content).map((segment, i) => (
                    segment.type === "tools" ? (
                      <ToolCallsSection
                        key={i}
                        tools={segment.tools || []}
                        isStreaming={isLoading && msg.id === messages[messages.length - 1]?.id}
                      />
                    ) : (
                      <div
                        key={i}
                        className="prose prose-xs prose-neutral prose-tight max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>p]:my-1.5 [&>ul]:my-1.5 [&>ol]:my-1.5 [&>li]:my-0.5 [&_code]:bg-black/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[12px] [&_code]:before:content-none [&_code]:after:content-none"
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {segment.content}
                        </ReactMarkdown>
                      </div>
                    )
                  ))}
                  {/* Show blinking cursor while streaming */}
                  {isLoading && msg.id === messages[messages.length - 1]?.id && (
                    <span className="inline-block w-2 h-4 ml-0.5 bg-gray-400 animate-pulse" />
                  )}
                </div>
              ) : (
                <p className="text-[13px] whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
          )
        ))}

        {isLoading && messages.length > 0 && messages[messages.length - 1].content === "" && (
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
