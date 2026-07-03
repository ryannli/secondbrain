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

// Bounds on how much history is packed into agent prompts. Without these,
// context grows with the library and every feed/capture gets slower forever.
export const AGENT_CONTEXT_CONFIG = {
  feedLibrarySources: 50,    // newest sources given to feed filtering/briefing (summaries only — cheap)
  connectionCandidates: 60,  // newest sources compared against a new capture
  interactionWindowDays: 30, // how far back reading interactions count
  maxSignalsPerType: 20,     // newest interactions kept per signal type
};

export const API_CONFIG = {
  braveSearchBaseUrl: "https://api.search.brave.com/res/v1",
  braveResultsPerQuery: 10, // Results per search query
};

export const DEFAULT_RSS_FEEDS: RssFeedSource[] = [
  { url: "https://hnrss.org/frontpage", label: "Hacker News" },
  { url: "https://www.reddit.com/r/singularity/.rss", label: "R/singularity" },
  { url: "https://www.reddit.com/r/ClaudeAI/.rss", label: "R/ClaudeAI" },
];

export const DEFAULT_SEARCH_SOURCES = ["reddit.com"];

// First-run starter pack: curated public reads a new user can capture with
// one click. Only titles and URLs ship here — each user's agent fetches and
// analyzes their own copy, so no third-party content lives in the repo.
export const STARTER_PACK: { title: string; url: string }[] = [
  { title: "Building a C compiler with parallel Claudes — Anthropic", url: "https://www.anthropic.com/engineering/building-c-compiler" },
  { title: "Harness engineering — OpenAI", url: "https://openai.com/index/harness-engineering/" },
  { title: "Bezos's Prometheus raises $12B — TechCrunch", url: "https://techcrunch.com/2026/06/11/jeff-bezoss-prometheus-raises-12b-to-build-an-artificial-general-engineer-for-the-physical-world/" },
  { title: "What to Do — Paul Graham", url: "https://www.paulgraham.com/do.html" },
];

// Seconds between starter-pack captures, so a laptop isn't asked to run
// five analysis pipelines at once.
export const STARTER_PACK_STAGGER_SECONDS = 15;

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
