/**
 * Records the demo footage against the live site: Ada on a desktop window, Chidi on a phone-sized window,
 * each with Playwright's own video. It also writes demo-output/raw/timeline.json (where each beat of the story
 * sits in each video) for scripts/compose-demo.sh.
 *
 *   pnpm record:demo
 *
 * You approve the PayPal popups by hand. The script NEVER types PayPal credentials: when a popup opens it beeps,
 * prints a loud prompt, and waits (up to 10 minutes) until the request shows as held, then carries on by itself.
 * Videos of the popup windows are deleted, so your sandbox sign-in is never kept.
 *
 * Env: DEMO_BASE_URL (default https://kinproof-nine.vercel.app), PW_CHROMIUM_PATH (default: system Chrome if found).
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { chromium, type BrowserContext, type Locator, type Page } from "@playwright/test";

const BASE = (process.env.DEMO_BASE_URL ?? "https://kinproof-nine.vercel.app").replace(/\/$/, "");
const ROOT = new URL("../demo-output/", import.meta.url).pathname;
const RAW = `${ROOT}raw/`;
const PROFILE = `${ROOT}.ada-profile`; // keeps Ada's PayPal sandbox sign-in between runs (git-ignored)
const exe = process.env.PW_CHROMIUM_PATH ?? (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);

const SCAM =
  "Mum, it's me. Please don't panic. My phone fell and broke so this is my new number. I'm in an accident. Please don't tell Dad. The lawyer will call you. Send eight hundred dollars right now, I'll explain later. Hurry, please.";
const GENUINE = "Mum, I'm at St Luke's hospital. They need a deposit before the doctor will see me. Please help.";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- timeline ----------
type Side = "ada" | "chidi";
const t0: Record<Side, number> = { ada: 0, chidi: 0 };
const now = (s: Side) => (Date.now() - t0[s]) / 1000;
const timeline: Record<string, Partial<Record<Side, [number, number][]>>> = {};
const open: Record<string, number> = {};
function begin(id: string, ...sides: Side[]) { for (const s of sides) open[`${id}:${s}`] = now(s); }
function end(id: string, ...sides: Side[]) {
  for (const s of sides) {
    const start = open[`${id}:${s}`];
    ((timeline[id] ??= {})[s] ??= []).push([Math.max(0, start), now(s)]);
  }
}

// ---------- on-screen pointer, so viewers can follow the clicks ----------
const POINTER = () => {
  const css = document.createElement("style");
  css.textContent = `#kp-dot{position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(20,89,79,.28);border:2px solid #14594f;z-index:2147483647;pointer-events:none;transition:transform .08s linear,opacity .2s;opacity:0}
  .kp-ripple{position:fixed;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;border:3px solid #14594f;z-index:2147483647;pointer-events:none;animation:kpr .6s ease-out forwards}@keyframes kpr{to{transform:scale(3.2);opacity:0}}`;
  const dot = document.createElement("div");
  dot.id = "kp-dot";
  const mount = () => { document.head.appendChild(css); document.body.appendChild(dot); };
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
  addEventListener("mousemove", (e) => { dot.style.opacity = matchMedia("(pointer:coarse)").matches ? "0" : "1"; dot.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; }, true);
  addEventListener("pointerdown", (e) => {
    const r = document.createElement("div"); r.className = "kp-ripple"; r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px";
    document.body.appendChild(r); setTimeout(() => r.remove(), 700);
  }, true);
};

// ---------- human-paced actions ----------
async function move(page: Page, loc: Locator) {
  await loc.scrollIntoViewIfNeeded();
  const b = (await loc.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 22 });
}
async function click(page: Page, loc: Locator, pause = 350) {
  await move(page, loc);
  await sleep(pause);
  await loc.click();
}
async function type(page: Page, loc: Locator, text: string, delay: number) {
  await click(page, loc, 200);
  await page.keyboard.type(text, { delay });
}
async function scrollTo(page: Page, loc: Locator, block: ScrollLogicalPosition = "center") {
  await loc.evaluate((el, b) => el.scrollIntoView({ behavior: "smooth", block: b }), block);
  await sleep(1300);
}
async function scrollTop(page: Page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await sleep(1200);
}

// ---------- the PayPal step: a human approves ----------
/** Best-effort desktop alert (notification + sound) so the prompt is not missed. Silently does nothing if unavailable. */
function alertHuman(message: string) {
  const quiet = () => {};
  execFile("notify-send", ["-u", "critical", "-t", "0", "Kinproof demo: your turn", message], quiet);
  execFile("canberra-gtk-play", ["-i", "alarm-clock-elapsed"], quiet);
  process.stdout.write("\x07");
}

