/**
 * Prompt Templates
 *
 * All AI prompts used in the application are centralized here.
 * Each prompt is a function that takes parameters and returns the full prompt string.
 */

export function promptGenerateTitle(content: string): string {
  return `Generate a concise, descriptive title (5-10 words) for this content.

Rules:
1. Capture the main topic or insight
2. If the author is a well-known person (tech leader, researcher, entrepreneur, public figure, etc.), include their name
   - Format: "Author Name: Topic" or "Author Name on Topic"
   - Examples: "Andrej Karpathy on LLM Training Workflows", "Paul Graham: How to Start a Startup"
3. If the author is not famous or cannot be identified, just describe the content without attribution

Respond with ONLY the title, no quotes or explanation.

Content:
${content.slice(0, 3000)}`;
}

export function promptExtractContent(html: string): string {
  return `Extract the main article content from this HTML. Ignore navigation, ads, sidebars. Format as clean Markdown with headings, lists, links preserved.

HTML:
${html}`;
}

export function promptFormatText(text: string): string {
  return `Reformat this text into clean Markdown. Add headings (H2 and below), lists, and paragraph breaks to improve readability. Preserve all original content.

Text:
${text}`;
}

export function promptAnalyzeFile(filePath: string, fileType: string, context?: string): string {
  const imageInstructions = `- Describe what you see in the image
- Extract any text visible in the image (OCR)
- Note key visual elements, diagrams, or data visualizations
- If it's a screenshot of an article or document, extract the full text content`;

  const pdfInstructions = `- Extract the main text content
- Preserve document structure (headings, lists, tables)
- Note any figures or diagrams`;

  return `Read the file at ${filePath} and extract its content.

File type: ${fileType}

Instructions:
${fileType === "image" ? imageInstructions : ""}
${fileType === "pdf" ? pdfInstructions : ""}
${context ? `\nContext about this file:\n${context}` : ""}

Output clean Markdown that captures the content of this file.`;
}

export function promptAnalyzeContent(title: string, content: string): string {
  return `Analyze the following content and help the reader decide how to allocate their attention.

## Content Title
${title}

## Content
${content}

## Task
Analyze this content and generate a structured analysis with TWO modes:

### Mode 1: Digest (Understanding)
Help the reader understand and absorb the content efficiently.

### Mode 2: Critique (Evaluation)
Help the reader evaluate the content critically.

## Output Format
Return a JSON object with this structure:
{
  "triage": {
    "score": <0-100 attention score>,
    "action": "must_read" | "worth_reading" | "skim" | "summary_only" | "skip",
    "reason": "<one sentence explaining why>",
    "readTimeMinutes": <estimated minutes to read>,
    "informationDensity": <0-100>,
    "noveltyScore": <0-100>
  },
  "digest": {
    "summary": "<2-3 sentence summary>",
    "highlights": [
      {"id": "h1", "type": "insight" | "fact" | "actionable", "text": "<highlight>"},
      ...
    ],
    "concepts": [
      {"id": "c1", "term": "<concept>", "definition": "<brief definition>", "importance": "core" | "supporting" | "peripheral"},
      ...
    ]
  },
  "critique": {
    "assumptions": ["<hidden assumption 1>", ...],
    "issues": ["<potential issue or weakness>", ...],
    "questions": ["<question this raises>", ...],
    "verificationNeeded": ["<claim that should be verified>", ...]
  }
}

## Scoring Guidelines

**Action thresholds:**
- must_read (90-100): Essential, high-impact, time-sensitive
- worth_reading (70-89): Valuable, good insights
- skim (40-69): Some useful parts, not essential
- summary_only (20-39): Low value, summary sufficient
- skip (0-19): Not worth time

**Information density**: How much substance per paragraph
**Novelty score**: How much is genuinely new vs rehashing known ideas

Respond with ONLY the JSON object, no markdown code fences.`;
}

export function promptFindRelated(
  newTitle: string,
  newConcepts: string,
  newSummary: string,
  libraryContext: string
): string {
  return `You are analyzing a knowledge library to find connections between articles.

## New Source
Title: ${newTitle}
Key Concepts: ${newConcepts}
Summary: ${newSummary}

## Existing Library
${libraryContext}

## Task
Find the most relevant connections between the new source and existing library items.

For each connection, explain:
1. The type of relationship (supports, contradicts, extends, same_topic, prerequisite)
2. Why they're connected
3. Confidence level (high/medium/low)

Return JSON:
{
  "connections": [
    {
      "sourceId": "<id of related source>",
      "type": "supports" | "contradicts" | "extends" | "same_topic" | "prerequisite",
      "reason": "<brief explanation>",
      "confidence": "high" | "medium" | "low"
    }
  ]
}

Rules:
- Only include genuinely meaningful connections
- Maximum 5 connections
- Prefer quality over quantity
- "prerequisite" means the existing source should be read before the new one

Respond with ONLY the JSON object.`;
}

