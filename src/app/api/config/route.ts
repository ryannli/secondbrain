import { NextResponse } from "next/server";
import {
  getCurrentRootPath,
  getRootPathSource,
  isRootPathLocked,
  loadUserConfig,
  saveLocalRootPath,
  saveUserConfig,
  UserConfig,
} from "@/lib/storage";
import { isAgentProvider } from "@/lib/agentTypes";
import path from "path";

type ConfigPatch = Partial<UserConfig> & { rootPath?: string };

export async function GET(): Promise<NextResponse> {
  try {
    const rootPath = getCurrentRootPath();
    const userConfig = await loadUserConfig();

    return NextResponse.json({
      success: true,
      app: "secondbrain", // identity marker for the extension's server discovery
      config: {
        rootPath,
        rootPathSource: getRootPathSource(),
        rootPathLocked: isRootPathLocked(),
        libraryPath: path.join(rootPath, "library"),
        searchConfigured: Boolean(process.env.BRAVE_SEARCH_API_KEY),
        extensionPath: path.join(process.cwd(), "extension"),
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
    const updates: ConfigPatch = await request.json();
    if (updates.agentProvider !== undefined && !isAgentProvider(updates.agentProvider)) {
      return NextResponse.json(
        { success: false, error: "Invalid agent provider" },
        { status: 400 }
      );
    }

    const currentConfig = await loadUserConfig();
    const { rootPath, ...configUpdates } = updates;

    if (rootPath !== undefined) {
      if (isRootPathLocked()) {
        return NextResponse.json(
          { success: false, error: "Data location is controlled by SECONDBRAIN_ROOT for this process" },
          { status: 400 }
        );
      }

      await saveLocalRootPath(rootPath);
    }

    const newConfig = { ...currentConfig, ...configUpdates };
    await saveUserConfig(newConfig);
    const currentRootPath = getCurrentRootPath();

    return NextResponse.json({
      success: true,
      config: {
        rootPath: currentRootPath,
        rootPathSource: getRootPathSource(),
        rootPathLocked: isRootPathLocked(),
        libraryPath: path.join(currentRootPath, "library"),
        ...newConfig,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to save config" },
      { status: 500 }
    );
  }
}
