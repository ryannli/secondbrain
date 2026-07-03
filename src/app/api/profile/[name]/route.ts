import { NextResponse } from "next/server";
import { loadProfileDoc, saveProfileDoc } from "@/lib/storage";
import { invalidateProfileCache } from "@/lib/claude";

type ProfileName = "USER" | "MEMORY";

const VALID_NAMES = new Set<ProfileName>(["USER", "MEMORY"]);

function validateName(name: string): ProfileName | null {
  const upper = name.toUpperCase() as ProfileName;
  return VALID_NAMES.has(upper) ? upper : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
): Promise<NextResponse> {
  const { name: rawName } = await params;
  const name = validateName(rawName);
  if (!name) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  try {
    const content = await loadProfileDoc(name);
    return NextResponse.json({ success: true, name, content });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load profile" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
): Promise<NextResponse> {
  const { name: rawName } = await params;
  const name = validateName(rawName);
  if (!name) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  try {
    const { content } = await request.json();
    if (typeof content !== "string") {
      return NextResponse.json({ success: false, error: "content must be a string" }, { status: 400 });
    }
    await saveProfileDoc(name, content);
    invalidateProfileCache();
    return NextResponse.json({ success: true, name, content });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to save profile" },
      { status: 500 }
    );
  }
}
