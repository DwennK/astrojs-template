import { expect, test } from "@playwright/test";

test("renders the homepage and primary navigation", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page).toHaveTitle(/Astro Starter/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Replace the content",
  );
  await expect(
    page.getByRole("link", { name: /Test the contact flow/ }),
  ).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("renders the responsive contact form", async ({ page }) => {
  await page.goto("/contact/");

  await expect(
    page.getByRole("heading", { name: "Contact", level: 1 }),
  ).toBeVisible();
  await expect(page.getByLabel("Name")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send message" }),
  ).toBeVisible();
});

test("renders the custom 404 page", async ({ page }) => {
  const response = await page.goto("/missing-page/");

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
});
