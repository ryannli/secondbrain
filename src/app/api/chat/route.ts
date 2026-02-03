import { NextRequest } from "next/server";
import { spawn } from "child_process";

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
    let prompt = `You are a helpful assistant in a knowledge management app called "Second Brain".

Your capabilities:
1. **Explain concepts** - Help the user understand content they've selected
2. **Analyze content** - Provide insights, critique, or connections
3. **Answer questions** - About the selected text or general knowledge
4. **Suggest actions** - Like organizing, categorizing, or finding related content

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
    const stream = new ReadableStream({
      start(controller) {
        const proc = spawn("claude", [
          "--print",
          "--output-format", "stream-json",
          "--verbose",
          "--include-partial-messages",
        ], {
          stdio: ["pipe", "pipe", "pipe"],
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
