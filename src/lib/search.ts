/**
 * Brave Search API integration for Feed feature
 */

import { API_CONFIG } from "./config";

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

interface BraveNewsResponse {
  results?: Array<{
    title: string;
    url: string;
    description: string;
    age?: string;
    page_age?: string;
    meta_url?: {
      hostname: string;
    };
    thumbnail?: {
      src: string;
    };
  }>;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch Hacker News frontpage via RSS (already sorted by hotness)
 */
async function fetchHackerNewsRSS(): Promise<BraveSearchResult[]> {
  try {
    const response = await fetch("https://hnrss.org/frontpage?count=30");
    if (!response.ok) {
      console.error(`[fetchHackerNewsRSS] Failed: ${response.status}`);
      return [];
    }

    const xml = await response.text();
    const results: BraveSearchResult[] = [];

    // Simple XML parsing for RSS items
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const item = match[1];
      const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
                 || item.match(/<title>(.*?)<\/title>/)?.[1] || "";
      const link = item.match(/<link>(.*?)<\/link>/)?.[1] || "";
      const description = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1]
                       || item.match(/<description>(.*?)<\/description>/)?.[1] || "";
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
      const comments = item.match(/<comments>(.*?)<\/comments>/)?.[1] || "";

      // Use HN discussion URL instead of original article URL
      if (comments) {
        results.push({
          title,
          url: comments,  // HN discussion page
          description: description.replace(/<[^>]*>/g, "").slice(0, 200),
          age: pubDate ? getRelativeTime(new Date(pubDate)) : undefined,
          page_age: pubDate ? new Date(pubDate).toISOString() : undefined,
          meta_url: { hostname: "news.ycombinator.com" },
        });
      }
    }

    console.log(`[fetchHackerNewsRSS] Fetched ${results.length} items from frontpage`);
    return results;
  } catch (error) {
    console.error("[fetchHackerNewsRSS] Error:", error);
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
 * Search for news using Brave Search API
 * Two-tier architecture:
 * 1. Base layer: General news search (no site restriction) for diverse sources
 * 2. Additional layer: User's preferred sources with engagement signals
 *
 * @param queries - Search terms from user interests
 * @param preferredSources - Domains to also search specifically (e.g., reddit.com)
 */
export async function searchNews(
  queries: string[],
  preferredSources: string[] = []
): Promise<BraveSearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    console.warn("[searchNews] BRAVE_SEARCH_API_KEY not set, skipping search");
    return [];
  }

  const allResults: BraveSearchResult[] = [];
  const seenUrls = new Set<string>();

  // Special handling: Use RSS for Hacker News (already sorted by hotness)
  const useHNRss = preferredSources.includes("news.ycombinator.com");
  const bravePreferredSources = preferredSources.filter(s => s !== "news.ycombinator.com");

  if (useHNRss) {
    const hnResults = await fetchHackerNewsRSS();
    for (const result of hnResults) {
      if (!seenUrls.has(result.url)) {
        seenUrls.add(result.url);
        allResults.push(result);
      }
    }
  }

  // Build search plan with two tiers (excluding HN if using RSS)
  interface SearchTask {
    query: string;
    type: "news" | "web";
    tier: "base" | "additional";
  }
  const searchTasks: SearchTask[] = [];

  // For each interest keyword, search:
  // 1. General news (no site restriction)
  // 2. Each preferred source (Reddit, etc. - HN handled via RSS)
  for (const query of queries) {
    // General news search
    searchTasks.push({ query, type: "news", tier: "base" });

    // Search each preferred source (excluding HN)
    for (const source of bravePreferredSources) {
      searchTasks.push({ query: `${query} site:${source}`, type: "web", tier: "additional" });
    }
  }

  console.log(`[searchNews] Running ${searchTasks.length} searches:`);
  const baseTasks = searchTasks.filter(t => t.tier === "base");
  const additionalTasks = searchTasks.filter(t => t.tier === "additional");
  console.log(`  Base layer (${baseTasks.length} searches - diverse sources):`);
  baseTasks.forEach((t, i) => console.log(`    ${i + 1}. [${t.type}] ${t.query}`));
  console.log(`  Additional layer (${additionalTasks.length} searches - user's preferred sources):`);
  additionalTasks.forEach((t, i) => console.log(`    ${i + 1}. [${t.type}] ${t.query}`));

  for (let i = 0; i < searchTasks.length; i++) {
    const task = searchTasks[i];

    // Rate limit: 20 req/sec = 50ms between requests (with buffer)
    if (i > 0) {
      await sleep(100);
    }

    try {
      // Use news or web search based on task type
      const endpoint = task.type === "news" ? "news/search" : "web/search";
      const url = new URL(`${API_CONFIG.braveSearchBaseUrl}/${endpoint}`);
      url.searchParams.set("q", task.query);
      url.searchParams.set("count", String(API_CONFIG.braveResultsPerQuery));
      url.searchParams.set("freshness", "pw"); // Past week for all searches

      const response = await fetch(url.toString(), {
        headers: {
          "Accept": "application/json",
          "X-Subscription-Token": apiKey,
        },
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        console.error(`[searchNews] Brave API error for "${task.query}": ${response.status} ${response.statusText}`, errorBody.slice(0, 200));
        continue;
      }

      const data = await response.json();
      // Web search has results in data.web.results, news has data.results
      const results = task.type === "news"
        ? (data.results ?? [])
        : (data.web?.results ?? []);
      console.log(`[searchNews] [${task.type}] "${task.query}" returned ${results.length} results`);

      for (const result of results) {
        // Deduplicate by URL
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

  // Log summary of sources found
  const sourceCounts = new Map<string, number>();
  for (const r of allResults) {
    const host = r.meta_url?.hostname || new URL(r.url).hostname;
    sourceCounts.set(host, (sourceCounts.get(host) || 0) + 1);
  }
  console.log(`[searchNews] Total ${allResults.length} results from ${sourceCounts.size} sources:`);
  [...sourceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([host, count]) => console.log(`  - ${host}: ${count}`));

  return allResults;
}
