// Core types for Second Brain

/**
 * Source type represents the FILE FORMAT, not the content source.
 * - html: Web pages (YouTube, Twitter, articles, etc. - source inferred from source_url)
 * - text: Plain text notes
 * - document: PDF, DOC, DOCX, etc.
 * - image: PNG, JPG, WebP, GIF, etc.
 */
export type SourceType = "html" | "text" | "document" | "image";

/**
 * Original data captured at source creation time.
 * Stored in meta.json - mostly immutable, but some fields like `saved` can be updated.
 */
export interface OriginalData {
  id: string;
  schemaVersion?: number; // Schema version for meta.json (default: 1)
  source_url?: string;
  created_at: string;
  type: SourceType;
  original_file: string;  // e.g. "original.html", "original.pdf", "original.png"
  original_title: string; // Title at capture time (before AI processing)
  saved?: boolean;        // User saved/bookmarked this entry
}

/**
 * Processing status derived from file existence:
 * - processing: only meta.json exists
 * - ready: meta.json + content.md + analysis.json exist
 * - failed: meta.json + error.txt exist
 */
export type ProcessingStatus = "processing" | "ready" | "failed";

/**
 * Granular processing stage (derived from file existence):
 * - extracting: no content.md yet
 * - analyzing: content.md exists, no analysis.json yet
 * - connecting: analysis.json exists, connections not yet computed
 * - complete: fully processed
 */
export type ProcessingStage = "extracting" | "analyzing" | "connecting" | "complete";

export interface SourceMeta {
  id: string;
  title: string; // Display title (from content.md or original_title as fallback)
  type: SourceType;
  sourceUrl?: string;
  createdAt: string;
  folder?: string; // relative path within library/
  // Processing status (derived from file existence)
  processingStatus?: ProcessingStatus;
  processingStage?: ProcessingStage; // More granular than processingStatus
  processingError?: string;
  analysisError?: string; // Error if analysis.json exists but is malformed
  // Reading tracking
  readStatus?: "unread" | "reading" | "read";
  lastReadAt?: string;
  totalReadTimeSeconds?: number; // accumulated reading time
  // Saved/bookmark
  saved?: boolean;
}

export type ActionType =
  | "must_read"       // 80-100: Must read
  | "worth_reading"   // 60-79: Worth reading
  | "skim"            // 40-59: Quick scan
  | "summary_only"    // 20-39: Just read AI summary
  | "skip";           // 0-19: Don't bother

export const ACTION_CONFIG: Record<ActionType, { label: string; description: string }> = {
  must_read: { label: "Must Read", description: "Every sentence counts" },
  worth_reading: { label: "Worth Reading", description: "Read key sections" },
  skim: { label: "Skim", description: "Scan headings and key points" },
  summary_only: { label: "Summary Only", description: "Just read the summary" },
  skip: { label: "Skip", description: "Not worth your time" },
};

export interface TriageCard {
  score: number;           // 0-100, single recommendation score
  reason: string;          // why this score
  action: ActionType;      // what to do
  readTimeMinutes: number; // how long to read
  // Secondary metrics (expandable details)
  density: number;         // 0-100, information per unit text
  originality: number;     // 0-100, genuine thinking vs rehashed content
}

export interface Highlight {
  id: string;
  text: string;
  type: "insight" | "fact" | "actionable";
  reaction?: "star" | "dismiss";
  reactionAt?: string;  // ISO timestamp of last reaction
}

export interface Concept {
  id: string;
  term: string;
  definition: string;
  status?: "knew" | "learned";  // knew = already knew, learned = just learned
  statusAt?: string;  // ISO timestamp when status was set
}

export interface DigestAnalysis {
  summary: string;
  highlights: Highlight[];
  concepts: Concept[];
  structure: string[]; // outline of the content
}

export interface CritiqueAnalysis {
  hiddenAssumptions: string[];
  potentialIssues: string[];
  needsVerification: string[];
  biasIndicators: string[];
}

export type ConnectionType = "redundant" | "contradicts" | "related";

export interface Connection {
  id: string;
  type: ConnectionType;
  summary: string;              // One-line description
  details: string;              // Detailed explanation
  relatedSourceIds: string[];   // IDs of related sources
}

// Connection with resolved titles (for display)
export interface ResolvedConnection extends Connection {
  relatedSourceTitles: string[]; // Resolved at load time, not stored
}

export interface UserHighlight {
  id: string;
  text: string;
  createdAt: string;
}

export interface Analysis {
  triage: TriageCard;
  digest: DigestAnalysis;
  critique: CritiqueAnalysis;
  connections?: Connection[];   // Cross-source connections (optional for backward compatibility)
  connectionError?: string;     // Error message if connection analysis failed
  analyzedAt: string;
  userRating?: number;          // 0.5 to 5, in 0.5 increments
  userRatingAt?: string;        // ISO timestamp
}

