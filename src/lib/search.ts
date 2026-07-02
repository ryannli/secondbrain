import { debugLog } from "./log";
/**
 * Brave Search API integration for Feed feature
 */

import { API_CONFIG } from "./config";
import type { RssFeedSource } from "./storage";

export interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;                  // e.g. "2 hours ago"
  page_age?: string;             // ISO date if available
  meta_url?: {
    hostname: string;
  };
  thumbnail?: {
    src: string;
  };
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract text from an XML tag, handling CDATA and plain text.
 */
function xmlText(xml: string, tag: string): string {
  return xml.match(new RegExp(`<${tag}>[<!\\[CDATA\\[]*([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`))?.[1]
    || xml.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`))?.[1]
    || xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1]
    || "";
}

/**
 * Parse RSS 2.0 items from XML
 */
function parseRssItems(xml: string): { title: string; url: string; description: string; pubDate: string }[] {
  const items: { title: string; url: string; description: string; pubDate: string }[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const comments = xmlText(item, "comments");
    const link = xmlText(item, "link");
    items.push({
      title: xmlText(item, "title"),
      url: comments || link,  // Prefer <comments> (e.g. HN discussion)
      description: xmlText(item, "description"),
      pubDate: xmlText(item, "pubDate"),
    });
  }
  return items;
}

/**
 * Parse Atom entries from XML
 */
function parseAtomEntries(xml: string): { title: string; url: string; description: string; pubDate: string }[] {
  const items: { title: string; url: string; description: string; pubDate: string }[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];
    // Atom uses <link href="..." /> (self-closing with attribute)
    const link = entry.match(/<link[^>]*href="([^"]*)"[^>]*\/?\s*>/)?.[1] || "";
    items.push({
      title: xmlText(entry, "title"),
      url: link,
      description: xmlText(entry, "summary") || xmlText(entry, "content"),
      pubDate: xmlText(entry, "published") || xmlText(entry, "updated"),
    });
  }
  return items;
}

/**
 * Fetch any RSS/Atom feed and return results.
 * Handles both RSS 2.0 (<item>) and Atom (<entry>) formats.
 * 10s timeout to avoid blocking on slow feeds.
 */
async function fetchRSS(feedUrl: string, label: string): Promise<BraveSearchResult[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(feedUrl, {
      headers: {
        "User-Agent": "SecondBrain/1.0",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[fetchRSS] ${label} failed: ${response.status}`);
      return [];
    }

    const xml = await response.text();
    const hostname = new URL(feedUrl).hostname;

    // Try RSS 2.0 first, fall back to Atom
    let parsed = parseRssItems(xml);
    if (parsed.length === 0) {
      parsed = parseAtomEntries(xml);
    }

    const results: BraveSearchResult[] = [];
    for (const item of parsed) {
      if (!item.url) continue;

      let displayHost = hostname;
      try { displayHost = new URL(item.url).hostname; } catch { /* keep feed hostname */ }

      results.push({
        title: item.title,
        url: item.url,
        description: item.description.replace(/<[^>]*>/g, "").slice(0, 200),
        age: item.pubDate ? getRelativeTime(new Date(item.pubDate)) : undefined,
        page_age: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
        meta_url: { hostname: displayHost },
      });
    }

    debugLog(`[fetchRSS] ${label}: ${results.length} items`);
    return results;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[fetchRSS] ${label} error: ${msg}`);
    return [];
  }
}

/**
 * Convert date to relative time string
 */
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "just now";
  if (diffHours < 24) return `${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} days ago`;
}

/**
 * Search for news using Brave Search API + RSS feeds.
 *
 * RSS feeds are keyword-independent (just fetched).
 * Search sources are multiplied by interest radars (each keyword × each domain).
 *
 * @param queries - Search terms from user interests
 * @param searchSources - Domains for Brave Search (e.g., ["reddit.com"])
 * @param rssFeeds - RSS feeds to fetch directly
 * @returns results + counts for FeedSignals
 */
export async function searchNews(
  queries: string[],
  searchSources: string[] = [],
  rssFeeds: RssFeedSource[] = [],
): Promise<{ results: BraveSearchResult[]; rssFeedCount: number; searchCallCount: number }> {
  const allResults: BraveSearchResult[] = [];
  const seenUrls = new Set<string>();

  // 1. Fetch all RSS feeds in parallel (keyword-independent)
  if (rssFeeds.length > 0) {
    const rssResults = await Promise.all(
      rssFeeds.map(feed => fetchRSS(feed.url, feed.label))
    );
    for (const results of rssResults) {
      for (const result of results) {
        if (!seenUrls.has(result.url)) {
          seenUrls.add(result.url);
          allResults.push(result);
        }
      }
    }
  }

  // 2. Search via Brave API (queries × searchSources)
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  let searchCallCount = 0;

  if (apiKey && queries.length > 0) {
    interface SearchTask {
      query: string;
      type: "news" | "web";
      tier: "base" | "additional";
    }
    const searchTasks: SearchTask[] = [];

    for (const query of queries) {
      searchTasks.push({ query, type: "news", tier: "base" });
      for (const source of searchSources) {
        searchTasks.push({ query: `${query} site:${source}`, type: "web", tier: "additional" });
      }
    }

    debugLog(`[searchNews] Running ${searchTasks.length} searches:`);
    const baseTasks = searchTasks.filter(t => t.tier === "base");
    const additionalTasks = searchTasks.filter(t => t.tier === "additional");
    debugLog(`  Base layer (${baseTasks.length} searches - diverse sources):`);
    baseTasks.forEach((t, i) => debugLog(`    ${i + 1}. [${t.type}] ${t.query}`));
    debugLog(`  Additional layer (${additionalTasks.length} searches - user's preferred sources):`);
    additionalTasks.forEach((t, i) => debugLog(`    ${i + 1}. [${t.type}] ${t.query}`));

    for (let i = 0; i < searchTasks.length; i++) {
      const task = searchTasks[i];

      if (i > 0) {
        await sleep(100);
      }

      try {
        const endpoint = task.type === "news" ? "news/search" : "web/search";
        const url = new URL(`${API_CONFIG.braveSearchBaseUrl}/${endpoint}`);
        url.searchParams.set("q", task.query);
        url.searchParams.set("count", String(API_CONFIG.braveResultsPerQuery));
        url.searchParams.set("freshness", "pw");

        const response = await fetch(url.toString(), {
          headers: {
            "Accept": "application/json",
            "X-Subscription-Token": apiKey,
          },
        });

        searchCallCount++;

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "");
          console.error(`[searchNews] Brave API error for "${task.query}": ${response.status} ${response.statusText}`, errorBody.slice(0, 200));
          continue;
        }

        const data = await response.json();
        const results = task.type === "news"
          ? (data.results ?? [])
          : (data.web?.results ?? []);
        debugLog(`[searchNews] [${task.type}] "${task.query}" returned ${results.length} results`);

        for (const result of results) {
          if (seenUrls.has(result.url)) continue;
          seenUrls.add(result.url);

          allResults.push({
            title: result.title,
            url: result.url,
            description: result.description,
            age: result.age,
            page_age: result.page_age,
            meta_url: result.meta_url,
            thumbnail: result.thumbnail,
          });
        }
      } catch (error) {
        console.error(`[searchNews] Error searching for "${task.query}":`, error);
      }
    }
  } else if (!apiKey && queries.length > 0) {
    console.warn("[searchNews] BRAVE_SEARCH_API_KEY not set, skipping search (RSS-only mode)");
  }

  // Log summary
  const sourceCounts = new Map<string, number>();
  for (const r of allResults) {
    const host = r.meta_url?.hostname || new URL(r.url).hostname;
    sourceCounts.set(host, (sourceCounts.get(host) || 0) + 1);
  }
  debugLog(`[searchNews] Total ${allResults.length} results from ${sourceCounts.size} sources:`);
  [...sourceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([host, count]) => debugLog(`  - ${host}: ${count}`));

  return { results: allResults, rssFeedCount: rssFeeds.length, searchCallCount };
}
