import { NextRequest, NextResponse } from "next/server";
import { addReadingTime } from "@/lib/storage";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = await request.json();
    const { seconds } = body as { seconds?: number };

    if (typeof seconds !== "number" || seconds <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid seconds value" },
        { status: 400 }
      );
    }

    const result = await addReadingTime(id, Math.round(seconds));
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, totalSeconds: result.totalSeconds });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