export function promptAnalyzeConnections(
  newTitle: string,
  newSummary: string,
  newConcepts: string,
  newHighlights: string,
  relatedContext: string
): string {
  return `You are analyzing connections between a new article and existing sources in a knowledge library.

## New Source
Title: ${newTitle}
Summary: ${newSummary}
Key Concepts: ${newConcepts}
Highlights: ${newHighlights}

## Potentially Related Sources
${relatedContext}

## Task
Analyze how the new source relates to each potentially related source.

For each meaningful connection, provide:
1. **type**: The relationship type
   - "supports": New source provides evidence for the other
   - "contradicts": Sources disagree on key points
   - "extends": New source builds on or updates the other
   - "same_topic": Cover the same subject from different angles
   - "prerequisite": Other source provides needed background

2. **summary**: A 1-2 sentence explanation of the specific connection

3. **strength**: How strong is this connection (1-10)

Return JSON:
{
  "connections": [
    {
      "targetId": "<source id>",
      "type": "supports" | "contradicts" | "extends" | "same_topic" | "prerequisite",
      "summary": "<specific explanation of how they connect>",
      "strength": <1-10>
    }
  ]
}

Rules:
- Only include connections with strength >= 5
- Be specific about WHY they connect, not just that they do
- If sources barely relate, don't force a connection
- Maximum 10 connections

Respond with ONLY the JSON object.`;
}

export function promptMergeConnections(
  existingTitle: string,
  existingConnections: string,
  newTitle: string,
  newSourceId: string,
  proposedType: string,
  proposedReason: string
): string {
  return `You are helping organize connections between knowledge sources.

## Existing Connections for "${existingTitle}"
${existingConnections}

## Proposed New Connection
From: ${newTitle}
Type: ${proposedType}
Reason: ${proposedReason}

## Task
Decide how to handle this new connection:

1. If it's genuinely new and valuable, ADD it
2. If it duplicates an existing connection, SKIP it
3. If it conflicts with existing connections, decide which is more accurate

Return JSON:
{
  "action": "add" | "skip" | "replace",
  "reason": "<brief explanation>",
  "connection": {
    "sourceId": "${newSourceId}",
    "type": "<final connection type>",
    "summary": "<final summary>"
  }
}

If action is "skip", connection can be null.
If action is "replace", include the index of connection to replace as "replaceIndex".

Respond with ONLY the JSON object.`;
}

export function promptExtractInterests(
  libraryContext: string,
  sourceCount: number,
  maxInterests: number
): string {
  return `Analyze this user's knowledge library to identify their interests for news discovery.

## User's Library (${sourceCount} sources)
${libraryContext}

## Your Goal
Generate ${maxInterests} search queries. Each query should be 1-2 words MAX.

## Rules
1. **SHORT**: 1-2 words only. "AI" not "AI agents browser automation"
2. **BROAD**: Cover wide topic areas, not specific products or events
3. **DIVERSE**: Don't overlap - each query should cover a different interest area

## Examples
GOOD: ["AI", "startups", "programming", "tech industry", "productivity"]
BAD: ["AI agents browser automation", "OpenAI funding valuation", "LLM coding workflows"] (too long, too specific)

## Output
Return a JSON array of ${maxInterests} short search terms.

Respond with ONLY the JSON array.`;
}