export interface Source {
  meta: SourceMeta;
  originalContent: string; // original: URL's raw HTML or user's pasted text
  content: string; // processed: extracted/formatted markdown
  analysis?: Analysis;
}

// Summary type for dashboard listing
export interface SourceSummary {
  meta: SourceMeta;
  score?: number;
  reason?: string;
  action?: ActionType;
}

// Tree structure for folder view (used by both Library and Notebook)
export interface TreeNode {
  type: "folder" | "source" | "document";
  name: string;
  path: string; // relative path within library/ or notebook/
  children?: TreeNode[];
  source?: SourceSummary;
  document?: NotebookDocument;
}

// API types
export interface CaptureRequest {
  url?: string;
  text?: string;
  title?: string;
}

export interface CaptureResponse {
  success: boolean;
  source?: Source;
  error?: string;
}

// Insight types
export interface InsightItem {
  text: string;   // Markdown text with **bold** highlights
}

// Briefing types (structured)
export interface BriefingNewsItem {
  text: string;          // 1-2 sentences with **bold** for key facts and connections
  refs: number[];        // Feed item numbers (#N)
}

export interface BriefingGoDeeper {
  ref: number;           // Feed item number
  reason: string;        // Why it's worth clicking
}

export interface StructuredBriefing {
  news: BriefingNewsItem[];
  goDeeper: BriefingGoDeeper[];
}

// Feed types
export interface FeedItem {
  id: string;                    // Generated hash of URL
  title: string;
  url: string;
  snippet: string;               // From search result
  publishedAt: string;           // ISO date
  source: string;                // News source name
  thumbnail?: string;            // Thumbnail image URL
  scoring: {
    overall: number;             // 0-100 combined score
    action: "recommend" | "skip";
    // Why this is recommended (if action = recommend)
    whyRead?: string;            // e.g. "OpenAI just announced major policy changes"
    // Why this is filtered (if action = skip)
    whySkip?: string;            // e.g. "Overlaps with your notes on AI safety"
    // What existing knowledge this connects to
    connectsTo?: string;         // e.g. "Your article: 'AI Safety Fundamentals'"
  };
}

export interface FeedSignals {
  searchCalls: number;       // Number of search API calls triggered
  rssFeedCount: number;      // Number of RSS feed sources used
  radarCount: number;        // Number of configured interest radars
  libraryCount: number;
  interactionCount: number;  // Total: starred + dismissed + learned + knew
}

export interface FeedCache {
  generatedAt: string;           // ISO timestamp
  interests: string[];           // Extracted interest terms
  items: FeedItem[];
  message?: string;              // Empty-state or degraded-mode notice
  briefing?: StructuredBriefing;  // AI-generated structured briefing
  signals?: FeedSignals;         // What the AI considered when filtering
  insights?: InsightItem[];      // AI-generated insights from user's reading behavior
}

// Notebook types
export interface NotebookDocument {
  id: string;                    // doc-abc123
  title: string;
  createdAt: string;             // ISO timestamp
  output: "content.pdf" | "content.md";
  sources?: string[];            // Related Library source IDs
  folder?: string;               // Folder path within notebook/
}

// History timeline event
export interface HistoryEvent {
  id: string;                  // e.g. "abc123-rating"
  type: "rating" | "star" | "dismiss" | "knew" | "learned" | "read" | "briefing_star" | "added";
  timestamp: string;           // ISO
  sourceId: string;
  sourceTitle: string;
  rating?: number;             // for rating events
  highlightText?: string;      // for star/dismiss
  conceptTerm?: string;        // for knew/learned
  conceptDefinition?: string;
  briefingText?: string;       // for briefing_star events
}

// Agent conversation types
export type AgentContextType = "source" | "document" | "selection";

export interface AgentContext {
  type: AgentContextType;
  id: string;
  title: string;                 // Display label (source title or selection preview)
  content?: string;              // Full content (for selection type)
}

// Stream event from Agent (for preserving tool calls in history)
export type AgentStreamEvent =
  | { type: "text"; content: string }
  | { type: "tool"; id: string; name: string; detail?: string }
  | { type: "subtool"; parentId: string; name: string; detail?: string }
  | { type: "result"; toolId: string; content: string }
  | { type: "subtool_done"; parentId: string }
  | { type: "error"; message: string };

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;               // Plain text content (for search, history display)
  timestamp: string;             // ISO timestamp
  contexts?: AgentContext[];     // Context items attached to this message
  streamEvents?: AgentStreamEvent[]; // Raw events for rebuilding full UI (tools, etc.)
}

export interface AgentConversation {
  id: string;
  title: string;                 // Auto-generated from first message or user-set
  createdAt: string;
  updatedAt: string;
  messages: AgentMessage[];
}

export interface AgentConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  preview: string;               // First user message preview
}
