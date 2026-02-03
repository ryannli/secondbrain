"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, Send, Sparkles, ChevronRight, ChevronLeft, Plus, ChevronDown, Trash2, MessageSquare, Wrench } from "lucide-react";
import { theme } from "@/lib/theme";
import { AgentConversationSummary, AgentMessage, AgentContext } from "@/lib/types";

interface ToolCall {
  name: string;
  detail?: string;
  isSubtool?: boolean;
}

interface ParsedMessage {
  planning: string | null;      // First text before any tool
  working: Array<{ type: "text" | "tools"; content: string; tools?: ToolCall[] }>;  // Middle content
  conclusion: string | null;    // Last text after all tools
  totalToolCalls: number;
}

/**
 * Parse message into planning / working / conclusion sections
 */
function parseMessageContent(content: string): ParsedMessage {
  // Match all tool marker formats
  const toolPattern = /\[\[TOOL:(\w+)(?::([^\]]*))?\]\]|\[\[TASK_START:([^:]+):([^\]]*)\]\]|\[\[SUBTOOL:(\w+):([^\]]*)\]\]|\[\[SUBTASK_DONE\]\]/g;
  const allMatches: { index: number; tool: string; detail?: string; end: number; isSubtool?: boolean }[] = [];

  let match;
  while ((match = toolPattern.exec(content)) !== null) {
    if (match[1]) {
      // Tool: [[TOOL:name]] or [[TOOL:name:detail]]
      allMatches.push({
        index: match.index,
        tool: match[1],
        detail: match[2] || undefined,
        end: match.index + match[0].length,
      });
    } else if (match[3]) {
      // Task start: [[TASK_START:type:desc]]
      allMatches.push({
        index: match.index,
        tool: `Task`,
        detail: `${match[3]}: ${match[4] || ""}`,
        end: match.index + match[0].length,
      });
    } else if (match[5]) {
      // Sub-agent tool: [[SUBTOOL:name:detail]]
      allMatches.push({
        index: match.index,
        tool: `  ↳ ${match[5]}`,
        detail: match[6] || undefined,
        end: match.index + match[0].length,
        isSubtool: true,
      });
    } else {
      // Sub-task done: [[SUBTASK_DONE]]
      allMatches.push({
        index: match.index,
        tool: "  ✓ sub-task completed",
        end: match.index + match[0].length,
        isSubtool: true,
      });
    }
  }

  // No tools = everything is planning
  if (allMatches.length === 0) {
    return { planning: content.trim() || null, working: [], conclusion: null, totalToolCalls: 0 };
  }

  // Extract planning (text before first tool)
  const planning = content.slice(0, allMatches[0].index).trim() || null;

  // Extract conclusion (text after last tool)
  const lastMatch = allMatches[allMatches.length - 1];
  const conclusionText = content.slice(lastMatch.end).trim();
  const conclusion = conclusionText || null;

  // Build working section (everything between first and last tool)
  const working: ParsedMessage["working"] = [];
  let pendingTools: ToolCall[] = [];

  for (let i = 0; i < allMatches.length; i++) {
    const curr = allMatches[i];
    pendingTools.push({ name: curr.tool, detail: curr.detail, isSubtool: curr.isSubtool });

    // Check if there's text between this tool and the next
    const nextStart = i + 1 < allMatches.length ? allMatches[i + 1].index : lastMatch.end;
    const textBetween = content.slice(curr.end, nextStart).trim();

    // If there's substantial text, flush tools and add text
    if (textBetween && i + 1 < allMatches.length) {
      if (pendingTools.length > 0) {
        working.push({ type: "tools", content: "", tools: [...pendingTools] });
        pendingTools = [];
      }
      working.push({ type: "text", content: textBetween });
    }
  }

  // Flush remaining tools
  if (pendingTools.length > 0) {
    working.push({ type: "tools", content: "", tools: pendingTools });
  }

  return { planning, working, conclusion, totalToolCalls: allMatches.length };
}

/**
 * Collapsible working section that contains all tool calls and intermediate thinking
 */
function WorkingSection({
  working,
  totalToolCalls,
  isStreaming,
  palette,
}: {
  working: ParsedMessage["working"];
  totalToolCalls: number;
  isStreaming: boolean;
  palette: Record<number, string>;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-collapse when streaming ends
  useEffect(() => {
    if (!isStreaming && totalToolCalls > 0) {
      setIsOpen(false);
    }
  }, [isStreaming, totalToolCalls]);

  // Auto-scroll within the container while streaming
  useEffect(() => {
    if (isStreaming && isOpen && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  });

  if (working.length === 0 && totalToolCalls === 0) return null;

  return (
    <div className="my-2 border rounded-lg overflow-hidden text-xs" style={{ borderColor: theme.border }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <Wrench className="w-3.5 h-3.5" style={{ color: palette[500] }} />
        <span className="flex-1 font-medium" style={{ color: theme.text }}>
          {isStreaming ? "Working..." : `Completed ${totalToolCalls} operations`}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "" : "-rotate-90"}`}
        />
      </button>
      {isOpen && (
        <div
          ref={contentRef}
          className="px-3 py-2 bg-gray-50/30 max-h-48 overflow-y-auto space-y-2 text-[12px]"
          style={{ color: theme.textMuted }}
        >
          {working.map((segment, i) =>
            segment.type === "tools" ? (
              <div key={i} className="space-y-1">
                {segment.tools?.map((tool, j) => (
                  <div key={j} className="flex items-start gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-gray-200/70 text-gray-600 font-medium shrink-0">
                      {tool.name}
                    </span>
                    {tool.detail && (
                      <span className="text-gray-500 truncate" title={tool.detail}>
                        {tool.detail}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p key={i} className="text-gray-600 leading-relaxed">{segment.content}</p>
            )
          )}
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

  // Load conversation list and restore last session on mount
  useEffect(() => {
    const init = async () => {
      await loadConversations();

      // Restore last conversation from localStorage
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
                (() => {
                  const parsed = parseMessageContent(msg.content);
                  const isCurrentlyStreaming = isLoading && msg.id === messages[messages.length - 1]?.id;
                  const proseClasses = "prose prose-sm prose-neutral prose-tight max-w-none text-[13px] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>p]:my-1.5 [&>ul]:my-1.5 [&>ol]:my-1.5 [&>li]:my-0.5 [&_code]:bg-black/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[12px] [&_code]:before:content-none [&_code]:after:content-none";

                  return (
                    <div className="text-[13px] leading-snug">
                      {/* Planning - first text before any tools */}
                      {parsed.planning && (
                        <div className={proseClasses}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {parsed.planning}
                          </ReactMarkdown>
                        </div>
                      )}

                      {/* Working section - collapsible container with tools and intermediate text */}
                      <WorkingSection
                        working={parsed.working}
                        totalToolCalls={parsed.totalToolCalls}
                        isStreaming={isCurrentlyStreaming && !parsed.conclusion}
                        palette={palette}
                      />

                      {/* Conclusion - text after all tools */}
                      {parsed.conclusion && (
                        <div className={proseClasses}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {parsed.conclusion}
                          </ReactMarkdown>
                        </div>
                      )}

                      {/* Blinking cursor while streaming */}
                      {isCurrentlyStreaming && !parsed.conclusion && parsed.totalToolCalls === 0 && (
                        <span className="inline-block w-2 h-4 ml-0.5 bg-gray-400 animate-pulse" />
                      )}
                    </div>
                  );
                })()
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
            onChange={(e) => {
              setInput(e.target.value);
              // Auto-resize
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
