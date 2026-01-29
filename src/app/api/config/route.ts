import { NextResponse } from "next/server";
import path from "path";

export async function GET(): Promise<NextResponse> {
  const libraryPath = process.env.SECONDBRAIN_LIBRARY || path.join(process.cwd(), "library");

  return NextResponse.json({
    success: true,
    config: {
      libraryPath,
    },
  });
}
