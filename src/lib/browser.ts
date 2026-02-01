import { chromium, Browser, BrowserContext } from "playwright";
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
 * Fetch a URL using the user's Chrome browser with their existing login sessions.
 * This enables capturing content from sites that require authentication (Twitter, paywalls, etc.)
 *
 * The browser runs in headless mode - completely invisible to the user.
 */
export async function fetchWithBrowser(url: string): Promise<{ html: string; title: string }> {
  console.log(`[Browser] Opening URL: ${url}`);

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    const chromeProfilePath = getChromeProfilePath();
    console.log(`[Browser] Using Chrome profile: ${chromeProfilePath}`);

    // Launch browser with user's Chrome profile for login sessions
    // Note: We use chromium.launch with a separate user data dir copy
    // because launchPersistentContext locks the profile (can't use if Chrome is open)
    browser = await chromium.launch({
      headless: true,
      channel: "chrome", // Use installed Chrome instead of bundled Chromium
    });

    // Create context - we'll copy cookies from Chrome profile
    context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    // Try to load cookies from Chrome profile
    try {
      await loadChromeSession(context, chromeProfilePath, url);
    } catch (err) {
      console.log(`[Browser] Could not load Chrome session (will proceed without login): ${err}`);
    }

    const page = await context.newPage();

    // Navigate and wait for content to load
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Wait a bit more for any lazy-loaded content
    await page.waitForTimeout(1000);

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
    if (browser) await browser.close();
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
