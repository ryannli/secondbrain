import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { isAgentProvider } from "@/lib/agentTypes";
import { AGENT_CLI_PROVIDERS } from "@/lib/agentProviders";

export interface AgentModelInfo {
  id: string;
  label: string;
  desc?: string;
}

/**
 * List models a provider's CLI reports as available, queried live from the
 * CLI on every request so the app never maintains a stale model list.
 * Codex exposes this via `codex debug models`; providers without such a
 * command return an empty list and the UI falls back to manual entry.
 * Debug-namespaced commands can change shape between CLI versions, so
 * every failure degrades to [].
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const provider = request.nextUrl.searchParams.get("provider");
  if (!isAgentProvider(provider)) {
    return NextResponse.json({ success: false, error: "Unknown provider" }, { status: 400 });
  }

  const definition = AGENT_CLI_PROVIDERS[provider];
  if (!definition.listModelsArgs) {
    return NextResponse.json({ success: true, models: [] });
  }

  const models = await new Promise<AgentModelInfo[]>((resolve) => {
    const proc = spawn(definition.resolveCommand(process.env), definition.listModelsArgs!, {
      stdio: ["ignore", "pipe", "pipe"],
      env: definition.sanitizeEnv(process.env),
    });
    let stdout = "";
    const timeout = setTimeout(() => {
      proc.kill();
      resolve([]);
    }, 15_000);

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.on("error", () => {
      clearTimeout(timeout);
      resolve([]);
    });
    proc.on("close", () => {
      clearTimeout(timeout);
      try {
        const parsed = JSON.parse(stdout) as {
          models?: { slug?: string; display_name?: string; description?: string; visibility?: string }[];
        };
        resolve(
          (parsed.models ?? [])
            .filter((m) => m.slug && m.visibility === "list")
            .map((m) => ({ id: m.slug!, label: m.display_name || m.slug!, desc: m.description }))
        );
      } catch {
        resolve([]);
      }
    });
  });

  return NextResponse.json({ success: true, models });
}
