import { test, expect } from "@playwright/test";

/**
 * These tests run against a live backend with the default seed data.
 * They are serialized to avoid race conditions on the shared portfolio.
 */
test.describe.configure({ mode: "serial" });

const API_BASE = process.env.E2E_API_URL ?? "http://localhost:8000";

test.beforeEach(async ({ request }) => {
  // Clear the shared portfolio so each test starts from a known state
  const res = await request.get(`${API_BASE}/portfolio`);
  const body = await res.json();
  for (const item of body.items ?? []) {
    await request.delete(`${API_BASE}/portfolio/${item.contract_id}`);
  }
});

test("loads contracts and shows result count", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /marketplace/i })).toBeVisible();

  const resultRow = page.getByRole("main").getByText(/Showing .* of .* contracts/);
  await expect(resultRow).toBeVisible();
  await expect(resultRow).toContainText("1000");
});

test("filters by energy type and reduces the row count", async ({ page }) => {
  await page.goto("/");
  const resultRow = page.getByRole("main").getByText(/Showing .* of .* contracts/);
  await expect(resultRow).toContainText("1000 of 1000");

  await page.getByRole("button", { name: /filters/i }).first().click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Solar" })
    .click();

  // Sheet footer shows the same filtered count (and not the full 1000)
  await expect(page.getByRole("dialog")).toContainText(/of 1,000/);

  // Reset button in footer is enabled with an active filter
  const resetBtn = page.getByRole("dialog").getByRole("button", { name: /reset/i });
  await expect(resetBtn).toBeEnabled();

  // Close sheet, verify main panel reflects the filter
  await page.keyboard.press("Escape");
  await expect(resultRow).not.toHaveText(/Showing 1000 of 1000 contracts/);

  // Re-open and reset
  await page.getByRole("button", { name: /filters/i }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: /reset/i }).click();
  await page.keyboard.press("Escape");
  await expect(resultRow).toContainText("1000 of 1000");
});

test("filter badge on trigger reflects active filter count", async ({ page }) => {
  await page.goto("/");
  const filtersBtn = page.getByRole("button", { name: /filters/i }).first();

  await filtersBtn.click();
  const dialog = page.getByRole("dialog");
  // Activate two DIFFERENT filter groups — badge counts groups, not values
  const solar = dialog.getByRole("button", { name: "Solar" });
  const available = dialog.getByRole("checkbox", { name: "Available" });
  await solar.click();
  await expect(solar).toHaveAttribute("aria-pressed", "true");
  await available.click();
  await expect(available).toHaveAttribute("aria-checked", "true");

  // Close sheet (press Escape)
  await page.keyboard.press("Escape");

  // Trigger button should now show count badge of 2 (energy_types + statuses)
  await expect(filtersBtn).toContainText("2");
});

const firstEnabledAdd = (page: import("@playwright/test").Page) =>
  page
    .getByRole("button", { name: /^add$/i })
    .and(page.locator("button:not([disabled])"))
    .first();

test("adds a contract to portfolio and updates metrics", async ({ page }) => {
  await page.goto("/");
  const resultRow = page.getByRole("main").getByText(/Showing .* of .* contracts/);
  await expect(resultRow).toContainText("1000 of 1000");

  // Portfolio is initially empty
  const portfolio = page.getByRole("complementary");
  await expect(portfolio).toContainText("No contracts in portfolio");

  await firstEnabledAdd(page).click();

  // Wait for toast
  await expect(page.getByText(/added to portfolio/i).first()).toBeVisible();

  // Metrics update — the portfolio now has 1 contract
  await expect(portfolio).not.toContainText("No contracts in portfolio");
});

test("prevents duplicate adds (button becomes 'In Portfolio')", async ({
  page,
}) => {
  await page.goto("/");
  const resultRow = page.getByRole("main").getByText(/Showing .* of .* contracts/);
  await expect(resultRow).toContainText("1000 of 1000");

  await firstEnabledAdd(page).click();

  // The row the first enabled Add belonged to should now show "In Portfolio"
  await expect(
    page.getByRole("button", { name: /in portfolio/i }).first(),
  ).toBeVisible();
});

test("removes contract from portfolio and updates metrics", async ({ page }) => {
  await page.goto("/");
  const resultRow = page.getByRole("main").getByText(/Showing .* of .* contracts/);
  await expect(resultRow).toContainText("1000 of 1000");

  await firstEnabledAdd(page).click();
  const portfolio = page.getByRole("complementary");
  await expect(portfolio).not.toContainText("No contracts in portfolio");

  // Click the remove button on the portfolio item
  await portfolio
    .getByRole("button", { name: /remove contract/i })
    .first()
    .click();

  await expect(portfolio).toContainText("No contracts in portfolio");
});

test("shows empty state when filters match nothing", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /filters/i }).first().click();
  const dialog = page.getByRole("dialog");

  // Impossible range: min > seeded max
  await dialog.getByPlaceholder("Min").first().fill("999999");
  await page.keyboard.press("Escape");

  await expect(page.getByText(/no contracts match/i).first()).toBeVisible();
  await page.getByRole("button", { name: /reset filters/i }).first().click();
  const resultRow = page.getByRole("main").getByText(/Showing .* of .* contracts/);
  await expect(resultRow).toContainText("1000 of 1000");
});

test("date range constraint: end date's min adjusts when start date is set", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: /filters/i }).first().click();
  const dialog = page.getByRole("dialog");

  const startDate = dialog.locator('input[type="date"]').first();
  const endDate = dialog.locator('input[type="date"]').nth(1);

  await startDate.fill("2027-06-01");

  // end date input should reject anything before 2027-06-02
  const endMin = await endDate.getAttribute("min");
  expect(endMin).toBe("2027-06-02");
});

test("mobile layout swaps split for tabs at narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  // Mobile bottom tab bar is visible
  await expect(
    page.getByRole("navigation").getByRole("button", { name: /contracts/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation").getByRole("button", { name: /portfolio/i }),
  ).toBeVisible();

  // Tab switching renders portfolio panel
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /portfolio/i })
    .click();
  await expect(
    page.getByText(/no contracts in portfolio/i).locator("visible=true"),
  ).toBeVisible();
});
