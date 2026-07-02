/**
 * Global configuration for Second Brain
 * All tunable parameters in one place for easy adjustment
 */

import type { RssFeedSource } from "./storage";

export const FEED_CONFIG = {
  cacheHours: 6,           // How long to cache feed results
  maxInterests: 5,         // Max search topics to extract from library
  maxFeedItems: 30,        // Max items to show in feed (from ~50 search results)
};

export const API_CONFIG = {
  braveSearchBaseUrl: "https://api.search.brave.com/res/v1",
  braveResultsPerQuery: 10, // Results per search query
};

export const DEFAULT_RSS_FEEDS: RssFeedSource[] = [
  { url: "https://hnrss.org/frontpage", label: "Hacker News" },
  { url: "https://www.reddit.com/r/singularity/.rss", label: "r/singularity" },
  { url: "https://www.reddit.com/r/LocalLLaMA/.rss", label: "r/LocalLLaMA" },
  { url: "https://www.reddit.com/r/ClaudeAI/.rss", label: "r/ClaudeAI" },
];

export const DEFAULT_SEARCH_SOURCES = ["reddit.com"];

export const SUGGESTED_SEARCH_SOURCES = [
  { domain: "reddit.com", label: "Reddit" },
  { domain: "arstechnica.com", label: "Ars Technica" },
  { domain: "theverge.com", label: "The Verge" },
  { domain: "wired.com", label: "Wired" },
  { domain: "techcrunch.com", label: "TechCrunch" },
  { domain: "nytimes.com", label: "New York Times" },
  { domain: "bloomberg.com", label: "Bloomberg" },
  { domain: "theguardian.com", label: "The Guardian" },
];
