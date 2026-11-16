"use client";

import React, { useEffect, useState } from "react";
import { theme } from "@/lib/theme";

interface VideoStatus {
  cookieSaved: boolean;
  nickname: string | null;
  whisperAvailable: boolean;
  whisperDetail: string;
  whisperModel: string;
  whisperLanguage: string;
  deleteAudioAfter: boolean;
}

export function VideoSettings({ palette }: { palette: Record<number, string> }) {
  const [status, setStatus] = useState<VideoStatus | null>(null);
  const [cookie, setCookie] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadStatus = async () => {
    const res = await fetch("/api/video/status");
    const data = await res.json();
    if (data.success) {
      setStatus({
        cookieSaved: data.cookieSaved,
        nickname: data.nickname,
        whisperAvailable: data.whisperAvailable,
        whisperDetail: data.whisperDetail,
        whisperModel: data.whisperModel,
        whisperLanguage: data.whisperLanguage,
        deleteAudioAfter: data.deleteAudioAfter,
      });
    }
  };

  useEffect(() => {
    loadStatus().catch(() => setMessage("Could not check video tools."));
  }, []);

  const saveCookie = async () => {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/video/cookie", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to save the cookie.");
      setCookie("");
      setMessage("Cookie saved on this computer.");
      await loadStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save the cookie.");
    } finally {
      setBusy(false);
    }
  };

  const removeCookie = async () => {
    setBusy(true);
    setMessage("");
    try {
      await fetch("/api/video/cookie", { method: "DELETE" });
      setMessage("Bilibili cookie removed.");
      await loadStatus();
    } finally {
      setBusy(false);
    }
  };

  const saveDeleteAudio = async (deleteAudioAfter: boolean) => {
    if (!status) return;
    setStatus({ ...status, deleteAudioAfter });
    await fetch("/api/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video: {
          whisperModel: status.whisperModel,
          whisperLanguage: status.whisperLanguage,
          deleteAudioAfter,
        },
      }),
    });
  };

  const loginText = !status
    ? "Checking"
    : status.nickname
      ? `Signed in as ${status.nickname}`
      : status.cookieSaved
        ? "Cookie saved, but Bilibili did not accept it."
        : "Not signed in";

  return (
    <div className="mt-8 pt-5 border-t" style={{ borderColor: theme.border }}>
      <label className="block text-sm font-medium mb-1">Video</label>
      <p className="text-xs mb-4" style={{ color: theme.textMuted }}>
        Bilibili links are captured as a transcript. Official subtitles are used first. A saved cookie is only used when those are empty.
      </p>

      <div className="mb-4">
        <div className="text-sm mb-2">{loginText}</div>
        <textarea
          value={cookie}
          onChange={(event) => setCookie(event.target.value)}
          placeholder="Paste the Cookie header from your browser"
          rows={3}
          className="w-full px-3 py-2 text-sm border rounded-lg"
          style={{ borderColor: theme.border }}
        />
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={saveCookie}
            disabled={busy || !cookie.trim()}
            className="px-3 py-2 rounded-lg text-white text-sm disabled:opacity-50"
            style={{ backgroundColor: palette[500] }}
          >
            Update cookie
          </button>
          {status?.cookieSaved && (
            <button
              type="button"
              onClick={removeCookie}
              disabled={busy}
              className="px-3 py-2 rounded-lg border text-sm disabled:opacity-50"
              style={{ borderColor: theme.border, color: theme.textMuted }}
            >
              Remove
            </button>
          )}
        </div>
        <p className="text-xs mt-2" style={{ color: theme.textMuted }}>
          The cookie stays in user_data/bilibili.cookies.txt on this computer. It is not written onto the card.
        </p>
      </div>

      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm">faster-whisper {status?.whisperModel || "large-v3"} · CUDA · {status?.whisperLanguage === "zh" ? "Chinese" : status?.whisperLanguage || "Chinese"}</div>
          <p className="text-xs mt-1" style={{ color: status?.whisperAvailable ? palette[600] : theme.textMuted }}>
            {status?.whisperDetail || "Checking local transcription..."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadStatus().catch(() => setMessage("Could not check video tools."))}
          className="px-3 py-2 rounded-lg border text-sm"
          style={{ borderColor: theme.border, color: theme.textMuted }}
        >
          Check
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={status?.deleteAudioAfter !== false}
          onChange={(event) => saveDeleteAudio(event.target.checked)}
        />
        Delete audio after transcription
      </label>
      {message && <p className="text-xs mt-3" style={{ color: palette[600] }}>{message}</p>}
    </div>
  );
}
