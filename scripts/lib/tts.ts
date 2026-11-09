import { GoogleGenAI } from "@google/genai";

/** The newer 3.x TTS models answered intermittently with no audio, which changed the voice mid-video, so the steady one leads. */
export const TTS_MODELS = [process.env.DEMO_TTS_MODEL || "gemini-2.5-flash-preview-tts", "gemini-3.8-flash-tts", "gemini-3.1-flash-tts-preview"];
export const VOICE = process.env.DEMO_VOICE || "Sulafat";
export const SAMPLE_RATE = 24000;

/** Speak `text` with Gemini TTS. Returns raw 16-bit mono PCM at 24 kHz. Throws if every model fails. */
export async function speak(text: string, models: string[] = TTS_MODELS): Promise<{ pcm: Buffer; model: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const ai = new GoogleGenAI({ apiKey: key });
  let last: unknown;
  // Keep the same model (so the voice stays consistent across beats): retry it before falling back to the next.
  for (const model of models) {
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: [{ parts: [{ text: `Say in a calm, warm, measured voice: ${text}` }] }],
          config: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } },
        });
        const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
        if (!part?.inlineData?.data) throw new Error("no audio in response");
        return { pcm: Buffer.from(part.inlineData.data, "base64"), model };
      } catch (e) {
        last = e;
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
  }
  throw new Error(`Gemini TTS failed: ${(last as Error)?.message ?? last}`);
}

/** Wrap raw PCM in a WAV header so ffmpeg and players can read it. */
export function pcmToWav(pcm: Buffer, rate = SAMPLE_RATE): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
