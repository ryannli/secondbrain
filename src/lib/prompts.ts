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
  return `Convert this HTML page into clean Markdown. Preserve ALL content completely — do not summarize, skip, or describe. Omit only navigation, ads, and boilerplate.

IMPORTANT: Do NOT add a main title (H1). The title is stored separately. Start directly with the content.
IMPORTANT: Output raw Markdown directly. Do NOT wrap in a code fence (\`\`\`markdown).

HTML:
${html}`;
}

export function promptFormatText(text: string): string {
  return `Reformat this text into clean Markdown. Add headings (H2 and below), lists, and paragraph breaks to improve readability. Preserve all original content.

IMPORTANT: Do NOT add a main title (H1). The title is stored separately. Start directly with the content.
IMPORTANT: Output raw Markdown directly. Do NOT wrap in a code fence (\`\`\`markdown).

${text}`;
}

export function promptAnalyzeFile(filePath: string, isPDF: boolean): string {
  return `Read the file at ${filePath} and extract its content.

${isPDF ? "This is a PDF document." : "This is an image file (likely a screenshot, document scan, or note)."}

Your job is to:
1. Extract ALL text content from the file
2. Format it as clean Markdown, preserving the structure (headings, lists, paragraphs, tables, etc.)
3. Generate a concise title (5-10 words) that captures the main topic

Format your response EXACTLY as:
TITLE: [your title here]

CONTENT:
[extracted text formatted as Markdown - preserve structure, use ## for headings, - for lists, etc.]

Rules:
- Extract ALL text, don't summarize or paraphrase
- Preserve the original structure as much as possible
- If there are multiple sections or pages, use Markdown headings to organize
- If there are bullet points or numbered lists, preserve them
- If there are tables, format them as Markdown tables
- ${isPDF ? "For multi-page PDFs, process all pages" : "If the image text is hard to read, do your best to interpret it"}
- If the file doesn't contain meaningful text, describe what you see instead`;
}

export function promptAnalyzeContent(title: string, content: string, sourceUrl?: string): string {
  return `Analyze the following content and help the reader decide how to allocate their attention.

Title: ${title}
${sourceUrl ? `Source: ${sourceUrl}` : ""}

Content:
${content}

## Your Task

Give a single **recommendation score (0-100)** that answers: "How much attention is this worth?"

Think objectively: **Would many people find this valuable?**

Consider:
- **Information density**: Signal vs noise ratio. How much can you learn per paragraph?
- **Originality**: Is this genuine content (from experience, expertise, or research), or AI-generated fluff / rehashed content that adds nothing new?
- **Quality of content**: Well-explained? Clear? Teaches something effectively?

Content can be valuable in different ways:
- **Educational**: Explains concepts, teaches skills, shares knowledge
- **Insightful**: Offers deep analysis, unique perspectives, or non-obvious observations
- **Informational**: Provides useful facts, data, or reference material

**IMPORTANT - Do NOT penalize for:**
- Brevity or concise format (dense content is GOOD, not bad)
- Lack of detailed argumentation (ideas can be valuable without lengthy justification)
- Informal style or personal notes format
- Missing citations or data (judge the ideas themselves)

**Scoring Guide** (action MUST match score range):
- 80-100 → action: "must_read" — Must read. Every sentence counts.
- 60-79 → action: "worth_reading" — Worth reading. Read key sections.
- 40-59 → action: "skim" — Mixed value. Quick scan only.
- 20-39 → action: "summary_only" — Low value. Just read the summary.
- 0-19 → action: "skip" — Not worth your time.

Provide your analysis as a JSON object:
{
  "triage": {
    "score": <0-100>,
    "reason": "<one sentence: why this score?>",
    "action": "<must_read|worth_reading|skim|summary_only|skip>",
    "readTimeMinutes": <estimated minutes to read and understand>,
    "density": <0-100, information per unit text>,
    "originality": <0-100, genuine thinking vs rehashed/AI content>
  },
  "digest": {
    "summary": "<2-3 sentences>",
    "highlights": [
      {"id": "h1", "text": "<key point or takeaway>", "type": "<insight|fact|actionable>"}
    ],
    "concepts": [{"id": "c1", "term": "<term>", "definition": "<definition>"}],
    "structure": ["<outline>"]
  },
  "critique": {
    "hiddenAssumptions": ["<items>"],
    "potentialIssues": ["<items>"],
    "needsVerification": ["<items>"],
    "biasIndicators": ["<items>"]
  }
}

**Highlight Types**:
- insight: Core idea, observation, or argument (whether fact or opinion)
- fact: Specific verifiable claim or data point
- actionable: Practical advice or recommendation to act on

Respond with ONLY the JSON object.`;
}

