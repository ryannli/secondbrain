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
 * Combines results from multiple queries and deduplicates by URL
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

  // Build search plan: news queries + web queries for preferred sources
  interface SearchTask {
    query: string;
    type: "news" | "web";
  }
  const searchTasks: SearchTask[] = [];

  // Add news searches for interests
  for (const query of queries) {
    searchTasks.push({ query, type: "news" });
  }

  // Add web searches for preferred sources (use top 2 interests)
  for (const source of preferredSources.slice(0, 3)) {
    for (const interest of queries.slice(0, 2)) {
      searchTasks.push({ query: `${interest} site:${source}`, type: "web" });
    }
  }

  console.log(`[searchNews] Running ${searchTasks.length} searches`);

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
        console.error(`[searchNews] Brave API error for "${task.query}":`, response.status, response.statusText);
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

  return allResults;
}
