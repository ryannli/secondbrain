import { promises as fs } from "fs";
import os from "os";
import path from "path";
import {
  BILIBILI_LOGIN_REQUIRED,
  BILIBILI_USER_AGENT,
  BilibiliVideo,
  TranscriptSegment,
  audioUrlFromPlayer,
  canonicalBilibiliUrl,
  extractBvId,
  imgKeyFromUrl,
  nextTranscriptStep,
  preferredSubtitle,
  segmentsFromSubtitleJson,
  segmentsToMarkdown,
  segmentsToSrt,
  signWbi,
  subtitleTracks,
  WHISPER_MISSING,
} from "./bilibili";
import {
  getBilibiliCookiePath,
  getLibraryPath,
  loadUserConfig,
  normalizeVideoSettings,
  writeSourceProgress,
} from "./storage";
import { transcribeAudio, whisperStatus } from "./whisper";

type FetchLike = typeof fetch;

async function readCookie(): Promise<string | null> {
  try {
    const text = (await fs.readFile(getBilibiliCookiePath(), "utf-8")).trim();
    return text || null;
  } catch {
    return null;
  }
}

async function fetchJson(url: string, cookie: string | undefined, fetchImpl: FetchLike): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    "User-Agent": BILIBILI_USER_AGENT,
    Referer: "https://www.bilibili.com",
  };
  if (cookie) headers.Cookie = cookie;
  const response = await fetchImpl(url, { headers });
  if (!response.ok) throw new Error(`Bilibili request failed (${response.status}).`);
  return response.json() as Promise<Record<string, unknown>>;
}

async function resolveBvId(input: string, fetchImpl: FetchLike): Promise<string> {
  const canonical = canonicalBilibiliUrl(input) ?? input.trim();
  if (/^BV[0-9A-Za-z]+$/.test(canonical) || /bilibili\.com/i.test(canonical)) {
    const direct = extractBvId(canonical);
    if (direct) return direct;
  }
  const response = await fetchImpl(canonical, { redirect: "follow" });
  const fromFinal = extractBvId(response.url);
  if (fromFinal) return fromFinal;
  throw new Error("This Bilibili link does not point at a video.");
}

async function resolveVideo(input: string, fetchImpl: FetchLike): Promise<BilibiliVideo> {
  const bvid = await resolveBvId(input, fetchImpl);
  const payload = await fetchJson(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, undefined, fetchImpl);
  if (payload.code !== 0) {
    throw new Error(typeof payload.message === "string" ? payload.message : "Bilibili could not find this video.");
  }
  const data = payload.data as {
    title?: string;
    owner?: { name?: string };
    cid?: number;
    duration?: number;
    pages?: { cid?: number }[];
  };
  const cid = data.cid || data.pages?.[0]?.cid;
  if (!cid) throw new Error("Bilibili did not return a playable video.");
  return {
    bvid,
    title: data.title || bvid,
    owner: data.owner?.name || "",
    cid,
    duration: data.duration || 0,
  };
}

async function wbiKeys(cookie: string | undefined, fetchImpl: FetchLike): Promise<{ imgKey: string; subKey: string } | null> {
  const payload = await fetchJson("https://api.bilibili.com/x/web-interface/nav", cookie, fetchImpl);
  const data = payload.data as { wbi_img?: { img_url?: string; sub_url?: string } } | undefined;
  const imgUrl = data?.wbi_img?.img_url;
  const subUrl = data?.wbi_img?.sub_url;
  if (!imgUrl || !subUrl) return null;
  return { imgKey: imgKeyFromUrl(imgUrl), subKey: imgKeyFromUrl(subUrl) };
}

