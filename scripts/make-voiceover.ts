/**
 * Generates one WAV per narration beat with Gemini text-to-speech into demo-output/audio/.
 * Cached: a beat is only regenerated when its text or voice changed, because the free tier allows only
 * about 10 TTS requests per model per day.
 *
 *   pnpm voiceover                 generate whatever is missing or changed
 *   pnpm voiceover -- --only a-send1,close     regenerate just these beats
 *   pnpm voiceover -- --force      regenerate everything
 *
 * If TTS fails the script exits 0 and the composer falls back to captions only.
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { BEATS } from "./demo-beats.ts";
import { pcmToWav, speak, SAMPLE_RATE, TTS_MODELS, VOICE } from "./lib/tts.ts";

const OUT = new URL("../demo-output/audio/", import.meta.url).pathname;
await mkdir(OUT, { recursive: true });
const args = process.argv.slice(2);
const force = args.includes("--force");
const only = new Set((args[args.indexOf("--only") + 1] ?? "").split(",").filter(Boolean));
type Entry = { text: string; voice: string; model: string; seconds: number };
const manifest: Record<string, Entry> = await readFile(`${OUT}manifest.json`, "utf8").then(JSON.parse).catch(() => ({}));

let failed = false;
for (const b of BEATS) {
  const have = manifest[b.id];
  const exists = await stat(`${OUT}${b.id}.wav`).then(() => true, () => false);
  const fresh = exists && have && have.text === b.narration && have.voice === VOICE;
  if (only.size ? !only.has(b.id) : fresh && !force) { console.log(`${b.id.padEnd(10)} kept (${have?.seconds.toFixed(1)}s, ${have?.model})`); continue; }
  try {
    const { pcm, model } = await speak(b.narration, TTS_MODELS);
    const seconds = pcm.length / 2 / SAMPLE_RATE;
    await writeFile(`${OUT}${b.id}.wav`, pcmToWav(pcm));
    manifest[b.id] = { text: b.narration, voice: VOICE, model, seconds };
    await writeFile(`${OUT}manifest.json`, JSON.stringify(manifest, null, 2));
    console.log(`${b.id.padEnd(10)} ${seconds.toFixed(1).padStart(5)}s  (${model}, voice ${VOICE})`);
  } catch (e) {
    failed = true;
    console.error(`${b.id}: TTS failed (${(e as Error).message.slice(0, 160)}). Keeping any existing clip.`);
  }
}
const models = new Set(Object.values(manifest).map((m) => m.model));
if (models.size > 1) console.warn(`Note: clips come from ${models.size} different TTS models (${[...models].join(", ")}). Regenerate the odd ones with --only when quota allows, for a consistent voice.`);
if (failed) console.error("Some beats could not be generated. The composer uses the clips that exist and falls back to captions for the rest.");
