import { expect, test, type Browser, type Page } from "@playwright/test";
import { sendRequest } from "./helpers";

const SCAM =
  "Mum it's me, my phone fell so this is my new number. I'm in an accident, don't tell Dad. The lawyer will call you, send $800 right now to this account.";

/** Mobile browsers where these APIs are absent (deleted) or present-but-hostile (throwing). */
const REMOVE_APIS = () => {
  const w = window as unknown as Record<string, unknown>;
  for (const k of ["Notification", "PushManager", "AudioContext", "webkitAudioContext", "OfflineAudioContext", "webkitOfflineAudioContext", "MediaRecorder"]) {
    try { delete w[k]; } catch { /* ignore */ }
  }
  for (const k of ["serviceWorker", "vibrate", "mediaDevices"]) {
    try { delete (Navigator.prototype as unknown as Record<string, unknown>)[k]; } catch { /* ignore */ }
    try { delete (navigator as unknown as Record<string, unknown>)[k]; } catch { /* ignore */ }
  }
};
const HOSTILE_APIS = () => {
  const boom = (): never => { throw new Error("hostile API"); };
  const w = window as unknown as Record<string, unknown>;
  const nav = navigator as unknown as Record<string, unknown>;
  const def = (o: object, k: string, d: PropertyDescriptor) => { try { Object.defineProperty(o, k, { configurable: true, ...d }); } catch { /* ignore */ } };
  def(w, "Notification", { value: Object.assign(function () { boom(); }, { requestPermission: () => Promise.reject(new Error("blocked")) }) });
  def(w.Notification as object, "permission", { get: boom });
  for (const k of ["AudioContext", "webkitAudioContext", "OfflineAudioContext", "MediaRecorder", "PushManager"]) def(w, k, { value: function () { boom(); } });
  def(nav, "serviceWorker", { get: boom });
  def(nav, "mediaDevices", { get: boom });
  def(nav, "vibrate", { value: boom });
};

async function open(browser: Browser, name: "Ada" | "Chidi", init?: () => void): Promise<{ page: Page; errors: string[] }> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
  await page.waitForURL(/\/(send|inbox)/);
  return { page, errors };
}

for (const [label, init] of [["missing", REMOVE_APIS], ["throwing", HOSTILE_APIS]] as const) {
  test.describe(`browser APIs ${label}`, () => {
    test("Chidi still gets the confirmation card and every page loads", async ({ browser }) => {
      const ada = await open(browser, "Ada");
      const chidi = await open(browser, "Chidi", init);

      await ada.page.goto("/send");
      await sendRequest(ada.page, { message: SCAM, amount: "800", payee: "scammer@evil.example" });
      await ada.page.waitForURL(/\/requests\//);
      await ada.page.getByRole("button", { name: /Approve in PayPal/ }).click();
      await expect(ada.page.getByText(/We are asking Chidi right now/)).toBeVisible();

      await chidi.page.goto("/inbox");
      const card = chidi.page.getByRole("alertdialog");
      await expect(card).toBeVisible({ timeout: 15_000 });
      await expect(chidi.page.getByTestId("demo-error-details")).toHaveCount(0); // boundary was not triggered
      await card.getByRole("button", { name: /No, that wasn.t me/ }).click();
      await expect(ada.page.getByText(/We stopped this payment and your money is back/)).toBeVisible({ timeout: 15_000 });

      // other screens that touch browser APIs
      await chidi.page.goto("/settings");
      await expect(chidi.page.getByRole("heading", { name: "Settings" })).toBeVisible();
      await expect(chidi.page.getByText(/doesn.t support notifications|Turn on notifications|blocked/).first()).toBeVisible();
      await chidi.page.goto("/send");
      await expect(chidi.page.getByRole("heading", { name: "Send money safely" })).toBeVisible();
      await expect(chidi.page.getByRole("button", { name: "Record now" })).toHaveCount(0); // recording hidden when unsupported
      await chidi.page.goto("/");
      await expect(chidi.page.getByRole("heading", { level: 1 })).toBeVisible();

      expect(chidi.errors).toEqual([]);
    });
  });
}

test("a crash inside the overlay is contained and shows the real error in demo mode", async ({ browser }) => {
  const chidi = await open(browser, "Chidi");
  // malformed inbox payload makes the overlay throw while rendering
  await chidi.page.route("**/api/inbox", (route) =>
    route.fulfill({ json: { items: [{ confirmation: {}, request: null, senderName: "Ada" }], vouchable: [] } }),
  );
  await chidi.page.goto("/inbox");
  const details = chidi.page.getByTestId("demo-error-details");
  await expect(details).toBeVisible({ timeout: 15_000 });
  await expect(details).toContainText(/TypeError|null/);
  // the rest of the app (nav + page) is still usable
  await expect(chidi.page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  await expect(chidi.page.getByRole("link", { name: "Send money" })).toBeVisible();
});
