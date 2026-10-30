import { test, expect } from "@playwright/test";
test("demo matching, private likes and durable conversation", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the demo ↗", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Zara, 27", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Like Zara", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "The feeling’s mutual." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Say hello", exact: true }).click();
  await page
    .getByLabel("Your message")
    .fill("A little hello from the integration test.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText("A little hello from the integration test.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("A little hello from the integration test.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/likes");
  await expect(
    page.getByRole("link", { name: "Meet your admirers", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".like-card")).toHaveCount(0);
});
test("ordinary unauthenticated visitor cannot open admin", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/auth/);
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
});
test("all primary pages fit a mobile viewport", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the demo ↗", exact: true })
    .click();
  for (const path of [
    "/discover",
    "/likes",
    "/membership",
    "/messages",
    "/profile",
    "/admin",
    "/security",
  ]) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
  }
});
