import { debugLog } from "@/lib/log";
import { NextRequest, NextResponse } from "next/server";
import { loadFeedCache, saveFeedCache, listSourcesForConnections, loadUserConfig, loadFeedHistory, loadStarredBriefings, listFeedSnapshots, loadFeedSnapshot } from "@/lib/storage";
import { searchNews } from "@/lib/search";
import { filterFeedItems, generateBriefing, generateInsights, buildInteractionContext } from "@/lib/claude";
import { AGENT_CONTEXT_CONFIG, DEFAULT_RSS_FEEDS, DEFAULT_SEARCH_SOURCES, FEED_CONFIG } from "@/lib/config";
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
      const snapshotHistory = await loadFeedHistory();
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
          readBriefingTexts: snapshotHistory.readTexts ?? [],
        },
        availableDates,
      });
    }

    // Load starred briefing texts and read state (always needed regardless of cache)
    const starredBriefings = await loadStarredBriefings();
    const starredBriefingTexts = starredBriefings.items.map(i => i.text);
    const history = await loadFeedHistory();
    const readBriefingTexts = history.readTexts ?? [];

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
          message: cache.message,
          starredBriefingTexts,
          readBriefingTexts,
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
      feed: { ...feedResult, starredBriefingTexts, readBriefingTexts },
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
    const feedResult = await generateFeed();
    const starredBriefingsPost = await loadStarredBriefings();
    const historyPost = await loadFeedHistory();
    const availableDates = await listFeedSnapshots();

    return NextResponse.json({
      success: true,
      feed: {
        ...feedResult,
        starredBriefingTexts: starredBriefingsPost.items.map(i => i.text),
        readBriefingTexts: historyPost.readTexts ?? [],
      },
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
  debugLog("[generateFeed] Starting feed generation...");

  // 0. Load user config
  const config = await loadUserConfig();
  const rssFeeds = config.rssFeeds ?? DEFAULT_RSS_FEEDS;
  const searchSources = config.searchSources ?? DEFAULT_SEARCH_SOURCES;
  const feedInterests = config.feedInterests ?? [];
  const searchConfigured = Boolean(process.env.BRAVE_SEARCH_API_KEY);
  const rssOnlyMessage = !searchConfigured && feedInterests.length > 0 && searchSources.length > 0
    ? "Search API key is not configured, so this feed is running in RSS-only mode. Add BRAVE_SEARCH_API_KEY to .env.local and restart the dev server to enable web search."
    : undefined;
  debugLog(`[generateFeed] RSS feeds:`, rssFeeds.map(f => f.label));
  debugLog(`[generateFeed] Search sources:`, searchSources);
  debugLog(`[generateFeed] Feed interests:`, feedInterests);

  // 1. Allow RSS-only mode (no interests needed for RSS feeds)
  if (feedInterests.length === 0 && rssFeeds.length === 0) {
    return {
      items: [],
      interests: [],
      generatedAt: new Date().toISOString(),
      fromCache: false,
      message: "Add RSS feeds or topics to Your Radar in Settings to get personalized feed",
    };
  }

  const interests = feedInterests;

  // 2. Load the user's most recent sources for filtering/briefing context
  // (bounded — the whole library in every prompt slows generation as it grows)
  const sources = await listSourcesForConnections(undefined, undefined, AGENT_CONTEXT_CONFIG.feedLibrarySources);
  debugLog(`[generateFeed] Loaded ${sources.length} recent sources from library for filtering`);

  // 3. Search for news (RSS feeds + search sources)
  const { results: allSearchResults, rssFeedCount, searchCallCount } = await searchNews(interests, searchSources, rssFeeds);
  debugLog(`[generateFeed] Found ${allSearchResults.length} search results`);

  // 3.5 Filter out previously seen URLs
  const history = await loadFeedHistory();
  const seenUrls = new Set(history.seen.map((e) => e.url));
  const searchResults = allSearchResults.filter((r) => !seenUrls.has(r.url));
  debugLog(`[generateFeed] After dedup: ${searchResults.length} results (${allSearchResults.length - searchResults.length} seen before)`);

  if (searchResults.length === 0) {
    return {
      items: [],
      interests,
      generatedAt: new Date().toISOString(),
      fromCache: false,
      message: rssOnlyMessage ?? "No relevant news found",
    };
  }

  // 3.6 Extract interaction signals from the configured window
  const thirtyDaysAgo = Date.now() - AGENT_CONTEXT_CONFIG.interactionWindowDays * 24 * 60 * 60 * 1000;
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

  // 3.7 Include starred briefing items as interaction signals (same window)
  const starredBriefings = await loadStarredBriefings();
  for (const item of starredBriefings.items) {
    if (!item.starredAt || new Date(item.starredAt).getTime() <= thirtyDaysAgo) continue;
    interactionSignals.starredHighlights.push({
      text: item.text,
      sourceTitle: "Feed Briefing",
      at: item.starredAt,
    });
  }

  // Keep only the newest N per signal type so prompts stay bounded
  for (const list of Object.values(interactionSignals) as { at?: string }[][]) {
    list.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
    list.splice(AGENT_CONTEXT_CONFIG.maxSignalsPerType);
  }

  const totalInteractions = interactionSignals.starredHighlights.length + interactionSignals.dismissedHighlights.length
    + interactionSignals.learnedConcepts.length + interactionSignals.knewConcepts.length;
  const interactionContext = buildInteractionContext(interactionSignals);
  debugLog(`[generateFeed] Interaction signals: ${totalInteractions} total (${interactionSignals.starredHighlights.length} starred, ${interactionSignals.dismissedHighlights.length} dismissed, ${interactionSignals.learnedConcepts.length} learned, ${interactionSignals.knewConcepts.length} knew)`);

  // 4. Filter and score results
  const sourcesForFilter = sources.map((s) => ({
    id: s.id,
    title: s.title,
    summary: s.summary,
    concepts: s.concepts.map((c) => c.term),
  }));
  const allPreferredDomains = [
    ...rssFeeds.map(f => { try { return new URL(f.url).hostname; } catch { return ""; } }).filter(Boolean),
    ...searchSources,
  ];
  const feedItems = await filterFeedItems(searchResults, sourcesForFilter, allPreferredDomains, interactionContext, interests);
  debugLog(`[generateFeed] Filtered to ${feedItems.length} feed items`);

  // 5. Generate briefing
  const sourcesForBriefing = sources.map((s) => ({
    title: s.title,
    summary: s.summary,
    concepts: s.concepts.map((c) => c.term),
  }));
  const briefing = await generateBriefing(feedItems, sourcesForBriefing, interactionContext, interests);
  debugLog(`[generateFeed] Generated briefing: ${briefing ? briefing.news.length + " news items" : "none"}`);

  // 5.5 Generate insights from reading behavior (only if enough interactions)
  let insights: InsightItem[] = [];
  if (totalInteractions >= 3) {
    insights = await generateInsights(interactionSignals, sourcesForBriefing, interests);
    debugLog(`[generateFeed] Generated ${insights.length} insights`);
  }

  // 6. Save cache
  const generatedAt = new Date().toISOString();
  const signals: FeedSignals = {
    searchCalls: searchCallCount,
    rssFeedCount,
    radarCount: interests.length,
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
    message: rssOnlyMessage,
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
    message: rssOnlyMessage,
  };
}
