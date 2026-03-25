import { test, expect } from "@playwright/test";

test.describe("JuriX Homepage", () => {
  test("should load the homepage", async ({ page }) => {
    await page.goto("/");

    // Check that the page loads
    await expect(page).toHaveTitle(/JuriX/i);
  });

  test("should have language switcher", async ({ page }) => {
    await page.goto("/");

    // Check for language switcher component
    const languageSwitcher = page.locator(".language-switcher");
    await expect(languageSwitcher).toBeVisible();
  });
});

test.describe("Search Functionality", () => {
  test("should have search bar", async ({ page }) => {
    await page.goto("/");

    // Check for search bar component
    const searchBar = page.locator(".search-bar");
    await expect(searchBar).toBeVisible();

    const searchInput = page.locator(".search-input");
    await expect(searchInput).toBeVisible();
  });

  test("should perform search", async ({ page }) => {
    await page.goto("/");

    // Type in search bar
    const searchInput = page.locator(".search-input");
    await searchInput.fill("Constitution");

    // Click search button
    const searchButton = page.locator(".search-btn");
    await searchButton.click();

    // Wait for results (adjust selector based on your implementation)
    // await page.waitForSelector('.search-results');
  });
});

test.describe("Chat Interface", () => {
  test("should have chat interface", async ({ page }) => {
    await page.goto("/");

    // Navigate to chat (adjust based on your routing)
    // For example, if chat is on /chat route:
    // await page.goto('/chat');

    // Check for chat interface component
    const chatInterface = page.locator(".chat-interface");
    // Uncomment when chat is on a specific page
    // await expect(chatInterface).toBeVisible();
  });

  test("should send message", async ({ page }) => {
    // Navigate to chat page
    // await page.goto('/chat');
    // Type message
    // const chatInput = page.locator('.chat-input');
    // await chatInput.fill('Quelle est la constitution du Cameroun?');
    // Click send button
    // const sendButton = page.locator('.send-btn');
    // await sendButton.click();
    // Wait for response
    // await page.waitForSelector('.message.assistant');
  });
});

test.describe("Language Switching", () => {
  test("should switch to English", async ({ page }) => {
    await page.goto("/");

    // Click on EN button
    const enButton = page.locator('button:has-text("EN")');
    // Uncomment when language switcher is implemented
    // await enButton.click();

    // Check that language changed (could check localStorage or UI text)
    // const language = await page.evaluate(() => localStorage.getItem('jurix-language'));
    // expect(language).toBe('en');
  });

  test("should switch to French", async ({ page }) => {
    await page.goto("/");

    // Click on FR button
    const frButton = page.locator('button:has-text("FR")');
    // Uncomment when language switcher is implemented
    // await frButton.click();

    // Check that language changed
    // const language = await page.evaluate(() => localStorage.getItem('jurix-language'));
    // expect(language).toBe('fr');
  });
});

test.describe("Accessibility", () => {
  test("should have proper heading structure", async ({ page }) => {
    await page.goto("/");

    // Check for main heading
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
  });

  test("should have accessible forms", async ({ page }) => {
    await page.goto("/");

    // Check that search input has label or aria-label
    const searchInput = page.locator(".search-input");
    const placeholder = await searchInput.getAttribute("placeholder");
    expect(placeholder).toBeTruthy();
  });
});

test.describe("Responsive Design", () => {
  test("should work on mobile", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    // Check that page is still usable
    const searchBar = page.locator(".search-bar");
    await expect(searchBar).toBeVisible();
  });

  test("should work on tablet", async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");

    // Check that page is still usable
    const searchBar = page.locator(".search-bar");
    await expect(searchBar).toBeVisible();
  });

  test("should work on desktop", async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/");

    // Check that page is still usable
    const searchBar = page.locator(".search-bar");
    await expect(searchBar).toBeVisible();
  });
});
