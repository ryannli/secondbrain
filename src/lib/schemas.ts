import { z } from "zod";

const SourceTypeSchema = z.enum(["html", "text", "document", "image"]);
const ActionTypeSchema = z.enum([
  "must_read",
  "worth_reading",
  "skim",
  "summary_only",
  "skip",
]);

export const OriginalDataSchema = z.object({
  id: z.string(),
  schemaVersion: z.number().int().optional().default(1),
  source_url: z.string().optional(),
  created_at: z.string(),
  type: SourceTypeSchema,
  original_file: z.string(),
  original_title: z.string(),
  saved: z.boolean().optional(),
}).passthrough();

const HighlightSchema = z.object({
  id: z.string().optional(),
  text: z.string().default(""),
  type: z.enum(["insight", "fact", "actionable"]).default("insight"),
  reaction: z.enum(["star", "dismiss"]).optional(),
  reactionAt: z.string().optional(),
});

const ConceptSchema = z.object({
  id: z.string().optional(),
  term: z.string().default(""),
  definition: z.string().default(""),
  status: z.enum(["knew", "learned"]).optional(),
  statusAt: z.string().optional(),
});

const TriageSchema = z.object({
  score: z.number().default(50),
  reason: z.string().default("Unable to assess"),
  action: ActionTypeSchema.default("skim"),
  readTimeMinutes: z.number().default(5),
  density: z.number().default(50),
  originality: z.number().default(50),
}).default({});

const DigestSchema = z.object({
  summary: z.string().default(""),
  highlights: z.array(HighlightSchema).default([]),
  concepts: z.array(ConceptSchema).default([]),
  structure: z.array(z.string()).default([]),
}).default({});

const CritiqueSchema = z.object({
  hiddenAssumptions: z.array(z.string()).default([]),
  potentialIssues: z.array(z.string()).default([]),
  needsVerification: z.array(z.string()).default([]),
  biasIndicators: z.array(z.string()).default([]),
}).default({});

export const AnalysisSchema = z.object({
  triage: TriageSchema,
  digest: DigestSchema,
  critique: CritiqueSchema,
  connections: z.array(z.unknown()).optional(),
  connectionError: z.string().optional(),
  analyzedAt: z.string().optional(),
}).passthrough().default({});
