import { expect, test } from "@playwright/test";
import { sendRequest, signIn } from "./helpers";

const SCAM =
  "Mum it's me, my phone fell so this is my new number. I'm in an accident, don't tell Dad. The lawyer will call you, send $800 right now to this account.";

test("scam: held, Chidi says 'That wasn't me', money returned", async ({ browser }) => {
  const ada = await signIn(browser, "Ada");
  const chidi = await signIn(browser, "Chidi");

  await sendRequest(ada, { message: SCAM, amount: "800", payee: "scammer@evil.example" });

  await ada.waitForURL(/\/requests\//);
  await expect(ada.getByText("Strong warning signs")).toBeVisible();
  await expect(ada.getByText(/what kinproof found/i)).toBeVisible();
  await ada.getByRole("button", { name: /Approve in PayPal/ }).click();
  await expect(ada.getByText(/We are asking Chidi right now/)).toBeVisible();
  await expect(ada.getByText(/Money on hold|Waiting for the real person/).first()).toBeVisible();

  // Chidi's own session gets the unmissable card
  await chidi.goto("/inbox");
  const card = chidi.getByRole("alertdialog");
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card).toContainText("$800");
  await card.getByRole("button", { name: /No, that wasn.t me/ }).click();

  await expect(ada.getByText(/We stopped this payment and your money is back/)).toBeVisible({ timeout: 15_000 });
  await expect(ada.getByText(/Hold released, money returned to you/)).toBeVisible();
});

test("genuine emergency: Chidi confirms, payment captured", async ({ browser }) => {
  const ada = await signIn(browser, "Ada");
  const chidi = await signIn(browser, "Chidi");

  await sendRequest(ada, { message: "Mum, I'm at St Luke's. They need a deposit before the doctor sees me.", amount: "350" });

  await ada.waitForURL(/\/requests\//);
  await ada.getByRole("button", { name: /Approve in PayPal/ }).click();
  await expect(ada.getByText(/We are asking Chidi right now/)).toBeVisible();

  await chidi.goto("/inbox");
  const card = chidi.getByRole("alertdialog");
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.getByRole("button", { name: "Yes, it was me" }).click();

  await expect(ada.getByText("The payment was sent.")).toBeVisible({ timeout: 15_000 });
  await expect(ada.getByText("Payment sent")).toBeVisible();
});

test("security: a different member cannot answer Chidi's confirmation", async ({ browser }) => {
  const ada = await signIn(browser, "Ada");
  const ngozi = await signIn(browser, "Ngozi");
  await sendRequest(ada, { message: SCAM, amount: "800", payee: "scammer@evil.example" });
  await ada.waitForURL(/\/requests\//);
  const id = ada.url().split("/").pop()!;
  await ada.getByRole("button", { name: /Approve in PayPal/ }).click();
  await expect(ada.getByText(/We are asking Chidi right now/)).toBeVisible();

  const res = await ngozi.request.post(`/api/requests/${id}/respond`, { data: { answer: "confirmed" } });
  expect(res.status()).toBe(403);
  const own = await ada.request.post(`/api/requests/${id}/respond`, { data: { answer: "confirmed" } });
  expect(own.status()).toBe(403);
  await ngozi.goto("/inbox");
  await expect(ngozi.getByRole("alertdialog")).toHaveCount(0);
});
