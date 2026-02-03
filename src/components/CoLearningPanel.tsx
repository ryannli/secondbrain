"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, Send, Sparkles, ChevronRight, ChevronLeft, Plus, ChevronDown, Trash2, MessageSquare, Wrench } from "lucide-react";
import { theme } from "@/lib/theme";
import { AgentConversationSummary, AgentMessage, AgentStreamEvent } from "@/lib/types";

// Re-export for local use
type StreamEvent = AgentStreamEvent;

// UI data structures
interface ToolCall {
  id: string;
  name: string;
  detail?: string;
  result?: string;
  children?: ToolCall[];
}

type MessageSegment =
  | { type: "text"; content: string }
  | { type: "tools"; tools: ToolCall[] };

interface ParsedMessage {
  segments: MessageSegment[];
  totalToolCalls: number;
}

/**
 * Build ParsedMessage from accumulated stream events
 */
function buildParsedMessage(events: StreamEvent[]): ParsedMessage {
  const segments: MessageSegment[] = [];
  let currentText = "";
  let currentTools: ToolCall[] = [];
  const toolsById = new Map<string, ToolCall>();
  let totalToolCalls = 0;

  const flushText = () => {
    if (currentText.trim()) {
      segments.push({ type: "text", content: currentText.trim() });
      currentText = "";
    }
  };

  const flushTools = () => {
    if (currentTools.length > 0) {
      segments.push({ type: "tools", tools: [...currentTools] });
      currentTools = [];
    }
  };

  for (const event of events) {
    switch (event.type) {
      case "text":
        // If we have pending tools, flush them first
        if (currentTools.length > 0) {
          flushTools();
        }
        currentText += event.content;
        break;

      case "tool": {
        // Text before tool? Flush it
        flushText();
        const tool: ToolCall = {
          id: event.id,
          name: event.name,
          detail: event.detail,
          children: event.name === "Task" ? [] : undefined,
        };
        currentTools.push(tool);
        toolsById.set(event.id, tool);
        totalToolCalls++;
        break;
      }

      case "subtool": {
        const parentTool = toolsById.get(event.parentId);
        if (parentTool?.children) {
          const subtool: ToolCall = {
            id: `${event.parentId}-${parentTool.children.length}`,
            name: event.name,
            detail: event.detail,
          };
          parentTool.children.push(subtool);
          totalToolCalls++;
        }
        break;
      }

      case "result": {
        const tool = toolsById.get(event.toolId);
        if (tool) {
          tool.result = event.content;
        }
        break;
      }

      case "subtool_done":
        // Could add visual indicator, for now just ignore
        break;

      case "error":
        flushText();
        flushTools();
        segments.push({ type: "text", content: `Error: ${event.message}` });
        break;
    }
  }

  // Flush remaining
  flushText();
  flushTools();

  return { segments, totalToolCalls };
}

/**
 * Convert ParsedMessage to plain text (for saving)
 */