export function promptFindRelatedSources(newSourceSummary: string, sourcesContext: string): string {
  return `You are analyzing a knowledge library to find connections between articles.

## New Source Summary
${newSourceSummary}

## Existing Sources in Library
${sourcesContext}

## Task
Identify which existing sources might have meaningful connections with the new source. Look for:
1. **Topic overlap** - Similar subjects, concepts, or domains
2. **Potential contradictions** - Opposing viewpoints or conflicting claims
3. **Conceptual extensions** - The new source builds on ideas from existing sources
4. **Supporting/related evidence** - Sources that support or relate to each other

Return a JSON array of source IDs that have potential connections, ordered by relevance.
Maximum 5 sources. If no relevant connections exist, return an empty array.

Respond with ONLY the JSON array, no explanation.
Example: ["abc123", "def456"]`;
}

export function promptAnalyzeConnections(
  newSourceTitle: string,
  newSourceContext: string,
  relatedContext: string,
  learnedContext: string
): string {
  return `You are analyzing connections between a new article and existing sources in a knowledge library.

## New Source: ${newSourceTitle}
${newSourceContext}

## Related Sources
${relatedContext}
${learnedContext}

## Task
Identify specific, meaningful connections between the new source and the related sources.

## Connection Types
1. **redundant** - The new source covers similar ground as an existing source. User can skip one.
2. **contradicts** - The new source contradicts or presents opposing viewpoints to an existing source. User should read critically.
3. **related** - The sources share concepts, build on each other, or discuss related topics. Worth reading together.

## Rules
- Be specific about what conflicts, overlaps, or relates
- Reference specific claims, highlights, or concepts
- Keep summaries concise (one sentence)
- IMPORTANT: In the summary field, always refer to sources by their TITLE, not their ID. For example, write "Overlaps with 'Article Title'" instead of "Overlaps with ID abc123"
- Provide enough detail for user to understand without reading both sources
- Only report meaningful connections, not superficial topic overlaps
- A single connection can reference multiple related sources if they all relate to the same point

Return a JSON array of connections:
{
  "connections": [
    {
      "id": "conn1",
      "type": "redundant|contradicts|related",
      "summary": "One-line description of the connection",
      "details": "2-3 sentences explaining the connection with specific references",
      "relatedSourceIds": ["id1", "id2"]
    }
  ]
}

If no meaningful connections exist, return: { "connections": [] }

Respond with ONLY the JSON object.`;
}

