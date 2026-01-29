import { NextResponse } from "next/server";
import { listSourceSummaries } from "@/lib/storage";

export async function GET(): Promise<NextResponse> {
  try {
    const sources = await listSourceSummaries();
    return NextResponse.json({ success: true, sources });
  } catch (error) {
    console.error("Error listing sources:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
