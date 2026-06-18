import { describe, expect, it } from "vitest";
import { createCodexParseState, parseCodexEvent } from "@/lib/agentChatEvents";

describe("Codex chat event parser", () => {
  it("emits text deltas directly", () => {
    const state = createCodexParseState();

    expect(parseCodexEvent({ type: "message_delta", delta: "hello" }, state)).toEqual([
      { type: "text", content: "hello" },
    ]);
  });

  it("emits only incremental assistant message text for repeated snapshots", () => {
    const state = createCodexParseState();

    expect(parseCodexEvent({
      type: "item_updated",
      item: { id: "msg1", role: "assistant", content: [{ type: "output_text", text: "Hello" }] },
    }, state)).toEqual([{ type: "text", content: "Hello" }]);

    expect(parseCodexEvent({
      type: "item_updated",
      item: { id: "msg1", role: "assistant", content: [{ type: "output_text", text: "Hello world" }] },
    }, state)).toEqual([{ type: "text", content: " world" }]);
  });

  it("emits final text from current Codex agent_message completions", () => {
    const state = createCodexParseState();

    expect(parseCodexEvent({
      type: "item.completed",
      item: { id: "item_0", type: "agent_message", text: "stream-ok" },
    }, state)).toEqual([{ type: "text", content: "stream-ok" }]);
  });

  it("maps command begin and end events to tool events", () => {
    const state = createCodexParseState();

    expect(parseCodexEvent({ type: "exec_command_begin", id: "cmd1", command: "ls" }, state)).toEqual([
      { type: "tool", id: "cmd1", name: "Bash", detail: "ls" },
    ]);

    expect(parseCodexEvent({ type: "exec_command_end", stdout: "done" }, state)).toEqual([
      { type: "result", toolId: "cmd1", content: "done" },
    ]);
  });

  it("does not emit very large command results into the UI stream", () => {
    const state = createCodexParseState();
    parseCodexEvent({ type: "exec_command_begin", id: "cmd1", command: "cat big" }, state);

    expect(parseCodexEvent({ type: "exec_command_end", stdout: "x".repeat(600) }, state)).toEqual([]);
  });

  it("maps error events", () => {
    const state = createCodexParseState();

    expect(parseCodexEvent({ type: "error", message: "failed" }, state)).toEqual([
      { type: "error", message: "failed" },
    ]);
  });
});
