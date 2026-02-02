import { SourceType } from "./types";
import { formatTextContent, extractReadableContent, generateTitle } from "./claude";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { fetchWithBrowser, requiresAuthentication } from "./browser";

/**
 * Determine source type from URL or content.
 * Type now represents FILE FORMAT, not content source.
 * Brand (YouTube, Twitter, etc.) is detected separately from source_url.
 */
export function getSourceType(url?: string, content?: string): SourceType {
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
 * Fetch content from URL using browser automation.
 * This handles dynamic/JS-rendered pages (Twitter, SPAs, etc.) and
 * uses the user's Chrome for authenticated content.
 */
export async function extractFromUrl(url: string): Promise<ExtractedContent> {
  const sourceType = getSourceType(url);
  const siteName = new URL(url).hostname;

  // Sites that require authentication should use Chrome Extension
  if (requiresAuthentication(url)) {
    console.log(`[Content] ${siteName} requires authentication, please use Chrome Extension`);
    throw new Error(
      `${siteName} requires login to view content. Please use the Chrome Extension to capture this page while logged in.`
    );
  }

  console.log(`[Content] Fetching with browser: ${url}`);

  // Use Playwright to fetch the fully rendered page
  const { html, title: pageTitle } = await fetchWithBrowser(url);

  console.log(`[Content] Got ${html.length} chars, processing...`);

  // Use Readability to extract article content
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  const title = article?.title || pageTitle || extractTitle(html) || siteName;
  const articleHtml = article?.content || "";
  const articleText = article?.textContent || "";

  let content: string;
  const cleanedContent = articleText.replace(/\s+/g, " ").trim();

  if (cleanedContent.length > 500 && articleHtml) {
    console.log(`[Content] Readability extracted ${cleanedContent.length} chars`);
    content = await extractReadableContent(articleHtml);
  } else {
    console.log(`[Content] Readability got ${cleanedContent.length} chars, using AI extraction`);
    content = await extractReadableContent(html);
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
  providedTitle?: string
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
    console.log(`Converting Readability HTML to Markdown (${cleanedContent.length} chars)...`);
    content = await extractReadableContent(articleHtml);
  } else {
    console.log(`Readability extracted only ${cleanedContent.length} chars, falling back to AI extraction...`);
    content = await extractReadableContent(html);
  }

  // If title is too long, use AI to generate a concise one
  if (title.length > 60) {
    console.log(`Title too long (${title.length} chars), using AI to generate concise title...`);
    title = await generateTitle(content);
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

function extractOgDescription(html: string): string | null {
  // Match og:description content - handle both attribute orders
  const match1 = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  if (match1) return decodeHtmlEntities(match1[1]);

  const match2 = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  if (match2) return decodeHtmlEntities(match2[1]);

  return null;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

