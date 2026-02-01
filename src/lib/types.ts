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
 * Stored in original.json - IMMUTABLE after creation.
 */
export interface OriginalData {
  id: string;
  source_url?: string;
  created_at: string;
  type: SourceType;
  original_file: string;  // e.g. "original.html", "original.pdf", "original.png"
  original_title: string; // Title at capture time (before AI processing)
}

/**
 * Processing status derived from file existence:
 * - processing: only original.json exists
 * - ready: original.json + content.md + analysis.json exist
 * - failed: original.json + error.txt exist
 */
export type ProcessingStatus = "processing" | "ready" | "failed";

export interface SourceMeta {
  id: string;
  title: string; // Display title (from content.md or original_title as fallback)
  type: SourceType;
  sourceUrl?: string;
  createdAt: string;
  folder?: string; // relative path within library/
  // Processing status (derived from file existence)
  processingStatus?: ProcessingStatus;
  processingError?: string;
  // Reading tracking
  readStatus?: "unread" | "reading" | "read";
  lastReadAt?: string;
  totalReadTimeSeconds?: number; // accumulated reading time
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
  relatedSourceTitles: string[]; // Titles for display
}

export interface Analysis {
  triage: TriageCard;
  digest: DigestAnalysis;
  critique: CritiqueAnalysis;
  connections?: Connection[];   // Cross-source connections (optional for backward compatibility)
  analyzedAt: string;
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

// Tree structure for folder view
export interface TreeNode {
  type: "folder" | "source";
  name: string;
  path: string; // relative path within library/
  children?: TreeNode[];
  source?: SourceSummary;
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
