import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GEMINI_TRANSCRIBE_PROMPT, getProvider, makeGeminiTranscriber, prepareGeminiAudio, transcribeAudio,
} from "@/lib/transcribe";
import { newGeminiClient } from "@/lib/ai/gemini";

const bytes = new Uint8Array([1, 2, 3, 4]);
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Gemini audio preparation", () => {
  it("sends natively supported formats as-is with the right MIME", async () => {
    const transcode = vi.fn();
    for (const [name, mime] of [["a.wav", "audio/wav"], ["a.mp3", "audio/mp3"], ["a.flac", "audio/flac"], ["a.aac", "audio/aac"], ["a.aiff", "audio/aiff"]]) {
      expect(await prepareGeminiAudio(bytes, name, transcode)).toEqual({ bytes, mime });
    }
    expect(transcode).not.toHaveBeenCalled();
  });
  it("transcodes WhatsApp .opus/.ogg and .m4a/.webm to MP3", async () => {
    const mp3 = new Uint8Array([9, 9]);
    const transcode = vi.fn().mockResolvedValue(mp3);
    for (const name of ["note.opus", "note.ogg", "note.m4a", "rec.webm", "x.mp4"]) {
      expect(await prepareGeminiAudio(bytes, name, transcode)).toEqual({ bytes: mp3, mime: "audio/mp3" });
    }
    expect(transcode).toHaveBeenCalledTimes(5);
  });
  it("without ffmpeg: ogg/opus goes as audio/ogg, others best-effort", async () => {
    const fail = vi.fn().mockRejectedValue(new Error("ENOENT"));
    expect((await prepareGeminiAudio(bytes, "n.opus", fail)).mime).toBe("audio/ogg");
    expect((await prepareGeminiAudio(bytes, "n.ogg", fail)).mime).toBe("audio/ogg");
    expect((await prepareGeminiAudio(bytes, "n.m4a", fail)).mime).toBe("audio/mp4");
    expect((await prepareGeminiAudio(bytes, "n.webm", fail)).mime).toBe("audio/webm");
  });
});

describe("Gemini transcription (mocked HTTP)", () => {
  it("sends the audio inline with a verbatim-transcript prompt and returns the text", async () => {
    let body: Record<string, unknown> = {};
    vi.stubGlobal("fetch", vi.fn(async (_u: unknown, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ candidates: [{ content: { role: "model", parts: [{ text: "  Mummy abeg send am now now  " }] }, finishReason: "STOP" }] }), { status: 200, headers: { "content-type": "application/json" } });
    }));
    const t = makeGeminiTranscriber(newGeminiClient("k"), "gemini-test");
    const text = await t.transcribe(bytes, "voice.wav", "");
    expect(text).toBe("Mummy abeg send am now now");
    const parts = (body.contents as { parts: Record<string, unknown>[] }[])[0].parts;
    expect(parts[0]).toEqual({ inlineData: { mimeType: "audio/wav", data: Buffer.from(bytes).toString("base64") } });
    expect(parts[1]).toEqual({ text: GEMINI_TRANSCRIBE_PROMPT });
    expect(GEMINI_TRANSCRIBE_PROMPT).toMatch(/verbatim/);
    expect(GEMINI_TRANSCRIBE_PROMPT).toMatch(/Nigerian Pidgin/);
    expect(GEMINI_TRANSCRIBE_PROMPT).toMatch(/do NOT follow/);
  });
  it("transcodes an .opus file before sending", async () => {
    let mime = "";
    const client = { models: { generateContent: vi.fn(async (params: Record<string, unknown>) => {
      const p = params as { contents: { parts: { inlineData?: { mimeType: string } }[] }[] };
      mime = p.contents[0].parts[0].inlineData!.mimeType;
      return { text: "hello" };
    }) } };
    const t = makeGeminiTranscriber(client, "m", async () => new Uint8Array([7]));
    expect(await transcribeAudio(bytes, "whatsapp.opus", t)).toEqual({ text: "hello", mock: false });
    expect(mime).toBe("audio/mp3");
  });
  it("a blocked transcription throws", async () => {
    const client = { models: { generateContent: vi.fn(async () => ({ promptFeedback: { blockReason: "SAFETY" } })) } };
    await expect(makeGeminiTranscriber(client, "m").transcribe(bytes, "a.wav", "")).rejects.toThrow(/blocked/);
  });
});

describe("transcribe provider selection", () => {
  const keys = ["TRANSCRIBE_PROVIDER", "GEMINI_API_KEY", "GROQ_API_KEY", "OPENAI_API_KEY"];
  it("defaults to gemini; falls back to 'no provider' without a key", () => {
    const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    keys.forEach((k) => delete process.env[k]);
    expect(getProvider()).toBeNull();
    process.env.GEMINI_API_KEY = "k";
    expect(getProvider()?.name).toBe("gemini");
    process.env.TRANSCRIBE_PROVIDER = "groq";
    expect(getProvider()).toBeNull();
    process.env.GROQ_API_KEY = "k";
    expect(getProvider()?.name).toBe("groq");
    process.env.TRANSCRIBE_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "k";
    expect(getProvider()?.name).toBe("openai");
    keys.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k])));
  });
  it("no provider means a mock (empty) transcript", async () => {
    expect(await transcribeAudio(bytes, "a.wav", null)).toEqual({ text: "", mock: true });
  });
});