export function promptMergeConnections(
  targetSourceTitle: string,
  connectionsContext: string,
  newSourceId: string,
  newSourceTitle: string,
  newSourceSummary: string
): string {
  return `You are helping organize connections between knowledge sources.

## Target Source: "${targetSourceTitle}"

## Existing Connections:
${connectionsContext}

## New Source to Merge:
- ID: ${newSourceId}
- Title: "${newSourceTitle}"
- Summary: ${newSourceSummary}

## Task
Decide how to integrate the new source into the target's connections:
1. **Merge**: If the new source discusses the same topic as an existing connection, add it to that connection's relatedSourceIds
2. **Create new**: If the new source discusses a different topic, create a new connection

## Rules
- Only merge if the topics are semantically the same (not just vaguely related)
- Keep connection summaries general enough to cover all related sources
- If merging, you may update the summary to better reflect all sources

Return the complete updated connections array as JSON:
{
  "connections": [
    {
      "id": "existing-or-new-id",
      "type": "redundant|contradicts|related",
      "summary": "Updated or new summary",
      "details": "Updated or new details",
      "relatedSourceIds": ["id1", "id2", "newSourceId"]
    }
  ]
}

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
  preferredSources: string[] = [],
  interactionContext: string = "",
  interests: string[] = []
): string {
  const preferredSourcesText = preferredSources.length > 0
    ? `\n## User's Preferred Sources\nThe user specifically wants content from: ${preferredSources.join(", ")}\nThese are trusted sources for this user.\n`
    : "";

  const interactionSection = interactionContext
    ? `\n${interactionContext}\n`
    : "";

  const interestsText = interests.length > 0
    ? `## User's Configured Interests (explicitly chosen topics)\n${interests.map(i => `- ${i}`).join("\n")}\n`
    : "";

  return `You are a Chief of Staff helping a busy knowledge worker stay informed in their areas of interest.

${interestsText}
## User's Library (what they've been reading)
${libraryContext}
${preferredSourcesText}${interactionSection}
## Today's Search Results
${resultsContext}

## Your Job
For each result, decide: **Recommend** or **Skip**?

## CRITICAL: Avoid Echo Chamber

The user wants to EXPAND their knowledge in their interest areas, NOT just see content similar to what they already have.

### Recommend if:
1. **Matches configured interests**: Directly about one of the user's configured interest topics
2. **New development**: Something that just happened this week (announcements, releases, events)
3. **High engagement/discussion**: Posts with significant community discussion (check for comment counts, upvotes in snippet)
4. **New perspective or debate**: Different viewpoint, controversy, or evolving discussion
5. **From trusted sources**: Established publications or user's preferred sources
6. **Matches active interactions**: Directly relates to user's starred highlights or learned concepts

### Skip if:
1. **Exact same content**: Literally the same story they already have
2. **Low engagement**: Few comments, no discussion (especially for Reddit/HN)
3. **Generic intro content**: "What is X?" when they clearly know X deeply
4. **SEO spam / clickbait**: Low-quality content farming
5. **Outdated**: Old content repackaged
6. **Off-topic**: Not related to configured interests OR library topics

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

export function promptGenerateInsights(
  interactionContext: string,
  libraryContext: string,
  interests: string[] = []
): string {
  const interestsText = interests.length > 0
    ? `## User's Configured Interests\n${interests.map(i => `- ${i}`).join("\n")}\n`
    : "";

  return `You are analyzing a knowledge worker's reading behavior to surface interesting patterns and discoveries.

${interestsText}
## User's Library
${libraryContext}

${interactionContext}

## Your Task
Identify 2-4 patterns, discoveries, or observations from the user's reading behavior. These should be genuinely useful reflections, not generic platitudes.

**Types of insights to look for:**
- Emerging themes: "You've engaged with X across different sources — this seems to be a growing interest"
- Knowledge gaps: "You marked Y as 'learned' in 3 sources — might be worth a deep-dive"
- Reading patterns: "Your ratings trend higher for technical deep-dives vs opinion pieces"
- Strength areas: "You already knew concepts around X across multiple sources — strong foundation"
- Contrasts: "You engaged with opposing viewpoints on X — worth exploring this debate"
- Temporal trends: "In the past week you've focused heavily on X — a shift from earlier interests in Y"
- Recency clusters: "3 of your last 4 interactions were about X — this topic is clearly on your mind right now"
- Blind spots: "You've read a lot about X but haven't touched Y, which is a critical counterpart — worth looking into"
- Actionable nudges: "Given your interest trajectory, you might want to pay attention to X before it becomes mainstream"

**Rules:**
1. Be specific — reference actual topics, not vague categories
2. Each insight should be actionable or thought-provoking
3. Keep each insight to 1-2 sentences
4. Focus on **patterns** the user might not notice themselves — don't just restate what they recently read or learned
5. Use **bold** for the pattern or observation itself, NOT for topic names or concepts the user already knows

**Output format:**
Return a JSON array of objects with a "text" field.

Example:
[
  {"text": "Your ratings trend **higher for hands-on tutorials** (avg 4.2) vs opinion pieces (avg 2.8) — you seem to value actionable content"},
  {"text": "You keep encountering agent orchestration across unrelated sources — this concept is **converging from multiple directions** in your reading"}
]

Respond with ONLY the JSON array.`;
}

