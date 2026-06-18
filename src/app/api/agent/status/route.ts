import { NextResponse } from "next/server";
import { getAgentStatuses, getConfiguredAgentProvider } from "@/lib/agent";

export async function GET(): Promise<NextResponse> {
  try {
    const [selectedProvider, statuses] = await Promise.all([
      getConfiguredAgentProvider(),
      getAgentStatuses(),
    ]);

    return NextResponse.json({
      success: true,
      selectedProvider,
      statuses,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load agent status" },
      { status: 500 }
    );
  }
}
