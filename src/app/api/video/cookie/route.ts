import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getBilibiliCookiePath } from "@/lib/storage";

function cleanCookie(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cookie = value.replace(/[\r\n]/g, "").trim();
  if (!cookie || cookie.length > 8192 || !cookie.includes("=")) return null;
  return cookie;
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const cookie = cleanCookie(body?.cookie);
    if (!cookie) {
      return NextResponse.json(
        { success: false, error: "Paste the Cookie header from a signed-in Bilibili browser session." },
        { status: 400 }
      );
    }
    const cookiePath = getBilibiliCookiePath();
    await fs.mkdir(path.dirname(cookiePath), { recursive: true });
    await fs.writeFile(cookiePath, `${cookie}\n`, { encoding: "utf-8", mode: 0o600 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to save the Bilibili cookie." }, { status: 500 });
  }
}

export async function DELETE(): Promise<NextResponse> {
  await fs.unlink(getBilibiliCookiePath()).catch(() => undefined);
  return NextResponse.json({ success: true });
}
