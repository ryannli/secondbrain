"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, Send, Sparkles, ChevronRight, ChevronLeft, Plus, ChevronDown, Trash2, MessageSquare, Wrench } from "lucide-react";
import { theme } from "@/lib/theme";
import { AgentConversationSummary, AgentMessage, AgentStreamEvent, AgentContext } from "@/lib/types";
import { useToggle } from "@/hooks/useToggle";

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

// A message sent while another turn was still streaming, waiting to be sent
interface QueuedSend {
  text: string;
  contexts: AgentContext[];
  userMessage: AgentMessage;
}

// Live record of an in-flight turn (also used to resume background streams)
interface ActiveTurn {
  messageId: string;
  events: StreamEvent[];
  queue: QueuedSend[];
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

  // Auto-collapse when streaming ends (render-phase adjustment)
  const [wasStreaming, setWasStreaming] = useState(isStreaming);
  if (wasStreaming !== isStreaming) {
    setWasStreaming(isStreaming);
    if (!isStreaming && tools.length > 0) {
      setIsOpen(false);
    }
  }

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
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors text-left"
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
          className="px-3 py-2 bg-gray-50/30 dark:bg-zinc-800/50 max-h-64 overflow-y-auto space-y-1.5 text-[12px]"
          style={{ color: theme.textMuted }}
        >
          {tools.map((tool) => (
            <div key={tool.id}>
              {/* Main tool */}
              <div className="flex items-start gap-2">
                <span className="px-1.5 py-0.5 rounded shrink-0 bg-gray-200/70 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 font-medium">
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
                <div className="ml-4 mt-1 pl-2 border-l-2 border-gray-200 dark:border-zinc-600 space-y-1">
                  {tool.children.map((child) => (
                    <div key={child.id}>
                      <div className="flex items-start gap-2">
                        <span className="px-1.5 py-0.5 rounded shrink-0 bg-gray-100 dark:bg-zinc-700 text-gray-500 dark:text-gray-400 text-[11px]">
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

interface CoLearningPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  palette: Record<number, string>;
  width?: number;
  currentPath?: string;
  sourcePath?: string;    // Full path to current source directory (e.g., ./library/folder/id)
  sourceId?: string;      // Current source ID (for explicit context display)
  sourceTitle?: string;   // Current source title (for explicit context display)
  documentPath?: string;  // Full path to current notebook document directory
  documentId?: string;    // Current document ID
  documentTitle?: string; // Current document title
  onAgentComplete?: () => void;
}

export function CoLearningPanel({
  isOpen,
  onToggle,
  palette,
  currentPath,
  sourcePath,
  sourceId,
  sourceTitle,
  documentPath,
  documentId,
  documentTitle,
  onAgentComplete,
  width = 384,
}: CoLearningPanelProps) {
  // Conversation state
  const [conversations, setConversations] = useState<AgentConversationSummary[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [showConversationList, toggleConversationList, setShowConversationList] = useToggle(false);

  // Streaming state
  const [streamingEvents, setStreamingEvents] = useState<StreamEvent[]>([]);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  // Input state
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [contexts, setContexts] = useState<AgentContext[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const conversationListRef = useRef<HTMLDivElement>(null);
  // Track current conversation ID in a ref so background fetches can check it
  const currentConvIdRef = useRef<string | null>(null);
  // Track active background streams: convId → live turn record
  const activeStreamsRef = useRef<Map<string, ActiveTurn>>(new Map());
  // In-flight turn for the conversation on screen. Set synchronously on send,
  // so a second send during streaming queues instead of racing the first.
  const viewTurnRef = useRef<ActiveTurn | null>(null);

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

  // Persist current conversation ID to localStorage and sync ref
  useEffect(() => {
    currentConvIdRef.current = currentConversationId;
    if (currentConversationId) {
      localStorage.setItem("agent-conversation-id", currentConversationId);
    }
  }, [currentConversationId]);

  // Auto-scroll to bottom only if user is near the bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingEvents]);

  // Track whether user is near the bottom of the messages container
  const handleMessagesScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const threshold = 80;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  // Handle context events (text selection)
  useEffect(() => {
    const handleAddContext = (e: CustomEvent<{ id: string; text: string; source?: string }>) => {
      const { id, text, source } = e.detail;
      setContexts((prev) => {
        if (prev.some((c) => c.type === "selection" && c.content === text)) return prev;
        const newContext: AgentContext = {
          type: "selection",
          id,
          title: source || "Selection",
          content: text,
        };
        return [...prev, newContext];
      });
      if (!isOpen) onToggle();
    };

    window.addEventListener("colearning:addContext", handleAddContext as EventListener);
    return () => {
      window.removeEventListener("colearning:addContext", handleAddContext as EventListener);
    };
  }, [isOpen, onToggle]);

  // Prefill the ask input from outside (e.g. the Notebook "+" button),
  // opening the panel if needed so the action always has visible feedback
  useEffect(() => {
    const handlePrefill = (e: CustomEvent<{ text: string }>) => {
      if (e.detail?.text) setInput(e.detail.text);
      if (!isOpen) onToggle();
    };
    window.addEventListener("colearning:prefill", handlePrefill as EventListener);
    return () => {
      window.removeEventListener("colearning:prefill", handlePrefill as EventListener);
    };
  }, [isOpen, onToggle]);

  // Auto-add entry (source or document) as context when viewing one
  const entryId = sourceId || documentId;
  const entryTitle = sourceTitle || documentTitle;
  const entryType: "source" | "document" = sourceId ? "source" : "document";

  useEffect(() => {
    if (entryId && entryTitle) {
      setContexts((prev) => {
        // Don't add if already exists
        if (prev.some((c) => c.type === entryType && c.id === entryId)) return prev;
        // Remove any other source/document context (only one entry at a time)
        const filtered = prev.filter((c) => c.type !== "source" && c.type !== "document");
        const entryContext: AgentContext = {
          type: entryType,
          id: entryId,
          title: entryTitle,
        };
        return [entryContext, ...filtered];
      });
    } else {
      // Remove entry context when navigating away
      setContexts((prev) => prev.filter((c) => c.type !== "source" && c.type !== "document"));
    }
  }, [entryId, entryTitle, entryType]);

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

        // Resume streaming if there's a background fetch for this conversation
        const bgStream = activeStreamsRef.current.get(id);
        viewTurnRef.current = bgStream ?? null;
        if (bgStream) {
          setStreamingMessageId(bgStream.messageId);
          setStreamingEvents([...bgStream.events]);
          setIsLoading(true);
        } else {
          setStreamingMessageId(null);
          setStreamingEvents([]);
          setIsLoading(false);
        }
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
          viewTurnRef.current = null;
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
    // Clear UI — background fetch continues, keyed by conversation ID
    setCurrentConversationId(null);
    setMessages([]);
    setContexts((prev) => prev.filter((c) => c.type === "source"));
    setInput("");
    setStreamingEvents([]);
    setStreamingMessageId(null);
    setIsLoading(false);
    setShowConversationList(false);
    viewTurnRef.current = null;
  };

  const sendMessage = async () => {
    const messageText = input.trim();
    if (!messageText && contexts.length === 0) return;

    const currentContexts = [...contexts];
    const userMessage: AgentMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: messageText,
      timestamp: new Date().toISOString(),
      contexts: currentContexts.length > 0 ? currentContexts : undefined,
    };

    setInput("");
    setContexts([]);
    isNearBottomRef.current = true;

    // A turn is already streaming in this conversation: show the message now
    // and queue it; the active turn chains it on completion with full history.
    if (viewTurnRef.current) {
      setMessages((prev) => [...prev, userMessage]);
      viewTurnRef.current.queue.push({ text: messageText, contexts: currentContexts, userMessage });
      return;
    }

    await runTurn(messageText, currentContexts, userMessage, messages, currentConversationId);
  };

  // Runs one request/stream turn. On completion, chains any sends that were
  // queued while it was streaming, using the completed history as the base.
  const runTurn = async (
    messageText: string,
    turnContexts: AgentContext[],
    userMessage: AgentMessage,
    baseMessages: AgentMessage[],
    convIdIn: string | null,
    carriedQueue: QueuedSend[] = [],
  ) => {
    const currentHistory = baseMessages.slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
      streamEvents: m.streamEvents,
    }));

    const assistantMessageId = `${userMessage.id}-assistant`;
    const newMessages = [...baseMessages, userMessage];
    const allEvents: StreamEvent[] = [];
    const turn: ActiveTurn = { messageId: assistantMessageId, events: allEvents, queue: carriedQueue };

    // Synchronous, before any await: a send arriving from now on gets queued
    const isViewed = convIdIn === null || currentConvIdRef.current === convIdIn;
    if (isViewed) {
      viewTurnRef.current = turn;
      setMessages([...newMessages, ...turn.queue.map((q) => q.userMessage)]);
      setStreamingEvents([]);
      setStreamingMessageId(assistantMessageId);
      setIsLoading(true);
    }

    // Save conversation immediately with user message
    let convId = convIdIn;
    try {
      convId = await saveConversation(newMessages, convIdIn);
      if (convId && convId !== convIdIn && isViewed) {
        setCurrentConversationId(convId);
      }
    } catch (e) {
      console.error("Failed to save conversation early:", e);
    }

    // Check if user is still viewing this conversation
    const isActive = () => convId !== null && currentConvIdRef.current === convId;

    // Register background stream so loadConversation can resume it
    if (convId) {
      activeStreamsRef.current.set(convId, turn);
    }

    // Messages after this turn resolves; base for chained queued sends
    let outcomeMessages = newMessages;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          contexts: turnContexts.map((c) => ({
            text: (c.type === "source" || c.type === "document") ? `[${c.type === "source" ? "Source" : "Document"}: ${c.title}]` : (c.content || ""),
            source: c.title,
          })),
          history: currentHistory,
          currentPath,
          sourcePath,
          documentPath,
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
              if (isActive()) {
                setStreamingEvents([...allEvents]);
              }
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

      outcomeMessages = [...newMessages, assistantMessage];
      if (isActive()) {
        setMessages([...outcomeMessages, ...turn.queue.map((q) => q.userMessage)]);
        setStreamingEvents([]);
        setStreamingMessageId(null);
      }

      // Always save final conversation (even if user switched away)
      await saveConversation(outcomeMessages, convId);
      loadConversations();
      if (isActive()) {
        onAgentComplete?.();
      }

    } catch (err) {
      const errorMessage: AgentMessage = {
        id: `msg-${Date.now()}-error`,
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`,
        timestamp: new Date().toISOString(),
      };
      outcomeMessages = [...newMessages, errorMessage];
      if (isActive()) {
        setMessages([...outcomeMessages, ...turn.queue.map((q) => q.userMessage)]);
        setStreamingEvents([]);
        setStreamingMessageId(null);
      }
    } finally {
      if (convId) {
        activeStreamsRef.current.delete(convId);
      }
      const next = turn.queue.shift();
      if (next) {
        runTurn(next.text, next.contexts, next.userMessage, outcomeMessages, convId, turn.queue);
      } else {
        if (viewTurnRef.current === turn) {
          viewTurnRef.current = null;
        }
        if (isActive()) {
          setIsLoading(false);
        }
      }
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
    const proseClasses = "prose prose-sm prose-neutral dark:prose-invert prose-tight max-w-none text-[13px] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>p]:my-1.5 [&>ul]:my-1.5 [&>ol]:my-1.5 [&>li]:my-0.5 [&_code]:bg-black/10 dark:[&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[12px] [&_code]:before:content-none [&_code]:after:content-none";

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
                  <span
                    key={ctx.id}
                    className={`text-xs px-1.5 py-0.5 rounded ${ctx.type === "source" ? "bg-white/30 border border-white/40" : "bg-white/20"}`}
                    title={ctx.type === "source" ? ctx.title : ctx.content}
                  >
                    {ctx.type === "source" ? "📄 " : "💬 "}
                    {ctx.title.slice(0, 20)}{ctx.title.length > 20 ? "..." : ""}
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
          className="max-w-[85%] rounded-2xl px-4 py-2 break-words rounded-bl-md bg-zinc-100 dark:bg-zinc-800"
          style={{ color: theme.text }}
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

            {isStreaming && (parsed.segments.length === 0 || parsed.segments[parsed.segments.length - 1]?.type === "text") && (
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
        data-track="agent.toggle"
        title="Agent"
      >
        <ChevronLeft className="w-5 h-5 text-white" />
      </button>
    );
  }

  const currentConv = conversations.find((c) => c.id === currentConversationId);

  return (
    <div
      className="border-l border-zinc-200 dark:border-zinc-700 flex flex-col h-full bg-white dark:bg-zinc-900"
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
              onClick={toggleConversationList}
              className="flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded px-2 py-1 transition-colors max-w-full"
              data-track="agent.selectconv"
            >
              <span className="font-semibold truncate">
                {currentConv ? currentConv.title : "Agent"}
              </span>
              <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: theme.textMuted }} />
            </button>

            {/* Dropdown */}
            {showConversationList && (
              <div
                className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-zinc-800 border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto"
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
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            data-track="agent.newconv"
            title="New conversation"
          >
            <Plus className="w-4 h-4" style={{ color: theme.textMuted }} />
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            data-track="agent.close"
          >
            <ChevronRight className="w-4 h-4" style={{ color: theme.textMuted }} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} onScroll={handleMessagesScroll} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-8">
            {contexts.length === 0 && (
              <>
                <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p className="text-sm" style={{ color: theme.textMuted }}>
                  Your second hand for the cognitive workspace.
                </p>
              </>
            )}
            <div className="mt-4 space-y-2">
              <p className="text-xs" style={{ color: theme.textMuted }}>Try asking:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {(contexts.length > 0
                  ? ["What's this?", "Explain simply", "What should I verify?"]
                  : ["Draft a brief connecting my recent sources", "What should I read next?", "Organize my library"]
                ).map((q) => (
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
                className="group relative flex items-center gap-1.5 pl-2 pr-6 py-1 rounded-md text-xs border cursor-default"
                style={{
                  borderColor: ctx.type === "source" ? palette[300] : palette[200],
                  backgroundColor: ctx.type === "source" ? `${palette[100]}50` : `${palette[500]}08`,
                  color: palette[700],
                }}
                title={ctx.type === "source" ? ctx.title : ctx.content}
              >
                {ctx.type === "source" ? (
                  <>
                    <span className="text-[10px] opacity-60">📄</span>
                    <span className="truncate max-w-[180px] font-medium">
                      {ctx.title}
                    </span>
                  </>
                ) : (
                  <div className="flex flex-col gap-0 min-w-0">
                    <span className="text-[10px] opacity-50 truncate">
                      💬 {ctx.title}
                    </span>
                    <span className="truncate text-[11px] opacity-80">
                      {(ctx.content || "").slice(0, 40)}{(ctx.content || "").length > 40 ? "..." : ""}
                    </span>
                  </div>
                )}
                {/* X button - appears on hover */}
                <button
                  onClick={() => removeContext(ctx.id)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/10"
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
            disabled={!input.trim() && contexts.length === 0}
            className="p-1.5 rounded-lg transition-colors disabled:opacity-50"
            data-track="agent.send"
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

  const prefillInput = (text: string) => {
    window.dispatchEvent(new CustomEvent("colearning:prefill", { detail: { text } }));
  };

  return { addContext, prefillInput };
}
