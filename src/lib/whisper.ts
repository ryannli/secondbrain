import { spawn } from "child_process";
import path from "path";
import { CUDA_FAILED, TranscriptSegment, WHISPER_MISSING } from "./bilibili";
import { VideoSettings } from "./storage";

export const WHISPER_TIMEOUT_MS = 30 * 60 * 1000;

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type CommandRunner = (command: string, args: string[], timeoutMs: number) => Promise<CommandResult>;

export function whisperScriptPath(): string {
  return path.join(process.cwd(), "src", "lib", "transcribe_whisper.py");
}

export function whisperLaunchArgs(settings: VideoSettings, audioPath: string): string[] {
  return [whisperScriptPath(), settings.whisperModel, audioPath, settings.whisperLanguage];
}

export function runCommand(command: string, args: string[], timeoutMs: number): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error("Local transcription timed out after 30 minutes."));
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

export function segmentsFromWhisperStdout(stdout: string): TranscriptSegment[] {
  const match = stdout.match(/\[[\s\S]*\]/);
  if (!match) {
    throw new Error("Local transcription did not return a transcript.");
  }
  const parsed = JSON.parse(match[0]) as { start?: number; end?: number; text?: string }[];
  return parsed
    .map((item) => ({
      start: item.start ?? 0,
      end: item.end ?? 0,
      text: (item.text || "").trim(),
    }))
    .filter((item) => item.text);
}

export function whisperFailure(stderr: string): Error {
  if (/cuda|cublas|cudnn/i.test(stderr)) return new Error(CUDA_FAILED);
  if (/No module named ['"]faster_whisper['"]|ModuleNotFoundError/i.test(stderr)) return new Error(WHISPER_MISSING);
  const detail = stderr.trim().slice(0, 180);
  return new Error(detail ? `Local transcription failed. ${detail}` : "Local transcription failed.");
}

export async function whisperStatus(runner: CommandRunner = runCommand): Promise<{ available: boolean; detail: string }> {
  try {
    const result = await runner("python", ["-c", "import faster_whisper"], 20000);
    if (result.code === 0) return { available: true, detail: "faster-whisper is available." };
    return { available: false, detail: "faster-whisper is not installed." };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { available: false, detail: "Python is not installed." };
    }
    return { available: false, detail: "faster-whisper is not installed." };
  }
}

export async function transcribeAudio(
  audioPath: string,
  settings: VideoSettings,
  runner: CommandRunner = runCommand
): Promise<TranscriptSegment[]> {
  let result: CommandResult;
  try {
    result = await runner("python", whisperLaunchArgs(settings, audioPath), WHISPER_TIMEOUT_MS);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error(WHISPER_MISSING);
    throw error;
  }
  if (result.code !== 0) throw whisperFailure(result.stderr);
  const segments = segmentsFromWhisperStdout(result.stdout);
  if (segments.length === 0) throw new Error("No transcript text was produced for this video.");
  return segments;
}
