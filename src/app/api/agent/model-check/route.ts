import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { isAgentProvider } from "@/lib/agentTypes";
import { buildAgentCommandSpec } from "@/lib/agentProviders";
import { getCurrentRootPath } from "@/lib/storage";

/**
 * Neither CLI can enumerate models programmatically, but both can validate
 * one: run a minimal prompt with the requested model and report whether the
 * CLI accepted it.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { provider, model } = await request.json();
    if (!isAgentProvider(provider) || typeof model !== "string" || !model.trim()) {
      return NextResponse.json({ success: false, error: "provider and model are required" }, { status: 400 });
    }

    const rootPath = getCurrentRootPath();
    const spec = buildAgentCommandSpec(provider, "text", { rootPath, model: model.trim() });

    const result = await new Promise<{ ok: boolean; message: string }>((resolve) => {
      const proc = spawn(spec.command, spec.args, {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: rootPath,
        env: spec.env,
      });
      let stderr = "";
      let stdout = "";
      const timeout = setTimeout(() => {
        proc.kill();
        resolve({ ok: false, message: "Timed out — the model may be valid but slow to start." });
      }, 60_000);

      proc.stdout.on("data", (d) => (stdout += d.toString()));
      proc.stderr.on("data", (d) => (stderr += d.toString()));
      proc.on("error", (err) => {
        clearTimeout(timeout);
        resolve({ ok: false, message: err.message });
      });
      proc.on("close", (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve({ ok: true, message: "Model responded." });
        } else {
          const detail = (stderr || stdout).trim().split("\n").slice(-3).join(" ").slice(0, 300);
          resolve({ ok: false, message: detail || `CLI exited with code ${code}` });
        }
      });

      proc.stdin.write("Reply with the single word: ok");
      proc.stdin.end();
    });

    return NextResponse.json({ success: result.ok, message: result.message });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Model check failed" },
      { status: 500 }
    );
  }
}
