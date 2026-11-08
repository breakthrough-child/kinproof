/**
 * Takes the README/design-review screenshots of every key screen at 390px (phone) and 1440px (desktop),
 * in light and dark. Needs the app running in mock mode:
 *
 *   pnpm build && PAYPAL_MODE=mock LLM_PROVIDER=mock NEXT_PUBLIC_SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= DEMO_MODE=true pnpm exec next start -p 3101
 *   SHOT_BASE=http://localhost:3101 pnpm screenshots        (PW_CHROMIUM_PATH=/usr/bin/google-chrome to use system Chrome)
 */
import { chromium } from "@playwright/test";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3101";
const OUT = new URL("../docs/screenshots/", import.meta.url).pathname;
const SCAM = "Mum it's me, my phone fell so this is my new number. I'm in an accident, please don't tell Dad. The lawyer will call you, send $800 right now. Hurry, please.";

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH, args: ["--no-sandbox"] } : {});

for (const device of ["mobile", "desktop"]) {
  for (const scheme of ["light", "dark"]) {
    const opts = device === "mobile"
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: scheme }
      : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: scheme };
    const tag = `${device}-${scheme}`;
    const shot = async (page, name, full = false) => {
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${OUT}${name}-${tag}.jpg`, type: "jpeg", quality: 78, fullPage: full });
    };
    const login = async (page, who) => {
      await page.goto(`${BASE}/login`);
      await page.getByRole("button", { name: new RegExp(`^${who}`) }).click();
      await page.waitForURL(/\/(send|inbox)/);
    };
    const adaCtx = await browser.newContext(opts);
    const chidiCtx = await browser.newContext(opts);
    const ada = await adaCtx.newPage();
    const chidi = await chidiCtx.newPage();

    await ada.goto(`${BASE}/`); await shot(ada, "01-landing", true);
    await ada.goto(`${BASE}/login`); await shot(ada, "02-signin");
    await login(ada, "Ada");
    await login(chidi, "Chidi");

    // Send flow: step 1, then step 3 with the payee warning, then the review
    await ada.goto(`${BASE}/send`); await shot(ada, "03-send-who");
    await ada.getByRole("button", { name: "Next" }).click();
    await ada.getByLabel(/What did they say/).fill(SCAM);
    await ada.getByRole("button", { name: "Next" }).click();
    await ada.getByLabel(/How much/).fill("800");
    await ada.getByLabel(/PayPal email to pay/).fill("scammer@mail.example");
    await shot(ada, "04-send-amount-warning");
    await ada.getByRole("button", { name: "Next" }).click();
    await ada.getByRole("button", { name: "Check this request" }).click();
    await ada.waitForURL(/\/requests\//);
    await ada.getByRole("button", { name: /Approve in PayPal/ }).waitFor();
    await shot(ada, "05-verdict", true);
    await ada.getByRole("button", { name: /Approve in PayPal/ }).click();
    await ada.getByText(/We are asking Chidi right now/).waitFor();

    // Chidi's phone
    await chidi.goto(`${BASE}/inbox`);
    await chidi.getByRole("alertdialog").waitFor({ timeout: 15000 });
    await shot(chidi, "06-confirmation-card");
    await chidi.getByRole("button", { name: /No, that wasn.t me/ }).click();
    await chidi.getByText(/Thank you/).waitFor();
    await shot(chidi, "07-stamp-thanks");

    await ada.getByText(/We stopped this payment/).waitFor({ timeout: 15000 });
    await shot(ada, "08-request-blocked", true);

    for (const [name, path] of [["09-inbox", "/inbox"], ["10-circle", "/circle"], ["11-payees", "/institutions"], ["12-settings", "/settings"]]) {
      await ada.goto(`${BASE}${path}`); await ada.waitForLoadState("networkidle"); await shot(ada, name, name === "10-circle");
    }
    await adaCtx.close(); await chidiCtx.close();
    console.log("done", tag);
  }
}
await browser.close();
