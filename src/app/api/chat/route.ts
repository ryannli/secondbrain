import { NextRequest } from "next/server";
import { spawn } from "child_process";
import path from "path";

/**
 * Get the user data root path - Agent's working directory
 */
function getUserDataPath(): string {
  return process.env.SECONDBRAIN_ROOT || path.join(process.cwd(), "user_data");
}

interface ChatContext {
  text: string;
  source?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  streamEvents?: StreamEvent[];
}

// Stream event types sent to frontend (NDJSON format)
type StreamEvent =
  | { type: "text"; content: string }
  | { type: "tool"; id: string; name: string; detail?: string }
  | { type: "subtool"; parentId: string; name: string; detail?: string }
  | { type: "result"; toolId: string; content: string }
  | { type: "subtool_done"; parentId: string }
  | { type: "error"; message: string };

/**
 * POST /api/chat
 * Chat with Claude, with optional context (streaming response)
 * Returns NDJSON stream of events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, contexts, history, currentPath, sourcePath } = body as {
      message: string;
      contexts?: ChatContext[];
      history?: ChatMessage[];
      currentPath?: string;
      sourcePath?: string;
    };

    if (!message && (!contexts || contexts.length === 0)) {
      return new Response(
        JSON.stringify({ success: false, error: "Message or context required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build the prompt - detailed instructions are in user_data/CLAUDE.md
    let prompt = `You are an Agent in a knowledge management app called "Second Brain".

Your environment:
- \`./library/\` - The content library (read and write)
- \`./config.json\` - User settings (read only)
- \`./CLAUDE.md\` - Your detailed instructions (read this for schemas and rules)

Be concise but thorough. Use markdown formatting when helpful.
`;

    // Add user's current location
    if (currentPath) {
      prompt += "\n## User's Current Location\n";
      prompt += `User is at: \`${currentPath}\`\n`;

      // Parse path to give helpful context
      const sourceMatch = currentPath.match(/[?&]source=([^&]+)/);
      if (sourceMatch) {
        const sourceId = sourceMatch[1];
        if (sourcePath) {
          prompt += `\nUser is viewing source **${sourceId}**. Source folder: \`${sourcePath}/\`\n`;
        } else {
          prompt += `\nUser is viewing source **${sourceId}**. Use \`find ./library -type d -name "${sourceId}"\` to locate it.\n`;
        }
      } else if (currentPath.includes("view=foryou")) {
        prompt += "User is on the For You feed.\n";
      } else {
        prompt += "User is on the Dashboard.\n";
      }
    }

    // Add context if provided
    if (contexts && contexts.length > 0) {
      prompt += "\n## Selected Context\n";
      for (const ctx of contexts) {
        prompt += `\n### ${ctx.source || "Selection"}\n${ctx.text}\n`;
      }
    }

    // Add conversation history (including tool results for context)
    if (history && history.length > 0) {
      prompt += "\n## Conversation History\n";
      for (const msg of history) {
        prompt += `\n${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}\n`;

        // Include tool results summary for assistant messages
        if (msg.role === "assistant" && msg.streamEvents) {
          const toolSummaries: string[] = [];
          for (const event of msg.streamEvents) {
            if (event.type === "tool" && event.detail) {
              toolSummaries.push(`- ${event.name}: ${event.detail}`);
            } else if (event.type === "result" && event.content) {
              // Truncate long results
              const preview = event.content.length > 200
                ? event.content.slice(0, 200) + "..."
                : event.content;
              toolSummaries.push(`  → ${preview}`);
            }
          }
          if (toolSummaries.length > 0) {
            prompt += `\n[Tools used in this turn:\n${toolSummaries.join("\n")}\n]\n`;
          }
        }
      }
    }

    // Add current message
    prompt += `\n## User's Question\n${message}\n`;
    prompt += "\n## Your Response\n";

    // Create streaming response using stream-json format
    // Agent runs in user_data directory (can read all, write to library/)
    const userDataPath = getUserDataPath();

    const stream = new ReadableStream({
      start(controller) {
        const proc = spawn("claude", [
          "--print",
          "--output-format", "stream-json",
          "--verbose",
          "--include-partial-messages",
          "--permission-mode", "acceptEdits",
          "--allowedTools", "Read,Write,Edit,Bash,Glob,Grep,Task,WebSearch,WebFetch",
        ], {
          stdio: ["pipe", "pipe", "pipe"],
          cwd: userDataPath,
        });

        const encoder = new TextEncoder();
        let buffer = "";

        // Track current Task for grouping subtools
        let currentTaskId: string | null = null;
        // Track last tool for attaching results
        let lastToolId: string | null = null;

        const sendEvent = (event: StreamEvent) => {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        };

        const getToolDetail = (toolName: string, input: Record<string, unknown>): string => {
          if (toolName === "Task") {
            const subagentType = input.subagent_type || "agent";
            return `${subagentType}: ${input.description || ""}`;
          } else if (toolName === "Bash") {
            return (input.command as string) || "";
          } else if (toolName === "Read" || toolName === "Write" || toolName === "Edit") {
            return (input.file_path as string) || "";
          } else if (toolName === "Glob") {
            return (input.pattern as string) || "";
          } else if (toolName === "Grep") {
            return (input.pattern as string) || "";
          } else if (toolName === "WebSearch") {
            return (input.query as string) || "";
          } else if (toolName === "WebFetch") {
            return (input.url as string) || "";
          } else if (toolName === "TodoWrite" || toolName === "TaskCreate") {
            return (input.subject as string) || (input.description as string) || "";
          } else {
            const firstVal = Object.values(input).find(v => typeof v === "string");
            return (firstVal as string) || "";
          }
        };

        proc.stdout.on("data", (data) => {
          buffer += data.toString();

          // Process complete JSON lines
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);

              // Extract text from content_block_delta events
              if (
                event.type === "stream_event" &&
                event.event?.type === "content_block_delta" &&
                event.event?.delta?.type === "text_delta"
              ) {
                sendEvent({ type: "text", content: event.event.delta.text });
              }

              // Main-level tool calls (not from sub-agent)
              if (event.type === "assistant" && event.message?.content && !event.parent_tool_use_id) {
                for (const block of event.message.content) {
                  if (block.type === "tool_use") {
                    const toolId = block.id || `tool-${Date.now()}`;
                    const toolName = block.name;
                    const input = block.input || {};
                    const detail = getToolDetail(toolName, input);

                    sendEvent({ type: "tool", id: toolId, name: toolName, detail });
                    lastToolId = toolId;

                    // Track Task for grouping subtools
                    if (toolName === "Task") {
                      currentTaskId = toolId;
                    }
                  }
                }
              }

              // Tool results
              if (event.type === "user" && event.message?.content && !event.parent_tool_use_id) {
                for (const block of event.message.content) {
                  if (block.type === "tool_result" && block.content && lastToolId) {
                    const resultText = typeof block.content === "string"
                      ? block.content
                      : JSON.stringify(block.content);
                    // Only show reasonably short results
                    if (resultText.length > 0 && resultText.length < 500) {
                      sendEvent({ type: "result", toolId: lastToolId, content: resultText });
                    }
                  }
                }
              }

              // Sub-agent events (has parent_tool_use_id)
              if (event.parent_tool_use_id) {
                // Sub-agent's tool calls
                if (event.type === "assistant" && event.message?.content) {
                  for (const block of event.message.content) {
                    if (block.type === "tool_use" && currentTaskId) {
                      const detail = getToolDetail(block.name, block.input || {});
                      sendEvent({
                        type: "subtool",
                        parentId: currentTaskId,
                        name: block.name,
                        detail,
                      });
                    }
                  }
                }

                // Sub-agent completed
                if (event.type === "user" && event.tool_use_result?.status === "completed" && currentTaskId) {
                  sendEvent({ type: "subtool_done", parentId: currentTaskId });
                  currentTaskId = null;
                }
              }

            } catch {
              // Ignore malformed JSON lines
            }
          }
        });

        proc.stderr.on("data", (data) => {
          console.error("[Claude stderr]:", data.toString());
        });

        proc.on("close", (code) => {
          if (code !== 0) {
            sendEvent({ type: "error", message: `Claude exited with code ${code}` });
          }
          controller.close();
        });

        proc.on("error", (err) => {
          sendEvent({ type: "error", message: err.message });
          controller.close();
        });

        proc.stdin.write(prompt);
        proc.stdin.end();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("[POST /api/chat] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
