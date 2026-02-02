import { chromium, BrowserContext } from "playwright";
import * as os from "os";
import * as path from "path";

/**
 * Get the default Chrome profile path for the current OS
 */
function getChromeProfilePath(): string {
  const platform = os.platform();
  const home = os.homedir();

  switch (platform) {
    case "darwin": // macOS
      return path.join(home, "Library", "Application Support", "Google", "Chrome");
    case "win32": // Windows
      return path.join(home, "AppData", "Local", "Google", "Chrome", "User Data");
    case "linux":
      return path.join(home, ".config", "google-chrome");
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Check if URL requires authentication (Twitter, etc.)
 * These sites require the Chrome Extension for capture.
 */
export function requiresAuthentication(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "x.com" || hostname === "twitter.com";
  } catch {
    return false;
  }
}

/**
 * Fetch a URL using Playwright browser automation.
 * This enables capturing content from sites that require authentication (Twitter, paywalls, etc.)
 *
 * The browser runs in headless mode - completely invisible to the user.
 */
export async function fetchWithBrowser(url: string): Promise<{ html: string; title: string }> {
  console.log(`[Browser] Opening URL: ${url}`);

  let context: BrowserContext | null = null;

  try {
    const chromeProfilePath = getChromeProfilePath();
    console.log(`[Browser] Using Chrome profile: ${chromeProfilePath}`);

    // Use launchPersistentContext to access user's Chrome profile with login sessions
    // This gives us access to cookies, localStorage, etc.
    // Note: This will fail if Chrome is already running with this profile
    try {
      context = await chromium.launchPersistentContext(
        path.join(chromeProfilePath, "Default"),
        {
          headless: true,
          channel: "chrome",
          args: [
            "--disable-blink-features=AutomationControlled", // Avoid detection
          ],
        }
      );
      console.log(`[Browser] Using persistent context with user profile`);
    } catch (profileError) {
      // If profile is locked (Chrome is running), fall back to new context
      console.log(`[Browser] Could not use Chrome profile (${profileError}), using fresh context`);
      const browser = await chromium.launch({
        headless: true,
        channel: "chrome",
        args: ["--disable-blink-features=AutomationControlled"],
      });
      context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      });
    }

    const page = await context.newPage();

    // Navigate and wait for initial load
    console.log(`[Browser] Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Wait for React/JS apps to render
    // Twitter uses React and needs time to hydrate
    console.log(`[Browser] Waiting for JS to render...`);
    await page.waitForTimeout(3000);

    // Try to wait for actual content to appear
    try {
      // For Twitter, wait for tweet content or timeline
      await page.waitForSelector('[data-testid="tweetText"], [data-testid="tweet"], article', {
        timeout: 10000,
      });
      console.log(`[Browser] Content detected`);
    } catch {
      console.log(`[Browser] No specific content selector found, continuing anyway`);
    }

    // Additional wait for dynamic content
    await page.waitForTimeout(2000);

    // Scroll down to trigger lazy loading (for feeds like Twitter)
    await autoScroll(page);

    // Get the fully rendered HTML
    const html = await page.content();
    const title = await page.title();

    console.log(`[Browser] Captured ${html.length} chars from: ${title}`);

    return { html, title };
  } finally {
    // Clean up
    if (context) await context.close();
  }
}

/**
 * Try to load Chrome session cookies for the target domain
 */
async function loadChromeSession(
  context: BrowserContext,
  profilePath: string,
  url: string
): Promise<void> {
  // Chrome stores cookies in a SQLite database
  // For a full implementation, we'd need to:
  // 1. Copy the Cookies file (it's locked when Chrome is running)
  // 2. Read it with better-sqlite3
  // 3. Decrypt cookies (they're encrypted on macOS with Keychain)
  //
  // For now, we'll note this as a TODO and proceed without cookies.
  // Users can still capture public content, and we can add cookie support later.

  console.log(`[Browser] Cookie loading not yet implemented - proceeding without login session`);

  // Alternative approach: Use a separate Chrome profile that we control
  // This would allow users to log in once in that profile
}

/**
 * Auto-scroll the page to trigger lazy loading
 */
async function autoScroll(page: import("playwright").Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 500;
      const maxScrolls = 5; // Limit scrolling
      let scrollCount = 0;

      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        scrollCount++;

        if (totalHeight >= scrollHeight || scrollCount >= maxScrolls) {
          clearInterval(timer);
          // Scroll back to top
          window.scrollTo(0, 0);
          resolve();
        }
      }, 200);
    });
  });
}

/**
 * Check if browser use is available
 */
export async function isBrowserAvailable(): Promise<boolean> {
  try {
    const browser = await chromium.launch({ headless: true, channel: "chrome" });
    await browser.close();
    return true;
  } catch {
    return false;
  }
}
