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

  // Build search plan with two tiers
  interface SearchTask {
    query: string;
    type: "news" | "web";
    tier: "base" | "additional";
  }
  const searchTasks: SearchTask[] = [];

  // TIER 1: Base layer - General news search (no site restriction)
  // Limited to 2 queries to save API quota
  for (const query of queries.slice(0, 2)) {
    searchTasks.push({ query, type: "news", tier: "base" });
  }

  // TIER 2: Additional layer - User's preferred sources
  // Limited searches to avoid rate limiting
  for (const source of preferredSources.slice(0, 2)) {
    // One search per source with first interest
    const interest = queries[0] || "news";
    searchTasks.push({ query: `${interest} site:${source}`, type: "web", tier: "additional" });
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

    // Rate limit: wait 1 second between requests (Brave free tier allows 1 req/sec)
    if (i > 0) {
      await sleep(1100);
    }

    try {
      // Use news or web search based on task type
      const endpoint = task.type === "news" ? "news/search" : "web/search";
      const url = new URL(`${API_CONFIG.braveSearchBaseUrl}/${endpoint}`);
      url.searchParams.set("q", task.query);
      url.searchParams.set("count", String(API_CONFIG.braveResultsPerQuery));
      if (task.type === "news") {
        url.searchParams.set("freshness", "pw"); // Past week for news
      }

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