function banner(lines: string[]) {
  const bar = "█".repeat(66);
  process.stdout.write(`\n\x1b[1;43;30m${bar}\x1b[0m\n`);
  for (const l of lines) process.stdout.write(`\x1b[1;43;30m  ${l.padEnd(62)}\x1b[0m\n`);
  process.stdout.write(`\x1b[1;43;30m${bar}\x1b[0m\n\n`);
}
async function waitForHold(ada: Page, requestId: string, what: string) {
  banner([
    `>>> YOUR TURN: approve ${what} in the PayPal popup <<<`,
    "Sign in with the sandbox BUYER account (Ada) and approve.",
    "This script never types your password. It continues by itself",
    "as soon as the request is held. (Waiting up to 10 minutes.)",
  ]);
  alertHuman(`Approve ${what} in the PayPal popup (sign in as the sandbox buyer, Ada).`);
  const deadline = Date.now() + 10 * 60_000;
  let last = Date.now();
  while (Date.now() < deadline) {
    const r = await ada.request.get(`${BASE}/api/requests/${requestId}`);
    const status = r.ok() ? ((await r.json()).request?.status as string) : "";
    if (["held", "awaiting_confirmation", "released"].includes(status)) {
      process.stdout.write(`\x07\x1b[1;42;30m  Held. Thank you, carrying on.  \x1b[0m\n`);
      return;
    }
    if (Date.now() - last > 20_000) { alertHuman(`Still waiting for you to approve ${what} in the PayPal popup.`); last = Date.now(); }
    await sleep(1500);
  }
  throw new Error(`Timed out waiting for the PayPal approval of ${what}.`);
}

async function paypalHold(ada: Page, id: string, requestId: string, what: string) {
  await scrollTo(ada, ada.getByRole("heading", { name: /approve a hold in PayPal|Ready to send/i }), "start");
  await sleep(900);
  // Mock mode (a local dry run): the page shows a plain "simulated" button instead of the PayPal popup.
  const simulated = ada.getByRole("button", { name: /Approve in PayPal/ });
  if (await simulated.count()) {
    begin(id, "ada");
    await click(ada, simulated, 700);
    await ada.getByText(/We are asking Chidi right now/).waitFor({ timeout: 30_000 });
    await scrollTop(ada);
    await sleep(1500);
    end(id, "ada");
    return;
  }
  const button = ada.frameLocator(".paypal-buttons iframe").locator('[data-funding-source="paypal"]').first();
  await button.waitFor({ timeout: 30_000 });
  const bar = ada.locator(".paypal-buttons").first();
  await move(ada, bar);
  begin(id, "ada");
  await sleep(400);
  await button.click(); // opens the PayPal popup; the human takes it from here
  await sleep(1800);
  end(id, "ada"); // part one: the click and the "PayPal is open" moment
  await waitForHold(ada, requestId, what);
  await ada.getByText(/We are asking Chidi right now/).waitFor({ timeout: 30_000 });
  begin(id, "ada");
  await scrollTop(ada);
  await sleep(3800);
  end(id, "ada"); // part two: back in Kinproof, the money is on hold
}

// ---------- the story ----------
async function signIn(page: Page, who: string, landing: RegExp) {
  await page.goto(`${BASE}/login`);
  // Ada's browser profile is kept between runs, so she may already be signed in (then /login redirects away).
  if (page.url().includes("/login")) await page.getByRole("button", { name: new RegExp(`^${who}`) }).click();
  await page.waitForURL(landing);
}
const requestId = (page: Page) => page.url().split("/").pop()!;

async function fillAmountAndReview(ada: Page, amount: string, payee?: string) {
  await type(ada, ada.getByLabel(/How much/), amount, 140);
  if (payee) {
    await ada.getByLabel(/PayPal email to pay/).fill("");
    await type(ada, ada.getByLabel(/PayPal email to pay/), payee, 45);
    await sleep(1600); // the warning is on screen
  } else await sleep(1200);
  await click(ada, ada.getByRole("button", { name: "Next" }));
  await sleep(1400); // review
}