async function playerPayload(video: BilibiliVideo, cookie: string | undefined, fetchImpl: FetchLike): Promise<unknown> {
  const plain = await fetchJson(
    `https://api.bilibili.com/x/player/v2?bvid=${video.bvid}&cid=${video.cid}&fnval=16`,
    cookie,
    fetchImpl
  );
  if (subtitleTracks(plain).length > 0) return plain;
  const keys = await wbiKeys(cookie, fetchImpl);
  if (!keys) return plain;
  const signed = signWbi({ bvid: video.bvid, cid: video.cid, fnval: 16 }, keys.imgKey, keys.subKey);
  const wbi = await fetchJson(`https://api.bilibili.com/x/player/wbi/v2?${signed}`, cookie, fetchImpl);
  if (subtitleTracks(wbi).length > 0 || !audioUrlFromPlayer(plain)) return wbi;
  return plain;
}

async function officialSegments(video: BilibiliVideo, cookie: string | undefined, fetchImpl: FetchLike): Promise<TranscriptSegment[]> {
  const payload = await playerPayload(video, cookie, fetchImpl);
  const track = preferredSubtitle(subtitleTracks(payload));
  if (!track) return [];
  try {
    const subtitle = await fetchJson(track.url, cookie, fetchImpl);
    return segmentsFromSubtitleJson(subtitle);
  } catch {
    return [];
  }
}

async function downloadAudio(url: string, dest: string, cookie: string, bvid: string): Promise<void> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": BILIBILI_USER_AGENT,
      Referer: `https://www.bilibili.com/video/${bvid}`,
      Cookie: cookie,
    },
  });
  if (!response.ok) throw new Error(`Bilibili audio download failed (${response.status}).`);
  await fs.writeFile(dest, Buffer.from(await response.arrayBuffer()));
}

export async function captureBilibiliVideo(
  id: string,
  input: string,
  fetchImpl: FetchLike = fetch
): Promise<{ title: string; markdown: string; srt: string; url: string }> {
  await writeSourceProgress(id, "Confirming the video");
  const video = await resolveVideo(input, fetchImpl);
  const cookie = await readCookie();
  await writeSourceProgress(id, "Checking official subtitles");
  const official = await officialSegments(video, undefined, fetchImpl);
  const withCookie = official.length === 0 && cookie
    ? await officialSegments(video, cookie, fetchImpl)
    : null;
  const step = nextTranscriptStep(official, Boolean(cookie), withCookie);
  let segments = official;
  if (step === "use-cookie" && withCookie) segments = withCookie;
  if (step === "need-login") throw new Error(BILIBILI_LOGIN_REQUIRED);
  if (step === "transcribe") {
    const status = await whisperStatus();
    if (!status.available) throw new Error(WHISPER_MISSING);
    const signedIn = await playerPayload(video, cookie || undefined, fetchImpl);
    const audioUrl = audioUrlFromPlayer(signedIn);
    if (!audioUrl) throw new Error("Bilibili did not provide an audio track for this video.");
    await writeSourceProgress(id, "Downloading audio");
    const audioPath = path.join(os.tmpdir(), `secondbrain-${id}.m4a`);
    const settings = normalizeVideoSettings(await loadUserConfig());
    try {
      await downloadAudio(audioUrl, audioPath, cookie || "", video.bvid);
      await writeSourceProgress(id, "Transcribing audio");
      segments = await transcribeAudio(audioPath, settings);
    } finally {
      if (settings.deleteAudioAfter) {
        await fs.unlink(audioPath).catch(() => undefined);
      } else {
        const dest = path.join(getLibraryPath(), id, "audio.m4a");
        await fs.rename(audioPath, dest).catch(async () => {
          await fs.copyFile(audioPath, dest).catch(() => undefined);
          await fs.unlink(audioPath).catch(() => undefined);
        });
      }
    }
  }

  if (segments.length === 0) throw new Error("No transcript text was produced for this video.");
  return {
    title: video.title,
    markdown: segmentsToMarkdown(video, segments),
    srt: segmentsToSrt(segments),
    url: `https://www.bilibili.com/video/${video.bvid}`,
  };
}

export async function bilibiliLoginName(cookie: string): Promise<string | null> {
  const payload = await fetchJson("https://api.bilibili.com/x/web-interface/nav", cookie, fetch);
  const data = payload.data as { isLogin?: boolean; uname?: string } | undefined;
  if (!data?.isLogin || !data.uname) return null;
  return data.uname;
}
