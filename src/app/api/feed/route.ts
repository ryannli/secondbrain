import { NextRequest, NextResponse } from "next/server";
import { loadFeedCache, saveFeedCache, listSourcesForConnections, loadUserConfig, loadFeedHistory, loadStarredBriefings, listFeedSnapshots, loadFeedSnapshot } from "@/lib/storage";
import { searchNews } from "@/lib/search";
import { extractUserInterests, filterFeedItems, generateBriefing, generateInsights, buildInteractionContext } from "@/lib/claude";
import { FEED_CONFIG } from "@/lib/config";
import { FeedCache, FeedSignals, InsightItem } from "@/lib/types";

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
export async function GET(request: NextRequest) {
  try {
    // Check for API key
    if (!process.env.BRAVE_SEARCH_API_KEY) {
      return NextResponse.json({
        success: true,
        feed: null,
        message: "Feed disabled: BRAVE_SEARCH_API_KEY not configured",
      });
    }

    // Load available snapshot dates
    const availableDates = await listFeedSnapshots();

    // Check if requesting a specific date's snapshot
    const dateParam = request.nextUrl.searchParams.get("date");
    if (dateParam) {
      const snapshot = await loadFeedSnapshot(dateParam);
      if (!snapshot) {
        return NextResponse.json(
          { success: false, error: `No feed snapshot for ${dateParam}` },
          { status: 404 }
        );
      }
      const starredBriefings = await loadStarredBriefings();
      return NextResponse.json({
        success: true,
        feed: {
          items: snapshot.items,
          interests: snapshot.interests,
          generatedAt: snapshot.generatedAt,
          fromCache: true,
          briefing: snapshot.briefing,
          signals: snapshot.signals,
          insights: snapshot.insights,
          starredBriefingTexts: starredBriefings.items.map(i => i.text),
        },
        availableDates,
      });
    }

    // Load starred briefing texts (always needed regardless of cache)
    const starredBriefings = await loadStarredBriefings();
    const starredBriefingTexts = starredBriefings.items.map(i => i.text);

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
          signals: cache.signals,
          insights: cache.insights,
          starredBriefingTexts,
        },
        availableDates,
      });
    }

    // Generate new feed
    const feedResult = await generateFeed();

    // Re-fetch available dates after generation (new snapshot may have been created)
    const updatedDates = await listFeedSnapshots();

    return NextResponse.json({
      success: true,
      feed: { ...feedResult, starredBriefingTexts },
      availableDates: updatedDates,
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
export async function POST() {
  try {
    // Check for API key
    if (!process.env.BRAVE_SEARCH_API_KEY) {
      return NextResponse.json({
        success: false,
        error: "Feed disabled: BRAVE_SEARCH_API_KEY not configured",
      }, { status: 400 });
    }

    const feedResult = await generateFeed();
    const starredBriefingsPost = await loadStarredBriefings();
    const availableDates = await listFeedSnapshots();

    return NextResponse.json({
      success: true,
      feed: { ...feedResult, starredBriefingTexts: starredBriefingsPost.items.map(i => i.text) },
      availableDates,
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
      message: "Add topics to Your Radar in Settings to get personalized feed",
    };
  }

  const interests = feedInterests;

  // 2. Load user's sources for filtering (to avoid showing what they already have)
  const sources = await listSourcesForConnections();
  console.log(`[generateFeed] Loaded ${sources.length} sources from library for filtering`);

  // 3. Search for news (including preferred sources)
  const allSearchResults = await searchNews(interests, feedSources);
  console.log(`[generateFeed] Found ${allSearchResults.length} search results`);

  // 3.5 Filter out previously seen URLs
  const history = await loadFeedHistory();
  const seenUrls = new Set(history.seen.map((e) => e.url));
  const searchResults = allSearchResults.filter((r) => !seenUrls.has(r.url));
  console.log(`[generateFeed] After dedup: ${searchResults.length} results (${allSearchResults.length - searchResults.length} seen before)`);

  if (searchResults.length === 0) {
    return {
      items: [],
      interests,
      generatedAt: new Date().toISOString(),
      fromCache: false,
      message: "No relevant news found",
    };
  }

  // 3.6 Extract interaction signals from past 30 days
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const interactionSignals: Parameters<typeof buildInteractionContext>[0] = {
    starredHighlights: [],
    dismissedHighlights: [],
    learnedConcepts: [],
    knewConcepts: [],
  };

  for (const s of sources) {
    for (const h of s.highlights) {
      if (!h.reactionAt || new Date(h.reactionAt).getTime() <= thirtyDaysAgo) continue;
      const entry = { text: h.text, sourceTitle: s.title, at: h.reactionAt };
      if (h.reaction === "star") interactionSignals.starredHighlights.push(entry);
      else if (h.reaction === "dismiss") interactionSignals.dismissedHighlights.push(entry);
    }
    for (const c of s.concepts) {
      if (!c.statusAt || new Date(c.statusAt).getTime() <= thirtyDaysAgo) continue;
      const entry = { term: c.term, sourceTitle: s.title, at: c.statusAt };
      if (c.status === "learned") interactionSignals.learnedConcepts.push(entry);
      else if (c.status === "knew") interactionSignals.knewConcepts.push(entry);
    }
  }

  // 3.7 Include starred briefing items as interaction signals
  const starredBriefings = await loadStarredBriefings();
  for (const item of starredBriefings.items) {
    interactionSignals.starredHighlights.push({
      text: item.text,
      sourceTitle: "Feed Briefing",
      at: item.starredAt,
    });
  }

  const totalInteractions = interactionSignals.starredHighlights.length + interactionSignals.dismissedHighlights.length
    + interactionSignals.learnedConcepts.length + interactionSignals.knewConcepts.length;
  const interactionContext = buildInteractionContext(interactionSignals);
  console.log(`[generateFeed] Interaction signals: ${totalInteractions} total (${interactionSignals.starredHighlights.length} starred, ${interactionSignals.dismissedHighlights.length} dismissed, ${interactionSignals.learnedConcepts.length} learned, ${interactionSignals.knewConcepts.length} knew)`);

  // 4. Filter and score results
  const sourcesForFilter = sources.map((s) => ({
    id: s.id,
    title: s.title,
    summary: s.summary,
    concepts: s.concepts.map((c) => c.term),
  }));
  const feedItems = await filterFeedItems(searchResults, sourcesForFilter, feedSources, interactionContext, interests);
  console.log(`[generateFeed] Filtered to ${feedItems.length} feed items`);

  // 5. Generate briefing
  const sourcesForBriefing = sources.map((s) => ({
    title: s.title,
    summary: s.summary,
    concepts: s.concepts.map((c) => c.term),
  }));
  const briefing = await generateBriefing(feedItems, sourcesForBriefing, interactionContext, interests);
  console.log(`[generateFeed] Generated briefing: ${briefing ? briefing.news.length + " news items" : "none"}`);

  // 5.5 Generate insights from reading behavior (only if enough interactions)
  let insights: InsightItem[] = [];
  if (totalInteractions >= 3) {
    insights = await generateInsights(interactionSignals, sourcesForBriefing, interests);
    console.log(`[generateFeed] Generated ${insights.length} insights`);
  }

  // 6. Save cache
  const generatedAt = new Date().toISOString();
  const signals: FeedSignals = {
    searchCalls: (feedSources.includes("news.ycombinator.com") ? 1 : 0)
      + interests.length * (1 + feedSources.filter(s => s !== "news.ycombinator.com").length),
    libraryCount: sources.length,
    interactionCount: totalInteractions,
  };
  const cache: FeedCache = {
    generatedAt,
    interests,
    items: feedItems,
    briefing: briefing ?? undefined,
    signals,
    insights: insights.length > 0 ? insights : undefined,
  };
  await saveFeedCache(cache);

  return {
    items: feedItems,
    interests,
    generatedAt,
    fromCache: false,
    briefing: briefing ?? undefined,
    signals,
    insights: insights.length > 0 ? insights : undefined,
  };
}
