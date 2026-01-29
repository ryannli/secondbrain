import { SourceType } from "./types";
import { formatTextContent, extractReadableContent } from "./claude";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

/**
 * Detect source type from URL
 */
export function detectSourceType(url: string): SourceType {
  const hostname = new URL(url).hostname.toLowerCase();
  const pathname = new URL(url).pathname.toLowerCase();

  // YouTube
  if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
    return "youtube";
  }

  // Twitter/X
  if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
    return "twitter";
  }

  // Podcast platforms
  if (
    hostname.includes("spotify.com") && pathname.includes("/episode") ||
    hostname.includes("podcasts.apple.com") ||
    hostname.includes("overcast.fm") ||
    hostname.includes("pocketcasts.com") ||
    hostname.includes("castbox.fm")
  ) {
    return "podcast";
  }

  // PDF links
  if (pathname.endsWith(".pdf")) {
    return "pdf";
  }

  // Default to article
  return "article";
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
 * Convert special URLs to fetch-friendly alternatives
 */
function getAlternativeUrl(url: string): string {
  const urlObj = new URL(url);

  // X/Twitter: use fxtwitter for static content
  if (urlObj.hostname === "x.com" || urlObj.hostname === "twitter.com") {
    urlObj.hostname = "fxtwitter.com";
    return urlObj.toString();
  }

  return url;
}

/**
 * Fetch content from URL and extract readable content
 */
export async function extractFromUrl(url: string): Promise<ExtractedContent> {
  const sourceType = detectSourceType(url);
  const fetchUrl = getAlternativeUrl(url);
  console.log(`Original URL: ${url}`);
  console.log(`Fetching from: ${fetchUrl}`);

  // User-Agent header is required - many websites reject requests without it.
  // This is a generic identifier, not environment-specific.
  const response = await fetch(fetchUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; SecondBrain/1.0)",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const siteName = new URL(url).hostname;

  // Special handling for Twitter/X - content is in og:description meta tag
  if (sourceType === "twitter") {
    const title = extractTitle(html) || "Tweet";
    const tweetContent = extractOgDescription(html);

    if (tweetContent) {
      console.log("Extracted Twitter content from og:description");
      return {
        title,
        originalContent: html,
        content: tweetContent,
        type: sourceType,
        sourceUrl: url,
        siteName,
      };
    }
  }

  // Use Readability to extract article content (same library as Firefox Reader View)
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  const title = article?.title || extractTitle(html) || new URL(url).hostname;
  // Use article.content (HTML) to preserve images, not textContent (plain text)
  const articleHtml = article?.content || "";
  const articleText = article?.textContent || "";

  let content: string;
  // Check actual content length after removing whitespace
  const cleanedContent = articleText.replace(/\s+/g, " ").trim();
  if (cleanedContent.length > 500 && articleHtml) {
    // Readability succeeded - convert HTML to Markdown (preserves images)
    console.log(`Converting Readability HTML to Markdown (${cleanedContent.length} chars)...`);
    content = await extractReadableContent(articleHtml);
  } else {
    // Readability failed (likely JS-rendered page) - fallback to AI extraction from full HTML
    console.log(`Readability extracted only ${cleanedContent.length} chars, falling back to AI extraction...`);
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
  const sourceType = url ? detectSourceType(url) : "article";
  const siteName = url ? new URL(url).hostname : undefined;

  // Use Readability to extract article content
  const dom = new JSDOM(html, { url: url || "about:blank" });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  const title = providedTitle || article?.title || extractTitle(html) || "Untitled";
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