export function promptExtractTopics(sourcesContext: string): string {
  return `Analyze this user's reading library and identify broad topic categories that describe their interests over time.

## Sources
${sourcesContext}

## Task
Identify 6-8 broad topic categories that cover the user's reading interests. Then tag each source with 1-3 of those topics.

## Rules
1. Topics should be BROAD (e.g. "AI & Machine Learning", "Web Development", "Startups") — not specific articles
2. Every source must be tagged with at least 1 topic
3. Topics should be distinct — don't create overlapping categories
4. Use short, readable labels (2-4 words max)

## Output
Return a JSON object:
{
  "topics": ["Topic A", "Topic B", ...],
  "sources": [
    {"id": "abc123", "topics": ["Topic A", "Topic B"]},
    ...
  ]
}

Respond with ONLY the JSON object.`;
}

export function promptAnalyzeConcepts(conceptsContext: string): string {
  return `Analyze these concepts from a user's reading library and group them into semantic clusters.

## Concepts
${conceptsContext}

## Task
Group concepts into 4-8 semantic clusters (broad categories).

## Rules
- Every concept must belong to exactly 1 cluster
- Cluster names should be 2-4 words
- Clusters should be distinct and non-overlapping

## Output
Return a JSON object:
{
  "clusters": ["Cluster A", "Cluster B", ...],
  "concepts": [
    {"id": "c0", "cluster": "Cluster A"},
    ...
  ]
}

Respond with ONLY the JSON object.`;
}

export function promptGenerateBriefing(libraryContext: string, feedContext: string, interactionContext: string = "", interests: string[] = []): string {
  const interactionSection = interactionContext
    ? `\n${interactionContext}\n`
    : "";

  const interestsText = interests.length > 0
    ? `## User's Configured Interests (explicitly chosen topics)\n${interests.map(i => `- ${i}`).join("\n")}\n`
    : "";

  return `You are a Chief of Staff briefing a busy executive on what's happening in their areas of interest.

${interestsText}
## User's Knowledge Base (what they ALREADY know)
${libraryContext}
${interactionSection}

## Today's News Feed (numbered)
${feedContext}

## Your Task
Tell the user NEW information they don't already know. The briefing itself should be valuable - they should learn something just by reading it.

**RULES:**
1. **Tell them NEWS** - What JUST happened? What's the new development?
2. **Don't repeat their library** - They already know what's in their library. Tell them what's NEW.
3. **Be specific with facts** - "Anthropic raised $10B at $60B valuation" not "there's funding news"
4. **Make the briefing standalone valuable** - Even if they don't click any links, they should learn something
5. **Use bold for key facts** - Use **bold** around key names, numbers, and terms so they pop out when scanning
6. **Connections to user's knowledge** - If a news item connects to something in the user's library or interactions, weave it into the sentence naturally and bold it, e.g. "...which builds on your **'wrong shape software'** concept" or "...relevant to your notes on **prompt engineering**"

## Output Format
Return a JSON object:
{
  "news": [
    {
      "text": "**Company X** raised **$500M** at **$5B valuation**, 3x increase from last round. Led by Sequoia with a16z participating.",
      "refs": [1]
    },
    {
      "text": "**New framework** benchmarks show **40% speedup** over React on real-world apps — relevant to your notes on **frontend performance**.",
      "refs": [3, 5]
    }
  ],
  "goDeeper": [
    { "ref": 1, "reason": "Full breakdown of investor list and terms" },
    { "ref": 5, "reason": "Detailed benchmark data with methodology" }
  ]
}

**FIELD RULES:**
- "text": 1-2 sentences that tell the full story. Use **bold** for key facts. If there's a connection to the user's knowledge, mention it inline with bold.
- "refs": Feed item numbers (1-based) this draws from.
- "goDeeper": Only 2-3 items worth clicking. "reason" = what extra detail the article has.

Respond with ONLY valid JSON, no markdown code blocks.`;
}
