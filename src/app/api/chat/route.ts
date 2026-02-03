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
}

/**
 * POST /api/chat
 * Chat with Claude, with optional context (streaming response)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, contexts, history, currentPath } = body as {
      message: string;
      contexts?: ChatContext[];
      history?: ChatMessage[];
      currentPath?: string;
    };

    if (!message && (!contexts || contexts.length === 0)) {
      return new Response(
        JSON.stringify({ success: false, error: "Message or context required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build the prompt - detailed instructions are in user_data/CLAUDE.md
    let prompt = `You are an Agent in a knowledge management app called "Second Brain".

Your workspace:
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
        prompt += `\nUser is viewing source **${sourceId}**.\n`;
        prompt += `Source folder: \`./library/${sourceId}/\` - you can read/edit files there.\n`;
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

    // Add conversation history
    if (history && history.length > 0) {
      prompt += "\n## Conversation History\n";
      for (const msg of history) {
        prompt += `\n${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}\n`;
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
          "--permission-mode", "acceptEdits",  // Allow file operations (sandboxed to cwd)
        ], {
          stdio: ["pipe", "pipe", "pipe"],
          cwd: userDataPath,  // Agent can read user_data, write to library/
        });

        const encoder = new TextEncoder();
        let buffer = "";

        proc.stdout.on("data", (data) => {
          buffer += data.toString();

          // Process complete JSON lines
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

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
                controller.enqueue(encoder.encode(event.event.delta.text));
              }

              // Capture full tool details from assistant message (has complete input)
              // Skip if this is a sub-agent event (has parent_tool_use_id) - those are handled separately
              if (event.type === "assistant" && event.message?.content && !event.parent_tool_use_id) {
                for (const block of event.message.content) {
                  if (block.type === "tool_use") {
                    const toolName = block.name;
                    const input = block.input || {};

                    // Format tool details based on tool type
                    let detail = "";
                    if (toolName === "Task") {
                      const subagentType = input.subagent_type || "agent";
                      detail = `${subagentType}: ${input.description || ""}`;
                    } else if (toolName === "Bash") {
                      detail = input.command || "";
                    } else if (toolName === "Read" || toolName === "Write" || toolName === "Edit") {
                      detail = input.file_path || "";
                    } else if (toolName === "Glob") {
                      detail = input.pattern || "";
                    } else if (toolName === "Grep") {
                      detail = input.pattern || "";
                    } else if (toolName === "TodoWrite" || toolName === "TaskCreate") {
                      detail = input.subject || input.description || "";
                    } else {
                      // Generic: show first string value in input
                      const firstVal = Object.values(input).find(v => typeof v === "string");
                      detail = (firstVal as string) || "";
                    }

                    controller.enqueue(encoder.encode(`\n[[TOOL:${toolName}:${detail}]]\n`));
                  }
                }
              }

              // Capture tool results (for showing Bash output, etc.)
              if (event.type === "user" && event.message?.content) {
                for (const block of event.message.content) {
                  if (block.type === "tool_result" && block.content) {
                    // Only show short results (e.g., error messages, brief output)
                    const resultText = typeof block.content === "string"
                      ? block.content
                      : JSON.stringify(block.content);
                    // Skip very long results (file contents, etc.)
                    if (resultText.length > 0 && resultText.length < 500) {
                      controller.enqueue(encoder.encode(`[[TOOL_RESULT:${resultText}]]\n`));
                    }
                  }
                }
              }

              // Capture sub-agent progress (has parent_tool_use_id)
              if (event.parent_tool_use_id) {
                // Tool result from sub-agent
                if (event.type === "user" && event.tool_use_result) {
                  const result = event.tool_use_result;
                  // Show what the sub-agent completed
                  if (result.status === "completed") {
                    controller.enqueue(encoder.encode(`\n[[SUBTASK_DONE]]\n`));
                  }
                }
                // Sub-agent's own tool calls
                if (event.type === "assistant" && event.message?.content) {
                  for (const block of event.message.content) {
                    if (block.type === "tool_use") {
                      const detail = block.input?.command || block.input?.pattern || block.input?.file_path || "";
                      controller.enqueue(encoder.encode(`[[SUBTOOL:${block.name}:${detail}]]\n`));
                    }
                  }
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
            controller.enqueue(encoder.encode(`\n\n[Error: Claude exited with code ${code}]`));
          }
          controller.close();
        });

        proc.on("error", (err) => {
          controller.enqueue(encoder.encode(`\n\n[Error: ${err.message}]`));
          controller.close();
        });

        proc.stdin.write(prompt);
        proc.stdin.end();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
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
