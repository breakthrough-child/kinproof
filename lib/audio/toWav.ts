"use client";
import { closeAudioContext, createAudioContext, getOfflineAudioContextCtor } from "@/lib/browser";

/** Encode mono float samples as a 16-bit PCM WAV blob. */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buffer);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Decode any audio the browser understands (webm/opus, m4a, mp3, ogg...) and re-encode as 16 kHz mono WAV,
 * which every speech-to-text provider accepts and which needs no server-side ffmpeg. Throws if the browser can't decode it.
 */
export async function toWav16k(blob: Blob): Promise<Blob> {
  const ctx = createAudioContext();
  const Offline = getOfflineAudioContextCtor();
  if (!ctx || !Offline) {
    closeAudioContext(ctx);
    throw new Error("Audio decoding is not supported in this browser");
  }
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const rate = 16000;
    const off = new Offline(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    const rendered = await off.startRendering();
    return encodeWav(rendered.getChannelData(0), rate);
  } finally {
    closeAudioContext(ctx);
  }
}
