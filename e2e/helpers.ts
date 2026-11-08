import { expect, type Browser, type Page } from "@playwright/test";

export async function signIn(browser: Browser, name: "Ada" | "Chidi" | "Ngozi", opts: Parameters<Browser["newContext"]>[0] = {}): Promise<Page> {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
  await page.waitForURL(/\/(send|inbox)/);
  return page;
}

/** Walks the four-step send flow. The person asking defaults to Chidi, and the payee is prefilled with his verified PayPal. */
export async function sendRequest(page: Page, o: { message: string; amount: string; payee?: string }) {
  await page.goto("/send");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel(/What did they say/).fill(o.message);
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel(/How much/).fill(o.amount);
  if (o.payee) await page.getByLabel(/PayPal email to pay/).fill(o.payee);
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("button", { name: "Check this request" })).toBeVisible();
  await page.getByRole("button", { name: "Check this request" }).click();
}
