import { describe, expect, it } from "vitest";
import {
  canonicalBilibiliUrl,
  extractBvId,
  nextTranscriptStep,
  sampleTranscript,
  segmentsToMarkdown,
  segmentsToSrt,
  signWbi,
} from "@/lib/bilibili";
import { segmentsFromWhisperStdout, whisperFailure, whisperLaunchArgs } from "@/lib/whisper";
import { normalizeVideoSettings } from "@/lib/storage";
import { CUDA_FAILED, WHISPER_MISSING } from "@/lib/bilibili";

describe("bilibili links", () => {
  it("recognizes a video page, a short link, and a bare BV id", () => {
    expect(extractBvId("https://www.bilibili.com/video/BV1H4sJ6XEF5")).toBe("BV1H4sJ6XEF5");
    expect(canonicalBilibiliUrl("BV1H4sJ6XEF5")).toBe("https://www.bilibili.com/video/BV1H4sJ6XEF5");
    expect(canonicalBilibiliUrl("https://b23.tv/abc")).toBe("https://b23.tv/abc");
    expect(canonicalBilibiliUrl("https://example.com/BV1H4sJ6XEF5")).toBeNull();
  });

  it("asks for a cookie when official subtitles are empty", () => {
    expect(nextTranscriptStep([], false, null)).toBe("need-login");
    expect(nextTranscriptStep([], true, [])).toBe("transcribe");
    expect(nextTranscriptStep([{ start: 0, end: 1, text: "hello" }], false, null)).toBe("use-official");
    expect(nextTranscriptStep([], true, [{ start: 0, end: 1, text: "signed in" }])).toBe("use-cookie");
  });

  it("writes markdown and srt from the same segments", () => {
    const segments = [{ start: 12, end: 15.5, text: "亲密关系" }];
    const markdown = segmentsToMarkdown({ owner: "橙海飞鸟", duration: 1717 }, segments);
    expect(markdown).toContain("Uploader: 橙海飞鸟");
    expect(markdown).toContain("00:00:12");
    expect(markdown).toContain("亲密关系");
    expect(segmentsToSrt(segments)).toContain("00:00:12,000 --> 00:00:15,500");
  });

  it("samples the opening, middle, and ending of a long transcript", () => {
    const text = `${"a".repeat(10000)}${"b".repeat(10000)}${"c".repeat(10000)}`;
    const sample = sampleTranscript(text, 1800);
    expect(sample.startsWith("a")).toBe(true);
    expect(sample.endsWith("c")).toBe(true);
    expect(sample).toContain("[...]");
    expect(sample.length).toBeLessThan(text.length);
  });

  it("signs a wbi query without copying a placeholder id", () => {
    const signed = signWbi({ bvid: "BV1H4sJ6XEF5", cid: 1 }, "a".repeat(32), "b".repeat(32), 1_700_000_000_000);
    expect(signed).toContain("wts=1700000000");
    expect(signed).toMatch(/w_rid=[0-9a-f]{32}$/);
  });
});

describe("whisper command", () => {
  it("asks the local script for large-v3 on the audio file", () => {
    const args = whisperLaunchArgs(
      normalizeVideoSettings({}),
      "C:/tmp/secondbrain-demo.m4a"
    );
    expect(args[0]).toMatch(/transcribe_whisper\.py$/);
    expect(args.slice(1)).toEqual(["large-v3", "C:/tmp/secondbrain-demo.m4a", "zh"]);
  });

  it("parses transcript json and keeps CUDA failures on CUDA", () => {
    expect(segmentsFromWhisperStdout('log\n[{"start":1,"end":2,"text":"你好"}]')).toEqual([
      { start: 1, end: 2, text: "你好" },
    ]);
    expect(whisperFailure("CUDA out of memory").message).toBe(CUDA_FAILED);
    expect(whisperFailure("ModuleNotFoundError: No module named 'faster_whisper'").message).toBe(WHISPER_MISSING);
  });
});
