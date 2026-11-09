/**
 * Builds demo-output/kinproof-demo.mp4 from the recorder's footage (demo-output/raw/) and the voiceover
 * (demo-output/audio/): Ada's desktop on the left, Chidi's phone in a phone frame on the right, title cards,
 * burned-in captions, narration, no music. 1080p H.264, -preset veryfast. Fails if the result is over 2:55.
 *
 *   pnpm compose:demo       (run pnpm record:demo first; pnpm voiceover for the narration)
 *
 * No voiceover? It still builds with captions only and writes demo-output/voiceover-script.txt, with timings,
 * so you can record your own voice and drop it in as demo/voiceover.mp3.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { BEATS, LIVE_URL, REPO_URL, STAT, STAT_SOURCE, TAGLINE, type Beat } from "./demo-beats.ts";

const ROOT = new URL("../demo-output/", import.meta.url).pathname;
const RAW = `${ROOT}raw/`;
const AUDIO = `${ROOT}audio/`;
const WORK = `${ROOT}work/`;
const OUT = `${ROOT}kinproof-demo.mp4`;
const MAX_SECONDS = 175; // 2:55
const FPS = 30;
const exe = process.env.PW_CHROMIUM_PATH ?? (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);

// Layout (1920x1080)
const ADA = { x: 112, y: 140, w: 1250, h: 781 };
const PHONE = { x: 1440, y: 120, w: 390, h: 844 }; // native size: the confirmation card is the hero, so it stays readable

const ff = (args: string[]) => execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], { stdio: ["ignore", "inherit", "inherit"] });
const probe = (file: string) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());

// ---------- overlays and cards, rendered with the app's own fonts ----------
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Source+Sans+3:wght@400;600;700&display=swap');`;
const CSS = `${FONTS}
*{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;overflow:hidden}
body{font-family:'Source Sans 3',system-ui,sans-serif;color:#1e2a2b}
.serif{font-family:'Fraunces',Georgia,serif;letter-spacing:-.015em}
.paper{background:#f7f1e5}
.seal{display:inline-block}`;

const SEAL_PATH = (() => {
  const pts: string[] = [];
  for (let i = 0; i <= 180; i++) { const t = (i / 180) * Math.PI * 2; const r = 29 + 1.5 * Math.cos(t * 22); pts.push(`${i ? "L" : "M"}${(32 + r * Math.cos(t)).toFixed(2)} ${(32 + r * Math.sin(t)).toFixed(2)}`); }
  return pts.join("") + "Z";
})();
const seal = (size: number, fill = "#14594f") => `<svg class="seal" width="${size}" height="${size}" viewBox="0 0 64 64"><path d="${SEAL_PATH}" fill="${fill}"/><path d="M21 33.5l8 8 14.5-16.5" fill="none" stroke="#fffdf6" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const wordmark = `<div style="position:absolute;left:112px;top:48px;display:flex;align-items:center;gap:16px;font-size:42px" class="serif"><b style="font-weight:600">${seal(46)}</b><span style="font-weight:600">Kinproof</span></div>`;

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function overlayHtml(b: Beat): string {
  return `<style>${CSS}
.scene{position:absolute;left:112px;top:22px;display:flex;align-items:center;gap:14px}
.scene i{font-style:normal;background:#14594f;color:#fffdf6;font-weight:700;font-size:19px;letter-spacing:.14em;padding:6px 14px;border-radius:99px;text-transform:uppercase}
.scene span{font-size:34px;font-weight:600}
.lab{position:absolute;top:84px;font-size:24px;font-weight:700;color:#55605d;letter-spacing:.01em}
.ada{position:absolute;left:${ADA.x}px;top:${ADA.y}px;width:${ADA.w}px;height:${ADA.h}px;border-radius:14px;box-shadow:0 0 0 26px #f7f1e5,0 0 0 27px #d9cdb4}
.phone{position:absolute;left:${PHONE.x}px;top:${PHONE.y}px;width:${PHONE.w}px;height:${PHONE.h}px;border-radius:42px;box-shadow:0 0 0 20px #1f1f1e,0 0 0 22px #55554f}
.notch{position:absolute;left:${PHONE.x + PHONE.w / 2 - 46}px;top:${PHONE.y + 12}px;width:92px;height:24px;border-radius:14px;background:#1f1f1e}
.cap{position:absolute;left:${ADA.x - 10}px;width:${ADA.w + 20}px;bottom:30px;display:flex;justify-content:center}
.cap p{margin:0;background:rgba(30,42,43,.92);color:#fbf6ea;font-size:34px;line-height:1.26;font-weight:600;padding:14px 30px;border-radius:18px;text-align:center}
</style>
<div class="ada"></div><div class="phone"></div><div class="notch"></div>
<div class="scene serif"><i>${esc(b.scene ?? "")}</i></div>
<div class="lab" style="left:${ADA.x}px">Ada · Mum’s laptop</div>
<div class="lab" style="left:${PHONE.x - 20}px;top:56px">Chidi · his own phone</div>
<div class="cap"><p>${esc(b.caption)}</p></div>`;
}

const BG_HTML = `<style>${CSS}
body{background:#f7f1e5;background-image:radial-gradient(#e2d8c0 1.2px,transparent 1.2px);background-size:26px 26px}
.shadow{position:absolute;border-radius:14px;box-shadow:0 30px 60px -28px rgba(60,40,10,.55)}</style>
<div class="shadow" style="left:${ADA.x}px;top:${ADA.y}px;width:${ADA.w}px;height:${ADA.h}px"></div>
<div class="shadow" style="left:${PHONE.x - 20}px;top:${PHONE.y - 20}px;width:${PHONE.w + 40}px;height:${PHONE.h + 40}px;border-radius:60px"></div>`;

function stat(): string {
  const parts = STAT.split("$3.5 billion");
  return `<style>${CSS}</style><div class="paper" style="width:1920px;height:1080px;position:relative">${wordmark}
<div style="position:absolute;left:112px;right:112px;top:330px">
 <div class="serif" style="font-size:104px;line-height:1.08;font-weight:600">${esc(parts[0])}<span style="color:#14594f">$3.5 billion</span>${esc(parts[1])}</div>
 <div style="margin-top:56px;font-size:38px;color:#55605d;font-weight:600">Source: ${esc(STAT_SOURCE)}</div>
</div></div>`;
}
const openStage2 = `<style>${CSS}</style><div class="paper" style="width:1920px;height:1080px;position:relative">${wordmark}
<div style="position:absolute;left:112px;top:310px;width:1100px">
 <div class="serif" style="font-size:96px;line-height:1.08;font-weight:600">You can’t tell<br>by listening.</div>
 <div class="serif" style="margin-top:44px;font-size:62px;line-height:1.15;color:#14594f;font-weight:600">Kinproof verifies the person.</div>
</div><div style="position:absolute;right:170px;top:330px;transform:rotate(-6deg)">${seal(460)}</div></div>`;
const closeStage1 = `<style>${CSS}
.step{flex:1;background:#fffcf5;border:2px solid #dccfb4;border-radius:26px;padding:40px 36px;box-shadow:0 24px 50px -30px rgba(60,40,10,.5)}
.step b{display:inline-grid;place-items:center;width:62px;height:62px;border-radius:99px;background:#14594f;color:#fffdf6;font-size:34px}
.step h3{margin:22px 0 8px;font-size:56px;font-weight:600}.step p{margin:0;font-size:34px;color:#55605d;line-height:1.3}</style>
<div class="paper" style="width:1920px;height:1080px;position:relative">${wordmark}
<div class="serif" style="position:absolute;left:112px;top:250px;font-size:74px;font-weight:600;line-height:1.1;width:1500px">PayPal separates authorizing from capturing.</div>
<div style="position:absolute;left:112px;right:112px;top:490px;display:flex;gap:34px">
 <div class="step"><b>1</b><h3 class="serif">Hold</h3><p>The money is held, not sent.</p></div>
 <div class="step"><b>2</b><h3 class="serif">Check</h3><p>The real person answers on their own phone.</p></div>
 <div class="step"><b>3</b><h3 class="serif">Send or send back</h3><p>Capture it, or void the hold.</p></div>
</div></div>`;
const closeStage2 = `<style>${CSS}</style><div class="paper" style="width:1920px;height:1080px;position:relative">${wordmark}
<div style="position:absolute;left:112px;top:290px;width:1250px">
 <div class="serif" style="font-size:112px;line-height:1.06;font-weight:600">${esc(TAGLINE).replace("Proof of person,", "Proof of person,<br>")}</div>
 <div style="margin-top:70px;font-size:44px;line-height:1.5;font-weight:600"><span style="color:#55605d;font-weight:400">Try it</span>&nbsp;&nbsp;${esc(LIVE_URL)}<br><span style="color:#55605d;font-weight:400">Code</span>&nbsp;&nbsp;${esc(REPO_URL)}</div>
</div><div style="position:absolute;right:150px;top:340px;transform:rotate(-6deg)">${seal(430)}</div></div>`;

async function renderPng(html: string, file: string, transparent = false) {
  const page = await shared.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.screenshot({ path: file, omitBackground: transparent });
  await page.close();
}

// ---------- ffmpeg assembly ----------
interface Timeline { ada: string; chidi: string; beats: Record<string, { ada?: [number, number][]; chidi?: [number, number][] }>; }
let shared: Awaited<ReturnType<typeof chromium.launch>>;
const sum = (segs: [number, number][]) => segs.reduce((a, [s, e]) => a + (e - s), 0);

function videoChain(inputIdx: number, segs: [number, number][], label: string, speed: number, d: number, w: number, h: number): string {
  const n = segs.length;
  const split = n > 1 ? `[${inputIdx}:v]split=${n}${segs.map((_, i) => `[${label}s${i}]`).join("")};` : "";
  const trims = segs.map(([s, e], i) => `${n > 1 ? `[${label}s${i}]` : `[${inputIdx}:v]`}trim=start=${s.toFixed(3)}:end=${e.toFixed(3)},setpts=PTS-STARTPTS[${label}t${i}]`).join(";");
  const cat = n > 1 ? `${segs.map((_, i) => `[${label}t${i}]`).join("")}concat=n=${n}:v=1:a=0[${label}c]` : `[${label}t0]null[${label}c]`;
  return `${split}${trims};${cat};[${label}c]fps=${FPS},setpts=PTS/${speed.toFixed(4)},scale=${w}:${h}:flags=lanczos,tpad=stop_mode=clone:stop_duration=${(d + 2).toFixed(2)},trim=duration=${d.toFixed(3)},setpts=PTS-STARTPTS[${label}]`;
}

async function main() {
  if (!existsSync(`${RAW}timeline.json`)) throw new Error("No footage yet. Run `pnpm record:demo` first.");
  const tl: Timeline = JSON.parse(await readFile(`${RAW}timeline.json`, "utf8"));
  await rm(WORK, { recursive: true, force: true });
  await mkdir(WORK, { recursive: true });

  const narr = (b: Beat) => (existsSync(`${AUDIO}${b.id}.wav`) ? `${AUDIO}${b.id}.wav` : null);
  const haveVoice = BEATS.some((b) => narr(b));
  const external = existsSync(new URL("../demo/voiceover.mp3", import.meta.url).pathname) ? new URL("../demo/voiceover.mp3", import.meta.url).pathname : null;
  if (!haveVoice && !external) console.warn("No voiceover found: building with captions only.");

  shared = await chromium.launch(exe ? { executablePath: exe, args: ["--no-sandbox"] } : {});
  await renderPng(BG_HTML, `${WORK}bg.png`);
  await renderPng(stat(), `${WORK}open1.png`);
  await renderPng(openStage2, `${WORK}open2.png`);
  await renderPng(closeStage1, `${WORK}close1.png`);
  await renderPng(closeStage2, `${WORK}close2.png`);
  for (const b of BEATS.filter((x) => x.kind === "footage")) await renderPng(overlayHtml(b), `${WORK}ov-${b.id}.png`, true);
  await shared.close();

  const clips: string[] = [];
  const scriptLines: string[] = [];
  let clock = 0;
  const idle = tl.beats.idle?.chidi ?? [[0, 3]];

  for (const b of BEATS) {
    const wav = narr(b);
    const nd = wav ? probe(wav) : 0;
    const out = `${WORK}${b.id}.mp4`;
    const voiceArgs = wav ? ["-i", wav] : [];
    let D: number;

    if (b.kind === "card") {
      D = Math.max(wav ? nd + 0.9 : 6, 4);
      const imgs = b.id === "open" ? ["open1", "open2"] : ["close1", "close2"];
      const x = 0.7; // crossfade
      const t1 = D * 0.55;
      const t2 = D - t1 + x;
      const audio = wav ? `[2:a]aresample=48000,aformat=channel_layouts=stereo,adelay=350|350,apad=whole_dur=${D.toFixed(3)},atrim=duration=${D.toFixed(3)}[a]` : `anullsrc=r=48000:cl=stereo,atrim=duration=${D.toFixed(3)}[a]`;
      ff([
        "-loop", "1", "-framerate", String(FPS), "-t", t1.toFixed(3), "-i", `${WORK}${imgs[0]}.png`,
        "-loop", "1", "-framerate", String(FPS), "-t", t2.toFixed(3), "-i", `${WORK}${imgs[1]}.png`,
        ...voiceArgs,
        "-filter_complex", `[0:v][1:v]xfade=transition=fade:duration=${x}:offset=${(t1 - x).toFixed(3)},format=yuv420p[v];${audio}`,
        "-map", "[v]", "-map", "[a]", "-t", D.toFixed(3), "-r", String(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", out,
      ]);
    } else {
      const seg = tl.beats[b.id];
      if (!seg?.ada?.length) throw new Error(`Footage for beat "${b.id}" is missing from timeline.json. Re-run pnpm record:demo.`);
      const adaSegs = seg.ada;
      const chidiSegs = seg.chidi?.length ? seg.chidi : [idle[0]];
      const L = Math.max(sum(adaSegs), seg.chidi?.length ? sum(chidiSegs) : 0);
      const reading = b.caption.split(/\s+/).length / 3 + 1.8;
      const D0 = Math.max(wav ? nd + 0.6 : reading, L / 1.2); // speed-ups stay gentle so typing still reads as typing
      D = D0;
      const speed = L > D0 ? L / D0 : 1; // speed up long takes (up to 1.2x), freeze the last frame on short ones
      const chain = [
        videoChain(1, adaSegs, "ad", speed, D, ADA.w, ADA.h),
        videoChain(2, chidiSegs, "ch", seg.chidi?.length ? speed : 1, D, PHONE.w, PHONE.h),
        `[0:v][ad]overlay=${ADA.x}:${ADA.y}[o1]`,
        `[o1][ch]overlay=${PHONE.x}:${PHONE.y}[o2]`,
        `[o2][3:v]overlay=0:0:format=auto,format=yuv420p[v]`,
        wav ? `[4:a]aresample=48000,aformat=channel_layouts=stereo,adelay=300|300,apad=whole_dur=${D.toFixed(3)},atrim=duration=${D.toFixed(3)}[a]` : `anullsrc=r=48000:cl=stereo,atrim=duration=${D.toFixed(3)}[a]`,
      ].join(";");
      ff([
        "-loop", "1", "-framerate", String(FPS), "-t", D.toFixed(3), "-i", `${WORK}bg.png`,
        "-i", tl.ada, "-i", tl.chidi,
        "-loop", "1", "-framerate", String(FPS), "-t", D.toFixed(3), "-i", `${WORK}ov-${b.id}.png`,
        ...voiceArgs,
        "-filter_complex", chain, "-map", "[v]", "-map", "[a]", "-t", D.toFixed(3), "-r", String(FPS),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", out,
      ]);
    }
    clips.push(out);
    scriptLines.push(`[${fmt(clock)}]  ${b.id}\n${b.narration}\n`);
    console.log(`${b.id.padEnd(10)} ${D.toFixed(1).padStart(5)}s  (narration ${nd ? nd.toFixed(1) + "s" : "none"})`);
    clock += D;
  }

  await writeFile(`${WORK}list.txt`, clips.map((c) => `file '${c}'`).join("\n"));
  if (external && !haveVoice) {
    ff(["-f", "concat", "-safe", "0", "-i", `${WORK}list.txt`, "-i", external, "-map", "0:v", "-map", "1:a", "-shortest", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", OUT]);
  } else {
    ff(["-f", "concat", "-safe", "0", "-i", `${WORK}list.txt`, "-c", "copy", "-movflags", "+faststart", OUT]);
  }
  await writeFile(`${ROOT}voiceover-script.txt`, `Voiceover script with timings (total ${fmt(clock)})\n\n${scriptLines.join("\n")}`);

  const total = probe(OUT);
  console.log(`\n${OUT}\nDuration: ${fmt(total)} (${total.toFixed(1)}s)`);
  if (total > MAX_SECONDS) {
    console.error(`FAIL: ${fmt(total)} is over the 2:55 limit. Shorten the narration or the recorded pauses.`);
    process.exit(2);
  }
}
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
