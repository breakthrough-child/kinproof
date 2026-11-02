import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { config } from "@/lib/config";

export const ACCEPTED_EXT = ["m4a", "mp3", "ogg", "opus", "wav", "webm", "mp4", "aac"] as const;
export const MAX_BYTES = 12 * 1024 * 1024;

export interface TranscribeProvider {
  name: string;
  transcribe(audio: Uint8Array, filename: string, mime: string): Promise<string>;
}

export function extOf(name: string): string {
  return (name.split(".").pop() || "").toLowerCase();
}

/** WhatsApp voice notes are Ogg/Opus with a .opus extension, which providers may not recognise by name. */
export function normalizeFilename(name: string): { filename: string; mime: string } {
  const ext = extOf(name);
  const map: Record<string, [string, string]> = {
    opus: ["ogg", "audio/ogg"],
    ogg: ["ogg", "audio/ogg"],
    m4a: ["m4a", "audio/mp4"],
    mp4: ["mp4", "audio/mp4"],
    aac: ["m4a", "audio/mp4"],
    mp3: ["mp3", "audio/mpeg"],
    wav: ["wav", "audio/wav"],
    webm: ["webm", "audio/webm"],
  };
  const [e, mime] = map[ext] ?? ["webm", "audio/webm"];
  return { filename: `voice.${e}`, mime };
}

async function postWhisper(url: string, key: string, model: string, audio: Uint8Array, filename: string, mime: string) {
  const form = new FormData();
  form.append("file", new Blob([audio as BlobPart], { type: mime }), filename);
  form.append("model", model);
  form.append("response_format", "json");
  const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!res.ok) throw Object.assign(new Error(`transcription failed (${res.status})`), { status: res.status });
  const j = (await res.json()) as { text?: string };
  return (j.text ?? "").trim();
}

const groq: TranscribeProvider = {
  name: "groq",
  transcribe: (a, f, m) => postWhisper("https://api.groq.com/openai/v1/audio/transcriptions", process.env.GROQ_API_KEY!, "whisper-large-v3-turbo", a, f, m),
};
const openai: TranscribeProvider = {
  name: "openai",
  transcribe: (a, f, m) => postWhisper("https://api.openai.com/v1/audio/transcriptions", process.env.OPENAI_API_KEY!, "whisper-1", a, f, m),
};

/** ffmpeg fallback for containers a provider rejects. No-op error if ffmpeg is not installed. */
export async function transcodeToMp3(audio: Uint8Array, filename: string): Promise<Uint8Array> {
  const dir = await mkdtemp(path.join(tmpdir(), "kp-"));
  try {
    const input = path.join(dir, `in.${extOf(filename) || "bin"}`);
    const output = path.join(dir, "out.mp3");
    await writeFile(input, audio);
    await new Promise<void>((resolve, reject) => {
      const p = spawn("ffmpeg", ["-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", output], { stdio: "ignore" });
      p.on("error", reject);
      p.on("exit", (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg exit ${c}`))));
    });
    return new Uint8Array(await readFile(output));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function getProvider(): TranscribeProvider | null {
  const c = config();
  if (c.transcribeProvider === "openai") return process.env.OPENAI_API_KEY ? openai : null;
  return process.env.GROQ_API_KEY ? groq : null;
}

export async function transcribeAudio(audio: Uint8Array, originalName: string, provider: TranscribeProvider | null = getProvider()) {
  if (!provider) {
    return { text: "", mock: true as const };
  }
  const { filename, mime } = normalizeFilename(originalName);
  try {
    return { text: await provider.transcribe(audio, filename, mime), mock: false as const };
  } catch (e) {
    if ((e as { status?: number }).status === 400) {
      const mp3 = await transcodeToMp3(audio, originalName);
      return { text: await provider.transcribe(mp3, "voice.mp3", "audio/mpeg"), mock: false as const };
    }
    throw e;
  }
}