export function promptFilterFeed(
  libraryContext: string,
  resultsContext: string,
  maxItems: number,
  preferredSources: string[] = []
): string {
  const preferredSourcesText = preferredSources.length > 0
    ? `\n## User's Preferred Sources\nThe user specifically wants content from: ${preferredSources.join(", ")}\nThese are trusted sources for this user.\n`
    : "";

  return `You are a Chief of Staff helping a busy knowledge worker stay informed in their areas of interest.

## User's Interest Areas (from their library)
${libraryContext}
${preferredSourcesText}
## Today's Search Results
${resultsContext}

## Your Job
For each result, decide: **Recommend** or **Skip**?

## CRITICAL: Avoid Echo Chamber

The user wants to EXPAND their knowledge in their interest areas, NOT just see content similar to what they already have.

### Recommend if:
1. **New development**: Something that just happened this week (announcements, releases, events)
2. **High engagement/discussion**: Posts with significant community discussion (check for comment counts, upvotes in snippet)
3. **New perspective or debate**: Different viewpoint, controversy, or evolving discussion
4. **Deepens understanding**: Goes deeper than what they have, even on familiar topics
5. **From trusted sources**: Established publications or user's preferred sources

### Skip if:
1. **Exact same content**: Literally the same story they already have
2. **Low engagement**: Few comments, no discussion (especially for Reddit/HN)
3. **Generic intro content**: "What is X?" when they clearly know X deeply
4. **SEO spam / clickbait**: Low-quality content farming
5. **Outdated**: Old content repackaged

## KEY PRINCIPLE: Domain ≠ Duplicate

If a user is interested in a topic, they want to see WHAT'S HAPPENING in that area — new developments, debates, tools.

DO NOT skip content just because it's in the same domain. Skip only if it's literally the SAME story or adds nothing new.

**Decision framework:**
- User has deep article on Topic X → New development about X → RECOMMEND (news)
- User has deep article on Topic X → "Intro to X" article → SKIP (they know this)
- User has article from Source A → Different story from Source A → RECOMMEND (new content)

## Writing Reasons

**whyRead** (create curiosity, not summaries):
✓ "First public post-mortem of why this failed"
✓ "Heated debate with 200+ comments"
✓ "Claims 10x improvement over current approach"
✗ "Related to [topic]" (too vague)
✗ "Discusses [topic]" (boring summary)

**whySkip** (be specific):
✓ "Beginner intro — covered at deeper level in your library"
✓ "Same announcement, different publication"
✓ "Low engagement — only 3 comments"

## Output Format
{
  "items": [
    {"index": 1, "action": "recommend", "score": 85, "whyRead": "Specific reason to read"},
    {"index": 3, "action": "skip", "score": 25, "whySkip": "Specific reason to skip"}
  ]
}

## Scoring Guide
- 85-100: Must see — breaking news, major announcements, viral discussions (100+ comments)
- 75-84: Worth reading — solid new angle, notable development
- 60-74: Maybe later — some value but not urgent
- Below 60: Skip — low value, redundant, or outdated

## Rules
- "index" = 1-based position in search results
- Include ALL items with action "recommend" (score >= 75) or "skip" (score < 75)
- Be SELECTIVE — only ~30% of items should be "recommend"
- Prioritize HIGH ENGAGEMENT content (lots of comments/discussion)

## JSON Format
- Respond with ONLY valid JSON, no markdown code blocks
- Keep whyRead/whySkip SHORT (under 60 chars)
- NEVER include quotes (") inside string values

Example:
{"items": [{"index": 1, "action": "recommend", "score": 85, "whyRead": "200+ comments"}, {"index": 2, "action": "skip", "score": 30, "whySkip": "Outdated news"}]}`;
}

export function promptGenerateBriefing(libraryContext: string, feedContext: string): string {
  return `You are a Chief of Staff briefing a busy executive on what's happening in their areas of interest.

## User's Knowledge Base (what they ALREADY know)
${libraryContext}

## Today's News Feed (numbered)
${feedContext}

## Your Task
Tell the user NEW information they don't already know. The briefing itself should be valuable - they should learn something just by reading it.

**RULES:**
1. **Tell them NEWS** - What JUST happened? What's the new development?
2. **Don't repeat their library** - They already know what's in their library. Tell them what's NEW.
3. **Be specific with facts** - "Anthropic raised $10B at $60B valuation" not "there's funding news"
4. **Make the briefing standalone valuable** - Even if they don't click any links, they should learn something
5. **Use bold for key facts** - Bold **company names**, **numbers**, **percentages**, and **key terms** to make scanning easier

**FORMAT:**
**What's new**
- [Specific fact/news - include numbers, names, dates]
- [Another news item]
(Use #N to reference the source number so user can click to jump)

**Connects to your knowledge**
- [How this relates to their existing article/note - be specific]
- [Another connection if relevant]
(Always include #N so user can jump to the related article)

**Go deeper**
- #N — [What extra detail this article has]
- #N — [Why worth clicking]
(Only 2-3 items with MORE detail than the summary above)

**EXAMPLE:**
**What's new**
- **Company X** raised **$500M** at **$5B valuation**, 3x increase from last round (#1)
- **Major product** launching **new feature** that changes how users do [task] (#3)
- **Industry report** shows **40% adoption rate** for [technology] (#7)

**Connects to your knowledge**
- Funding news validates the trend you noted in your article about [topic] (#1)
- New feature relates to the **limitations** you explored in [your article] (#7)

**Go deeper**
- #1 — Full breakdown of the investor list and terms
- #5 — Detailed benchmark data with methodology

Respond with ONLY the formatted briefing.`;
}
