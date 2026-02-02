import { NextRequest, NextResponse } from "next/server";
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
 * Call Claude CLI for chat
 */
async function callClaude(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("claude", ["--print", "--output-format", "text"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || `Claude exited with code ${code}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

/**
 * POST /api/chat
 * Chat with Claude, with optional context
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
      return NextResponse.json(
        { success: false, error: "Message or context required" },
        { status: 400 }
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

    const response = await callClaude(prompt);

    return NextResponse.json({
      success: true,
      response,
    });
  } catch (error) {
    console.error("[POST /api/chat] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
