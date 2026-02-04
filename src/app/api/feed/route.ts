import { NextRequest, NextResponse } from "next/server";
import { loadFeedCache, saveFeedCache, listSourcesForConnections, loadUserConfig } from "@/lib/storage";
import { searchNews } from "@/lib/search";
import { extractUserInterests, filterFeedItems, generateBriefing } from "@/lib/claude";
import { FEED_CONFIG } from "@/lib/config";
import { FeedCache } from "@/lib/types";

/**
 * Check if cache is still fresh
 */
function isCacheFresh(cache: FeedCache): boolean {
  const generatedAt = new Date(cache.generatedAt).getTime();
  const now = Date.now();
  const cacheAgeHours = (now - generatedAt) / (1000 * 60 * 60);
  return cacheAgeHours < FEED_CONFIG.cacheHours;
}

/**
 * GET /api/feed
 * Returns cached feed or generates new one
 */
export async function GET() {
  try {
    // Check for API key
    if (!process.env.BRAVE_SEARCH_API_KEY) {
      return NextResponse.json({
        success: true,
        feed: null,
        message: "Feed disabled: BRAVE_SEARCH_API_KEY not configured",
      });
    }

    // Check cache
    const cache = await loadFeedCache();
    if (cache && isCacheFresh(cache)) {
      return NextResponse.json({
        success: true,
        feed: {
          items: cache.items,
          interests: cache.interests,
          generatedAt: cache.generatedAt,
          fromCache: true,
          briefing: cache.briefing,
        },
      });
    }

    // Generate new feed
    const feedResult = await generateFeed();

    return NextResponse.json({
      success: true,
      feed: feedResult,
    });
  } catch (error) {
    console.error("[GET /api/feed] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/feed/refresh
 * Force regenerate feed (bypasses cache)
 */
export async function POST(request: NextRequest) {
  try {
    // Check for API key
    if (!process.env.BRAVE_SEARCH_API_KEY) {
      return NextResponse.json({
        success: false,
        error: "Feed disabled: BRAVE_SEARCH_API_KEY not configured",
      }, { status: 400 });
    }

    const feedResult = await generateFeed();

    return NextResponse.json({
      success: true,
      feed: feedResult,
    });
  } catch (error) {
    console.error("[POST /api/feed] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Generate feed from user's library
 */
async function generateFeed() {
  console.log("[generateFeed] Starting feed generation...");

  // 0. Load user config
  const config = await loadUserConfig();
  const DEFAULT_FEED_SOURCES = ["reddit.com", "news.ycombinator.com"];
  const feedSources = config.feedSources ?? DEFAULT_FEED_SOURCES;
  const feedInterests = config.feedInterests ?? [];
  console.log(`[generateFeed] Feed sources:`, feedSources);
  console.log(`[generateFeed] Feed interests:`, feedInterests);

  // 1. Use configured interests, or require configuration
  if (feedInterests.length === 0) {
    return {
      items: [],
      interests: [],
      generatedAt: new Date().toISOString(),
      fromCache: false,
      message: "Configure your interests in Settings to get personalized feed",
    };
  }

  const interests = feedInterests;

  // 2. Load user's sources for filtering (to avoid showing what they already have)
  const sources = await listSourcesForConnections();
  console.log(`[generateFeed] Loaded ${sources.length} sources from library for filtering`);

  // 3. Search for news (including preferred sources)
  const searchResults = await searchNews(interests, feedSources);
  console.log(`[generateFeed] Found ${searchResults.length} search results`);

  if (searchResults.length === 0) {
    return {
      items: [],
      interests,
      generatedAt: new Date().toISOString(),
      fromCache: false,
      message: "No relevant news found",
    };
  }

  // 4. Filter and score results
  const sourcesForFilter = sources.map((s) => ({
    id: s.id,
    title: s.title,
    summary: s.summary,
    concepts: s.concepts.map((c) => c.term),
  }));
  const feedItems = await filterFeedItems(searchResults, sourcesForFilter, feedSources);
  console.log(`[generateFeed] Filtered to ${feedItems.length} feed items`);

  // 5. Generate briefing
  const sourcesForBriefing = sources.map((s) => ({
    title: s.title,
    concepts: s.concepts.map((c) => c.term),
  }));
  const briefing = await generateBriefing(feedItems, sourcesForBriefing);
  console.log(`[generateFeed] Generated briefing: ${briefing.slice(0, 100)}...`);

  // 6. Save cache
  const generatedAt = new Date().toISOString();
  const cache: FeedCache = {
    generatedAt,
    interests,
    items: feedItems,
    briefing,
  };
  await saveFeedCache(cache);

  return {
    items: feedItems,
    interests,
    generatedAt,
    fromCache: false,
    briefing,
  };
}
