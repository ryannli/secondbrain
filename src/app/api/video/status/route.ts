import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { getBilibiliCookiePath, loadUserConfig, normalizeVideoSettings } from "@/lib/storage";
import { bilibiliLoginName } from "@/lib/videoCapture";
import { whisperStatus } from "@/lib/whisper";

export async function GET(): Promise<NextResponse> {
  const settings = normalizeVideoSettings(await loadUserConfig());
  let cookie = "";
  try {
    cookie = (await fs.readFile(getBilibiliCookiePath(), "utf-8")).trim();
  } catch {
    cookie = "";
  }

  let nickname: string | null = null;
  if (cookie) {
    try {
      nickname = await bilibiliLoginName(cookie);
    } catch {
      nickname = null;
    }
  }
  const whisper = await whisperStatus();

  return NextResponse.json({
    success: true,
    cookieSaved: Boolean(cookie),
    nickname,
    whisperAvailable: whisper.available,
    whisperDetail: whisper.detail,
    whisperModel: settings.whisperModel,
    whisperLanguage: settings.whisperLanguage,
    deleteAudioAfter: settings.deleteAudioAfter,
  });
}
