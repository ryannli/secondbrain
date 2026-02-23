export interface TrackingEvent {
  t: string;         // ISO time (time portion only for compactness)
  e: string;         // event type: click, navigate, scroll, visibility, session
  track?: string;    // data-track value if present
  text?: string;     // element text (truncated)
  tag?: string;      // element tag name
  ctx?: Record<string, string>; // data-track-* context attributes
  path?: string;     // current URL path + search
  from?: string;     // previous path (for navigate events)
  to?: string;       // new path (for navigate events)
  depth?: number;    // scroll depth 0-1
  state?: string;    // visibility state
  tz?: number;       // timezone offset in minutes (e.g. -480 for PST)
}

const FLUSH_INTERVAL = 5_000;
const FLUSH_SIZE = 20;
const MAX_TEXT_LENGTH = 40;

const INTERACTIVE_SELECTOR = "button, a, [role='button'], input, label, [onclick], [data-track], .cursor-pointer";

export function createTracker() {
  let buffer: TrackingEvent[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;

  function flush() {
    if (buffer.length === 0) return;
    const events = buffer;
    buffer = [];
    try {
      const blob = new Blob([JSON.stringify(events)], { type: "application/json" });
      navigator.sendBeacon("/api/tracking", blob);
    } catch {
      // Silently fail — tracking should never break the app
    }
  }

  function push(event: TrackingEvent) {
    buffer.push(event);
    if (buffer.length >= FLUSH_SIZE) flush();
  }

  function start() {
    timer = setInterval(flush, FLUSH_INTERVAL);
  }

  function stop() {
    if (timer) clearInterval(timer);
    flush();
  }

  return { push, flush, start, stop };
}

export type Tracker = ReturnType<typeof createTracker>;

function truncate(s: string, max = MAX_TEXT_LENGTH): string {
  const trimmed = s.trim().replace(/\s+/g, " ");
  return trimmed.length > max ? trimmed.slice(0, max) + "..." : trimmed;
}

export function extractTrackInfo(el: HTMLElement): Pick<TrackingEvent, "track" | "text" | "tag" | "ctx"> {
  const result: Pick<TrackingEvent, "track" | "text" | "tag" | "ctx"> = {};

  // Walk up to find data-track
  let current: HTMLElement | null = el;
  while (current && !current.dataset.track) {
    current = current.parentElement;
    // Stop at reasonable depth
    if (current && current === document.body) { current = null; break; }
  }

  if (current?.dataset.track) {
    result.track = current.dataset.track;
    // Collect data-track-* attributes as context
    const ctx: Record<string, string> = {};
    for (const [key, value] of Object.entries(current.dataset)) {
      if (key.startsWith("track") && key !== "track" && value) {
        ctx[key.replace("track", "").toLowerCase()] = value;
      }
    }
    if (Object.keys(ctx).length > 0) result.ctx = ctx;
  }

  // Fallback: text content and tag
  const text = el.textContent || el.getAttribute("aria-label") || el.getAttribute("title") || "";
  if (text) result.text = truncate(text);
  result.tag = el.tagName.toLowerCase();

  return result;
}

function getCurrentPath(): string {
  return window.location.pathname + window.location.search;
}

function now(): string {
  return new Date().toISOString();
}

export function setupAutoCapture(tracker: Tracker): () => void {
  const cleanups: (() => void)[] = [];

  // Emit session start with timezone
  tracker.push({ t: now(), e: "session", tz: new Date().getTimezoneOffset(), path: getCurrentPath() });

  // Click handler
  function handleClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target?.closest) return;
    const interactive = target.closest(INTERACTIVE_SELECTOR) as HTMLElement | null;
    if (!interactive) return;

    const info = extractTrackInfo(interactive);
    tracker.push({ t: now(), e: "click", ...info, path: getCurrentPath() });
  }
  document.addEventListener("click", handleClick, true);
  cleanups.push(() => document.removeEventListener("click", handleClick, true));

  // Visibility change
  function handleVisibility() {
    tracker.push({ t: now(), e: "visibility", state: document.visibilityState, path: getCurrentPath() });
    if (document.visibilityState === "hidden") tracker.flush();
  }
  document.addEventListener("visibilitychange", handleVisibility);
  cleanups.push(() => document.removeEventListener("visibilitychange", handleVisibility));

  // Scroll tracking (debounced, 10%+ change)
  let lastDepth = 0;
  let scrollTimer: ReturnType<typeof setTimeout> | null = null;
  function handleScroll() {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const el = document.querySelector("main .overflow-y-auto") as HTMLElement | null;
      if (!el) return;
      const depth = Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100) / 100;
      if (Math.abs(depth - lastDepth) >= 0.1) {
        lastDepth = depth;
        tracker.push({ t: now(), e: "scroll", depth, path: getCurrentPath() });
      }
    }, 500);
  }
  // Attach to main scroll container after a brief delay
  const attachScroll = setTimeout(() => {
    const scrollEl = document.querySelector("main .overflow-y-auto");
    if (scrollEl) {
      scrollEl.addEventListener("scroll", handleScroll, { passive: true });
      cleanups.push(() => scrollEl.removeEventListener("scroll", handleScroll));
    }
  }, 1000);
  cleanups.push(() => clearTimeout(attachScroll));

  return () => cleanups.forEach(fn => fn());
}
