import { NextResponse } from "next/server";
import { listStudioDocuments, listStudioFolders } from "@/lib/storage";

export async function GET(): Promise<NextResponse> {
  try {
    const [documents, folders] = await Promise.all([
      listStudioDocuments(),
      listStudioFolders(),
    ]);
    return NextResponse.json({ success: true, documents, folders });
  } catch (error) {
    console.error("Error listing studio:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
