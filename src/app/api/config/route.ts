import { NextResponse } from "next/server";
import { loadUserConfig, saveUserConfig, getCurrentRootPath, UserConfig } from "@/lib/storage";
import path from "path";

export async function GET(): Promise<NextResponse> {
  try {
    const rootPath = getCurrentRootPath();
    const userConfig = await loadUserConfig();

    return NextResponse.json({
      success: true,
      config: {
        rootPath,
        libraryPath: path.join(rootPath, "library"),
        ...userConfig,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load config" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const updates: Partial<UserConfig> = await request.json();
    const currentConfig = await loadUserConfig();
    const newConfig = { ...currentConfig, ...updates };
    await saveUserConfig(newConfig);

    return NextResponse.json({ success: true, config: newConfig });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to save config" },
      { status: 500 }
    );
  }
}