const opened: { close: () => Promise<void> }[] = [];
async function run() {
  await rm(RAW, { recursive: true, force: true });
  await mkdir(RAW, { recursive: true });
  const launchArgs = { headless: false, ...(exe ? { executablePath: exe } : {}) };

  const adaCtx: BrowserContext = await chromium.launchPersistentContext(PROFILE, {
    ...launchArgs,
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: RAW, size: { width: 1280, height: 800 } },
    args: ["--window-position=0,40", "--window-size=1300,940"],
  });
  const browser = await chromium.launch({ ...launchArgs, args: ["--window-position=1330,40", "--window-size=430,960"] });
  opened.push(adaCtx, browser);
  const chidiCtx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    // Video size must equal the viewport: Playwright does not scale a smaller page up to a larger video size.
    recordVideo: { dir: RAW, size: { width: 390, height: 844 } },
  });
  for (const c of [adaCtx, chidiCtx]) await c.addInitScript(POINTER);

  const ada = await adaCtx.newPage(); t0.ada = Date.now();
  const chidi = await chidiCtx.newPage(); t0.chidi = Date.now();
  const adaVideo = ada.video()!;
  const chidiVideo = chidi.video()!;

  // Off camera: sign in. (Trimmed out by the composer.)
  await signIn(ada, "Ada", /\/(send|inbox)/);
  await signIn(chidi, "Chidi", /\/(send|inbox)/);
  await chidi.goto(`${BASE}/inbox`);
  await sleep(1500);
  begin("idle", "chidi"); await sleep(3500); end("idle", "chidi"); // Chidi's phone at rest, used when he is not the focus

  // ===== Scene A: the scam =====
  await ada.goto(`${BASE}/send`);
  await ada.getByRole("button", { name: "Next" }).waitFor();
  await sleep(700);
  begin("a-send1", "ada");
  await click(ada, ada.getByText("Chidi", { exact: true }).first());
  await click(ada, ada.getByRole("button", { name: "Next" }));
  await type(ada, ada.getByLabel(/What did they say/), SCAM, 26);
  await sleep(1000);
  end("a-send1", "ada");

  begin("a-send2", "ada");
  await click(ada, ada.getByRole("button", { name: "Next" }));
  await fillAmountAndReview(ada, "800", "scammer@mail.example");
  await click(ada, ada.getByRole("button", { name: "Check this request" }));
  end("a-send2", "ada");

  await ada.waitForURL(/\/requests\//);
  await ada.getByText(/What Kinproof found/).waitFor({ timeout: 60_000 });
  const scamId = requestId(ada);

  begin("a-verdict", "ada");
  await sleep(1800);
  await scrollTo(ada, ada.locator("figure").first());
  await sleep(3200);
  await scrollTo(ada, ada.getByText(/^Payee Mismatch$/i).first(), "start");
  await sleep(3800);
  end("a-verdict", "ada");

  begin("a-safer", "ada");
  await scrollTo(ada, ada.getByRole("heading", { name: /Safer option/ }), "start");
  const direct = ada.getByRole("button", { name: /directly/ }).first();
  await move(ada, direct);
  await sleep(9500); // long enough to cover the narration: the footage should keep moving, not freeze
  end("a-safer", "ada");

  await paypalHold(ada, "a-hold", scamId, "the $800 hold");

  // Chidi's card
  await chidi.goto(`${BASE}/inbox`);
  const card = chidi.getByRole("alertdialog");
  await card.waitFor({ timeout: 30_000 });
  begin("a-card", "ada", "chidi");
  await sleep(14000); // the question is read out while the countdown ticks
  end("a-card", "ada", "chidi");

  begin("a-blocked", "ada", "chidi");
  await click(chidi, card.getByRole("button", { name: /No, that wasn.t me/ }), 600);
  await chidi.getByText(/Thank you/).waitFor({ timeout: 20_000 });
  await ada.getByText(/We stopped this payment/).waitFor({ timeout: 30_000 });
  await sleep(4200);
  end("a-blocked", "ada", "chidi");
  await click(chidi, chidi.getByRole("button", { name: "Close" }), 200);

  // ===== Scene B: a real emergency =====
  await ada.goto(`${BASE}/send`);
  await ada.getByRole("button", { name: "Next" }).waitFor();
  await sleep(600);
  begin("b-send", "ada");
  await click(ada, ada.getByText("Chidi", { exact: true }).first());
  await click(ada, ada.getByRole("button", { name: "Next" }));
  await type(ada, ada.getByLabel(/What did they say/), GENUINE, 28);
  await sleep(600);
  await click(ada, ada.getByRole("button", { name: "Next" }));
  await fillAmountAndReview(ada, "350"); // payee stays Chidi's verified PayPal
  await click(ada, ada.getByRole("button", { name: "Check this request" }));
  await ada.waitForURL(/\/requests\//);
  await ada.getByText(/What Kinproof found/).waitFor({ timeout: 60_000 });
  await sleep(1800);
  end("b-send", "ada");
  const genuineId = requestId(ada);

  await paypalHold(ada, "b-hold", genuineId, "the $350 hold");

  await chidi.goto(`${BASE}/inbox`);
  const card2 = chidi.getByRole("alertdialog");
  await card2.waitFor({ timeout: 30_000 });
  begin("b-confirm", "ada", "chidi");
  await sleep(3500);
  await click(chidi, card2.getByRole("button", { name: "Yes, it was me" }), 600);
  await chidi.getByText(/Thank you/).waitFor({ timeout: 20_000 });
  await ada.getByText("The payment was sent.").waitFor({ timeout: 45_000 });
  await sleep(4800);
  end("b-confirm", "ada", "chidi");

  // Flush the videos; keep only the two main pages (popup videos could contain a sandbox sign-in).
  await adaCtx.close();
  await chidiCtx.close();
  await browser.close();
  const adaPath = await adaVideo.path();
  const chidiPath = await chidiVideo.path();
  for (const f of await readdir(RAW)) if (f.endsWith(".webm") && ![adaPath, chidiPath].includes(`${RAW}${f}`)) await rm(`${RAW}${f}`);
  await writeFile(`${RAW}timeline.json`, JSON.stringify({ ada: adaPath, chidi: chidiPath, beats: timeline, requests: { scam: scamId, genuine: genuineId } }, null, 2));
  console.log(`\nDone. Footage and timeline saved in ${RAW}\nNext: pnpm voiceover && pnpm compose:demo`);
}

run().catch(async (e) => {
  console.error("\nRecording failed:", e.message ?? e);
  for (const c of opened) await c.close().catch(() => {});
  process.exit(1);
});
