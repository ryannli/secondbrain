import { NextRequest } from "next/server";
import { spawn } from "child_process";
import path from "path";

/**
 * Get the library path - this is the ONLY directory the Agent can access
 */
function getLibraryPath(): string {
  const root = process.env.SECONDBRAIN_ROOT || path.join(process.cwd(), "user_data");
  return process.env.SECONDBRAIN_LIBRARY || path.join(root, "library");
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
    const { message, contexts, history } = body as {
      message: string;
      contexts?: ChatContext[];
      history?: ChatMessage[];
    };

    if (!message && (!contexts || contexts.length === 0)) {
      return new Response(
        JSON.stringify({ success: false, error: "Message or context required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build the prompt
    let prompt = `You are an Agent in a knowledge management app called "Second Brain".

Your workspace is the user's library directory. You can:
1. **Read and explore** - Browse the library structure, read sources and their analyses
2. **Organize** - Move sources between folders, create new folders, rename things
3. **Analyze** - Help understand content, find connections between sources
4. **Answer questions** - About the library content or general knowledge

IMPORTANT: You are sandboxed to ONLY the library directory. You cannot access files outside this directory.

The library structure:
- Each source is a folder with: original.json (metadata), content.md (extracted text), analysis.json (AI analysis)
- Sources can be organized into user-created folders
- Moving a source = moving its entire folder

Be concise but thorough. Use markdown formatting when helpful.
`;

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
    // Agent is sandboxed to ONLY the library directory
    const libraryPath = getLibraryPath();

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
          cwd: libraryPath,  // Restrict Claude to library directory only
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

              // Send tool usage as a special marker for frontend to parse
              if (
                event.type === "stream_event" &&
                event.event?.type === "content_block_start" &&
                event.event?.content_block?.type === "tool_use"
              ) {
                const toolName = event.event.content_block.name;
                controller.enqueue(encoder.encode(`\n[[TOOL:${toolName}]]\n`));
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