function segmentsToText(segments: MessageSegment[]): string {
  return segments
    .map((seg) => {
      if (seg.type === "text") return seg.content;
      // For tools, just indicate they were used (don't include in saved text)
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Parse saved message content back to segments (for displaying old messages)
 * Since saved messages are plain text, just wrap in a text segment
 */
function parseStoredMessage(content: string): ParsedMessage {
  if (!content.trim()) {
    return { segments: [], totalToolCalls: 0 };
  }
  return {
    segments: [{ type: "text", content: content.trim() }],
    totalToolCalls: 0,
  };
}

/**
 * Collapsible section for a group of tool calls
 */
function ToolsSection({
  tools,
  isStreaming,
  palette,
  defaultOpen = true,
}: {
  tools: ToolCall[];
  isStreaming: boolean;
  palette: Record<number, string>;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-collapse when streaming ends
  useEffect(() => {
    if (!isStreaming && tools.length > 0) {
      setIsOpen(false);
    }
  }, [isStreaming, tools.length]);

  // Auto-scroll within the container while streaming
  useEffect(() => {
    if (isStreaming && isOpen && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  });

  if (tools.length === 0) return null;

  // Count total including children
  const totalOps = tools.reduce((sum, t) => sum + 1 + (t.children?.length || 0), 0);

  return (
    <div className="my-2 border rounded-lg overflow-hidden text-xs" style={{ borderColor: theme.border }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <Wrench className="w-3.5 h-3.5" style={{ color: palette[500] }} />
        <span className="flex-1 font-medium" style={{ color: theme.text }}>
          {isStreaming ? "Working..." : `${totalOps} operations`}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "" : "-rotate-90"}`}
        />
      </button>
      {isOpen && (
        <div
          ref={contentRef}
          className="px-3 py-2 bg-gray-50/30 max-h-64 overflow-y-auto space-y-1.5 text-[12px]"
          style={{ color: theme.textMuted }}
        >
          {tools.map((tool) => (
            <div key={tool.id}>
              {/* Main tool */}
              <div className="flex items-start gap-2">
                <span className="px-1.5 py-0.5 rounded shrink-0 bg-gray-200/70 text-gray-600 font-medium">
                  {tool.name}
                </span>
                {tool.detail && (
                  <span className="truncate text-[11px] text-gray-500" title={tool.detail}>
                    {tool.detail}
                  </span>
                )}
              </div>
              {tool.result && (
                <div className="mt-0.5 ml-2 text-[10px] text-gray-400 truncate" title={tool.result}>
                  → {tool.result.split("\n")[0]}
                </div>
              )}

              {/* Children (subtools) */}
              {tool.children && tool.children.length > 0 && (
                <div className="ml-4 mt-1 pl-2 border-l-2 border-gray-200 space-y-1">
                  {tool.children.map((child) => (
                    <div key={child.id}>
                      <div className="flex items-start gap-2">
                        <span className="px-1.5 py-0.5 rounded shrink-0 bg-gray-100 text-gray-500 text-[11px]">
                          {child.name}
                        </span>
                        {child.detail && (
                          <span className="truncate text-[11px] text-gray-400" title={child.detail}>
                            {child.detail}
                          </span>
                        )}
                      </div>
                      {child.result && (
                        <div className="mt-0.5 ml-2 text-[10px] text-gray-400 truncate" title={child.result}>
                          → {child.result.split("\n")[0]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {isStreaming && (
            <span className="inline-block w-1.5 h-3 bg-gray-400 animate-pulse" />
          )}
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
  currentPath?: string;
  onAgentComplete?: () => void;
}

export function CoLearningPanel({
  isOpen,
  onToggle,
  palette,
  currentPath,
  onAgentComplete,
  width = 384,
}: CoLearningPanelProps) {
  // Conversation state
  const [conversations, setConversations] = useState<AgentConversationSummary[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [showConversationList, setShowConversationList] = useState(false);

  // Streaming state
  const [streamingEvents, setStreamingEvents] = useState<StreamEvent[]>([]);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  // Input state
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [contexts, setContexts] = useState<ContextItem[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationListRef = useRef<HTMLDivElement>(null);

  // Load conversation list and restore last session on mount
  useEffect(() => {
    const init = async () => {
      await loadConversations();
      const savedConvId = localStorage.getItem("agent-conversation-id");
      if (savedConvId) {
        loadConversation(savedConvId);
      }
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist current conversation ID to localStorage
  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem("agent-conversation-id", currentConversationId);
    }
  }, [currentConversationId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingEvents]);

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
        await fetch(`/api/conversations/${convId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: msgs }),
        });
        return convId;
      } else {
        const firstUserMsg = msgs.find((m) => m.role === "user");
        const title = firstUserMsg?.content.slice(0, 50) || "New conversation";
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, messages: msgs }),
        });
        const data = await res.json();
        if (data.success) {
          loadConversations();
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

    setMessages(newMessages);
    setStreamingEvents([]);
    setStreamingMessageId(assistantMessageId);
    setInput("");
    setContexts([]);
    setIsLoading(true);

    // Save conversation immediately with user message
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
          currentPath,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      // Handle NDJSON streaming response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const allEvents: StreamEvent[] = [];

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line) as StreamEvent;
              allEvents.push(event);
              setStreamingEvents([...allEvents]);
            } catch {
              // Ignore malformed JSON
            }
          }
        }
      }

      // Build final message
      const parsed = buildParsedMessage(allEvents);
      const finalContent = segmentsToText(parsed.segments);

      const assistantMessage: AgentMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: finalContent,
        timestamp: new Date().toISOString(),
        streamEvents: allEvents.length > 0 ? allEvents : undefined,
      };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);
      setStreamingEvents([]);
      setStreamingMessageId(null);

      // Save final conversation
      await saveConversation(finalMessages, convId);
      onAgentComplete?.();

    } catch (err) {
      const errorMessage: AgentMessage = {
        id: `msg-${Date.now()}-error`,
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`,
        timestamp: new Date().toISOString(),
      };
      setMessages([...newMessages, errorMessage]);
      setStreamingEvents([]);
      setStreamingMessageId(null);
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

  // Render a message (either from history or streaming)
  const renderMessage = (msg: AgentMessage, isStreaming: boolean, streamEvents?: StreamEvent[]) => {
    const proseClasses = "prose prose-sm prose-neutral prose-tight max-w-none text-[13px] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>p]:my-1.5 [&>ul]:my-1.5 [&>ol]:my-1.5 [&>li]:my-0.5 [&_code]:bg-black/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[12px] [&_code]:before:content-none [&_code]:after:content-none";

    if (msg.role === "user") {
      return (
        <div className="flex justify-end">
          <div
            className="max-w-[85%] rounded-2xl px-4 py-2 break-words rounded-br-md"
            style={{ backgroundColor: palette[500], color: "white" }}
          >
            {msg.contexts && msg.contexts.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5 pb-1.5 border-b border-white/20">
                {msg.contexts.map((ctx) => (
                  <span key={ctx.id} className="text-xs px-1.5 py-0.5 rounded bg-white/20">
                    {ctx.text.slice(0, 25)}{ctx.text.length > 25 ? "..." : ""}
                  </span>
                ))}
              </div>
            )}
            <p className="text-[13px] whitespace-pre-wrap">{msg.content}</p>
          </div>
        </div>
      );
    }

    // Assistant message - use streamEvents if available, otherwise plain text
    const parsed = isStreaming && streamEvents
      ? buildParsedMessage(streamEvents)
      : msg.streamEvents
        ? buildParsedMessage(msg.streamEvents)
        : parseStoredMessage(msg.content);

    if (parsed.segments.length === 0 && !isStreaming) {
      return null; // Don't render empty messages
    }

    return (
      <div className="flex justify-start">
        <div
          className="max-w-[85%] rounded-2xl px-4 py-2 break-words rounded-bl-md"
          style={{ backgroundColor: "#f4f4f5", color: theme.text }}
        >
          <div className="text-[13px] leading-snug">
            {parsed.segments.map((segment, i) => (
              segment.type === "text" ? (
                <div key={i} className={proseClasses}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {segment.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <ToolsSection
                  key={i}
                  tools={segment.tools}
                  isStreaming={isStreaming && i === parsed.segments.length - 1}
                  palette={palette}
                  defaultOpen={isStreaming || i === parsed.segments.length - 1}
                />
              )
            ))}

            {isStreaming && parsed.segments.length === 0 && (
              <span className="inline-block w-2 h-4 ml-0.5 bg-gray-400 animate-pulse" />
            )}
          </div>
        </div>
      </div>
    );
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
        {messages.length === 0 && contexts.length === 0 && !isLoading && (
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
          <div key={msg.id}>
            {renderMessage(msg, false)}
          </div>
        ))}

        {/* Streaming message */}
        {streamingMessageId && streamingEvents.length > 0 && (
          <div>
            {renderMessage(
              { id: streamingMessageId, role: "assistant", content: "", timestamp: "" },
              true,
              streamingEvents
            )}
          </div>
        )}

        {/* Loading indicator when no events yet */}
        {isLoading && streamingEvents.length === 0 && (
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
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder={contexts.length > 0 ? "Ask about context..." : "Ask anything..."}
            className="flex-1 resize-none text-sm outline-none bg-transparent"
            rows={1}
            style={{ color: theme.text, minHeight: "24px", maxHeight: "120px", overflowY: "auto" }}
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
