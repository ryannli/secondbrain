import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { getCurrentRootPath, getLibraryPath, getNotebookPath } from "@/lib/storage";

// Whitelisted targets only — never accept arbitrary paths from the client.
// `select` reveals the item selected in its parent folder so it can be
// dragged as a unit (e.g. onto chrome://extensions).
const TARGETS: Record<string, { resolve: () => string; select?: boolean }> = {
  root: { resolve: getCurrentRootPath },
  library: { resolve: getLibraryPath },
  notebook: { resolve: getNotebookPath },
  extension: { resolve: () => path.join(process.cwd(), "extension"), select: true },
};

function openerFor(targetPath: string, select?: boolean): [string, string[]] {
  switch (process.platform) {
    case "darwin":
      return select ? ["open", ["-R", targetPath]] : ["open", [targetPath]];
    case "win32":
      return select ? ["explorer", [`/select,${targetPath}`]] : ["explorer", [targetPath]];
    default:
      return ["xdg-open", [select ? path.dirname(targetPath) : targetPath]];
  }
}

/** Reveal a data folder in the OS file manager (local-first, made tangible). */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { target } = await request.json();
    const spec = TARGETS[target as string];
    if (!spec) {
      return NextResponse.json({ success: false, error: "Unknown target" }, { status: 400 });
    }

    const [cmd, args] = openerFor(spec.resolve(), spec.select);
    spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to open folder" },
      { status: 500 }
    );
  }
}
