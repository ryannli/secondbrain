import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { getCurrentRootPath, getLibraryPath, getStudioPath } from "@/lib/storage";

// Whitelisted targets only — never accept arbitrary paths from the client.
const TARGETS: Record<string, () => string> = {
  root: getCurrentRootPath,
  library: getLibraryPath,
  studio: getStudioPath,
};

function openerFor(targetPath: string): [string, string[]] {
  switch (process.platform) {
    case "darwin":
      return ["open", [targetPath]];
    case "win32":
      return ["explorer", [targetPath]];
    default:
      return ["xdg-open", [targetPath]];
  }
}

/** Reveal a data folder in the OS file manager (local-first, made tangible). */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { target } = await request.json();
    const resolve = TARGETS[target as string];
    if (!resolve) {
      return NextResponse.json({ success: false, error: "Unknown target" }, { status: 400 });
    }

    const [cmd, args] = openerFor(resolve());
    spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to open folder" },
      { status: 500 }
    );
  }
}
