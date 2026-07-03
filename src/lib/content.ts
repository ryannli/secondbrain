import { debugLog } from "./log";
import { SourceType } from "./types";
import { extractReadableContent, generateTitle } from "./claude";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

/**
 * Determine source type from URL or content.
 * Type now represents FILE FORMAT, not content source.
 * Brand (YouTube, Twitter, etc.) is detected separately from source_url.
 */
export function getSourceType(url?: string): SourceType {
  if (url) {
    const pathname = new URL(url).pathname.toLowerCase();
    // PDF links
    if (pathname.endsWith(".pdf")) {
      return "document";
    }
    // All web pages are html type
    return "html";
  }

  // No URL = text content
  return "text";
}

/**
 * Get type from file extension for uploaded files
 */
export function getTypeFromExtension(filename: string): SourceType {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  // Images
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"].includes(ext)) {
    return "image";
  }

  // Documents
  if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "rtf"].includes(ext)) {
    return "document";
  }

  // HTML
  if (["html", "htm"].includes(ext)) {
    return "html";
  }

  // Default to text
  return "text";
}

export interface ExtractedContent {
  title: string;
  originalContent: string; // raw HTML
  content: string; // processed markdown
  type: SourceType;
  sourceUrl: string;
  siteName?: string;
}

/**
 * Check if URL requires authentication (Twitter, etc.)
 * These sites require the Chrome Extension for capture.
 */
function requiresAuthentication(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "x.com" || hostname === "twitter.com";
  } catch {
    return false;
  }
}

// Default fallback User-Agent if none provided
const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Fetch content from URL and extract readable content
 * @param url - The URL to fetch
 * @param userAgent - Optional User-Agent from the client's browser
 */
export async function extractFromUrl(url: string, userAgent?: string, sourceId?: string): Promise<ExtractedContent> {
  const sourceType = getSourceType(url);
  const siteName = new URL(url).hostname;

  // Sites that require authentication should use Chrome Extension
  if (requiresAuthentication(url)) {
    debugLog(`[Content] ${siteName} requires authentication, please use Chrome Extension`);
    throw new Error(
      `${siteName} requires login to view content. Please capture it with the [Chrome Extension](https://github.com/ryannli/secondbrain#chrome-extension) while logged in.`
    );
  }

  debugLog(`[Content] Fetching: ${url}`);

  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent || DEFAULT_USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
    },
  });

  if (!response.ok) {
    // Provide helpful error for blocked requests
    if (response.status === 403) {
      throw new Error(`This site blocks automated requests. Please use the browser extension to capture this page.`);
    }
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();

  debugLog(`[Content] Got ${html.length} chars, processing...`);

  // Use Readability to extract article content (same library as Firefox Reader View)
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  const title = article?.title || extractTitle(html) || siteName;
  const articleHtml = article?.content || "";
  const articleText = article?.textContent || "";

  let content: string;
  const cleanedContent = articleText.replace(/\s+/g, " ").trim();

  if (cleanedContent.length > 500 && articleHtml) {
    debugLog(`[Content] Readability extracted ${cleanedContent.length} chars`);
    content = await extractReadableContent(articleHtml, sourceId);
  } else {
    debugLog(`[Content] Readability got ${cleanedContent.length} chars, using AI extraction`);
    content = await extractReadableContent(html, sourceId);
  }

  return {
    title,
    originalContent: html,
    content,
    type: sourceType,
    sourceUrl: url,
    siteName,
  };
}

/**
 * Extract content from pre-rendered HTML (from browser extension)
 * This HTML already has JS executed, so content should be available
 */
export async function extractFromHtml(
  html: string,
  url?: string,
  providedTitle?: string,
  sourceId?: string
): Promise<ExtractedContent> {
  const sourceType = getSourceType(url);
  const siteName = url ? new URL(url).hostname : undefined;

  // Use Readability to extract article content
  const dom = new JSDOM(html, { url: url || "about:blank" });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  let title = providedTitle || article?.title || extractTitle(html) || "Untitled";
  const articleHtml = article?.content || "";
  const articleText = article?.textContent || "";

  let content: string;
  const cleanedContent = articleText.replace(/\s+/g, " ").trim();
  if (cleanedContent.length > 500 && articleHtml) {
    debugLog(`Converting Readability HTML to Markdown (${cleanedContent.length} chars)...`);
    content = await extractReadableContent(articleHtml, sourceId);
  } else {
    debugLog(`Readability extracted only ${cleanedContent.length} chars, falling back to AI extraction...`);
    content = await extractReadableContent(html, sourceId);
  }

  // If title is too long, use AI to generate a concise one
  if (title.length > 60) {
    debugLog(`Title too long (${title.length} chars), using AI to generate concise title...`);
    title = await generateTitle(content, sourceId);
  }

  return {
    title,
    originalContent: html,
    content,
    type: sourceType,
    sourceUrl: url || "",
    siteName,
  };
}

function extractTitle(html: string): string | null {
  // Try og:title first (usually the cleanest)
  const ogMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (ogMatch) return ogMatch[1];

  // Fall back to <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) return titleMatch[1].trim();

  return null;
}
