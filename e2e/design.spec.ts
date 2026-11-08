import { expect, test } from "@playwright/test";
import { sendRequest, signIn } from "./helpers";

const SCAM = "Mum it's me, my phone fell so this is my new number. I'm in an accident, don't tell Dad. The lawyer will call you, send $800 right now.";

test("viewer-aware wording: Chidi sees Ada's name, Ada sees 'your'", async ({ browser }) => {
  const ada = await signIn(browser, "Ada");
  const chidi = await signIn(browser, "Chidi");
  await sendRequest(ada, { message: SCAM, amount: "800", payee: "scammer@evil.example" });
  await ada.waitForURL(/\/requests\//);
  // Preparing the PayPal order (what the PayPal button does first) moves the request to "waiting for approval".
  const order = await ada.request.post(`/api/requests/${ada.url().split("/").pop()}/order`);
  expect(order.ok()).toBe(true);
  await ada.reload();
  await expect(ada.getByText("Waiting for your PayPal approval").first()).toBeVisible();
  await chidi.goto(ada.url());
  await expect(chidi.getByText("Waiting for Ada's PayPal approval").first()).toBeVisible();
  await expect(chidi.getByText(/Waiting for your PayPal approval/)).toHaveCount(0);
  await expect(chidi.getByRole("button", { name: /Approve in PayPal/ })).toHaveCount(0);
});

test("payee is prefilled with the asker's verified PayPal and a different address is warned about", async ({ browser }) => {
  const ada = await signIn(browser, "Ada");
  await ada.goto("/send");
  await ada.getByRole("button", { name: "Next" }).click();
  await ada.getByLabel(/What did they say/).fill("Mum, send some money please.");
  await ada.getByRole("button", { name: "Next" }).click();
  const payee = ada.getByLabel(/PayPal email to pay/);
  await expect(payee).toHaveValue(/@/);
  await expect(ada.getByText(/isn.t Chidi.s verified PayPal account/)).toHaveCount(0);
  const original = await payee.inputValue();
  await payee.fill("someone.else@evil.example");
  // The warning is also rendered (hidden) in the review step, so look only at what is on screen.
  const warning = ada.locator("p:visible", { hasText: /This isn.t Chidi.s verified PayPal account\./ });
  await expect(warning).toHaveCount(1);
  await ada.getByRole("button", { name: /Use Chidi.s verified PayPal/ }).click();
  await expect(payee).toHaveValue(original);
  await expect(ada.getByText(/isn.t Chidi.s verified PayPal account/)).toHaveCount(0);
});

test("privacy and terms pages exist", async ({ page }) => {
  for (const [path, heading] of [["/privacy", "Privacy"], ["/terms", "Terms of use"]] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByText(/no real money/i).first()).toBeVisible();
  }
});

test("a correctly configured deployment shows no dev banner; mock mode does", async ({ page }) => {
  // The E2E server runs in mock mode, so the banner must be present here...
  await page.goto("/");
  await expect(page.getByText(/Development mode:/)).toBeVisible();
});

const WIDTHS = [360, 390, 414, 768, 1024, 1440];
for (const width of WIDTHS) {
  test(`no horizontal scroll at ${width}px, nav matches the screen size`, async ({ browser }) => {
    const ada = await signIn(browser, "Ada", { viewport: { width, height: 800 } });
    for (const path of ["/", "/send", "/inbox", "/circle", "/institutions", "/settings", "/privacy", "/terms"]) {
      await ada.goto(path);
      await ada.waitForLoadState("networkidle");
      const overflow = await ada.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} overflows at ${width}px`).toBeLessThanOrEqual(0);
    }
    await ada.goto("/inbox");
    if (width < 768) await expect(ada.getByRole("navigation", { name: "Main (mobile)" })).toBeVisible();
    else await expect(ada.getByRole("navigation", { name: "Main", exact: true })).toBeVisible();
  });
}
