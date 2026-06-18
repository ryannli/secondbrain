export type AgentStreamEvent =
  | { type: "text"; content: string }
  | { type: "tool"; id: string; name: string; detail?: string }
  | { type: "subtool"; parentId: string; name: string; detail?: string }
  | { type: "result"; toolId: string; content: string }
  | { type: "subtool_done"; parentId: string }
  | { type: "error"; message: string };

export interface CodexParseState {
  textOffsets: Map<string, number>;
  seenTools: Set<string>;
  lastToolId: string | null;
}

export function createCodexParseState(): CodexParseState {
  return {
    textOffsets: new Map(),
    seenTools: new Set(),
    lastToolId: null,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function extractText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(extractText).join("");

  const record = asRecord(value);
  if (!record) return "";

  const direct = stringValue(record.text) ?? stringValue(record.content) ?? stringValue(record.message);
  if (direct) return direct;

  if (record.delta) return extractText(record.delta);
  if (record.content) return extractText(record.content);
  return "";
}

function extractError(value: unknown): string | undefined {
  if (typeof value === "string") return value;

  const record = asRecord(value);
  if (!record) return undefined;

  return stringValue(record.message)
    ?? stringValue(record.error)
    ?? extractError(record.error)
    ?? extractError(record.params);
}

function codexToolDetail(item: Record<string, unknown>): string {
  const command = stringValue(item.command);
  if (command) return command;

  const input = asRecord(item.input);
  if (input) {
    const firstString = Object.values(input).find((value) => typeof value === "string");
    if (typeof firstString === "string") return firstString;
  }

  return stringValue(item.name) ?? stringValue(item.type) ?? "";
}

function codexTextDeltaEvent(id: string, text: string, state: CodexParseState): AgentStreamEvent[] {
  state.textOffsets.set(id, (state.textOffsets.get(id) ?? 0) + text.length);
  return [{ type: "text", content: text }];
}

function codexTextEvent(id: string, text: string, state: CodexParseState): AgentStreamEvent[] {
  const previousLength = state.textOffsets.get(id) ?? 0;
  if (text.length <= previousLength) return [];

  state.textOffsets.set(id, text.length);
  return [{ type: "text", content: text.slice(previousLength) }];
}

export function parseCodexEvent(rawEvent: unknown, state: CodexParseState): AgentStreamEvent[] {
  const event = asRecord(rawEvent);
  if (!event) return [];

  const type = stringValue(event.type) ?? "";
  const method = stringValue(event.method) ?? "";
  const eventName = type || method;
  const eventNameLower = eventName.toLowerCase();
  const params = asRecord(event.params);

  if (method === "item/agentMessage/delta" && params) {
    const deltaText = stringValue(params.delta);
    if (!deltaText) return [];

    const itemId = stringValue(params.itemId) ?? "codex-agent-message";
    return codexTextDeltaEvent(itemId, deltaText, state);
  }

  const deltaText = stringValue(event.delta) ?? stringValue(event.text_delta);
  if (deltaText && (type.includes("delta") || type.includes("message"))) {
    return [{ type: "text", content: deltaText }];
  }

  if (event.error || eventNameLower.includes("error")) {
    const message = extractError(event.error) ?? extractError(event);
    return message ? [{ type: "error", message }] : [];
  }

  if (type === "exec_command_begin") {
    const toolId = stringValue(event.id) ?? `codex-tool-${Date.now()}`;
    if (state.seenTools.has(toolId)) return [];

    state.seenTools.add(toolId);
    state.lastToolId = toolId;
    return [{ type: "tool", id: toolId, name: "Bash", detail: stringValue(event.command) ?? "" }];
  }

  if (type === "exec_command_end" && state.lastToolId) {
    const output = stringValue(event.output) ?? stringValue(event.stdout);
    return output && output.length < 500
      ? [{ type: "result", toolId: state.lastToolId, content: output }]
      : [];
  }

  const item = asRecord(event.item) ?? asRecord(event.message) ?? asRecord(event.msg) ?? asRecord(params?.item);
  if (!item) return [];

  const itemType = stringValue(item.type) ?? "";
  const itemTypeLower = itemType.toLowerCase();
  const role = stringValue(item.role);
  const itemId = stringValue(item.id) ?? stringValue(event.id) ?? `codex-${type}`;

  if (role === "assistant" || itemTypeLower === "agent_message" || itemTypeLower === "agentmessage") {
    const text = extractText(item.content) || extractText(item);
    return text ? codexTextEvent(itemId, text, state) : [];
  }

  if ((eventName === "item.completed" || method === "item/completed") && state.seenTools.has(itemId)) {
    const output = stringValue(item.aggregatedOutput) ?? stringValue(item.output) ?? stringValue(item.stdout);
    return output && output.length < 500
      ? [{ type: "result", toolId: itemId, content: output }]
      : [];
  }

  const looksLikeTool = itemTypeLower.includes("tool") || itemTypeLower.includes("call") || itemTypeLower.includes("command");
  if (looksLikeTool && !state.seenTools.has(itemId)) {
    state.seenTools.add(itemId);
    state.lastToolId = itemId;
    return [{
      type: "tool",
      id: itemId,
      name: itemTypeLower === "commandexecution"
        ? "Bash"
        : (stringValue(item.name) ?? stringValue(item.tool) ?? (itemType || "Tool")),
      detail: codexToolDetail(item),
    }];
  }

  return [];
}
