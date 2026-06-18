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

  it("emits Codex app-server agent message deltas without duplicating the final item", () => {
    const state = createCodexParseState();

    expect(parseCodexEvent({
      method: "item/agentMessage/delta",
      params: { itemId: "msg_1", delta: "alpha" },
    }, state)).toEqual([{ type: "text", content: "alpha" }]);

    expect(parseCodexEvent({
      method: "item/agentMessage/delta",
      params: { itemId: "msg_1", delta: "\nbeta" },
    }, state)).toEqual([{ type: "text", content: "\nbeta" }]);

    expect(parseCodexEvent({
      method: "item/completed",
      params: { item: { id: "msg_1", type: "agentMessage", text: "alpha\nbeta" } },
    }, state)).toEqual([]);
  });

  it("does not treat app-server user messages as assistant text", () => {
    const state = createCodexParseState();

    expect(parseCodexEvent({
      method: "item/completed",
      params: {
        item: {
          id: "user_1",
          type: "userMessage",
          content: [{ type: "text", text: "hello", text_elements: [] }],
        },
      },
    }, state)).toEqual([]);
  });

  it("maps app-server command execution items to tool events and short results", () => {
    const state = createCodexParseState();

    expect(parseCodexEvent({
      method: "item/started",
      params: { item: { id: "cmd_1", type: "commandExecution", command: "ls", status: "running" } },
    }, state)).toEqual([{ type: "tool", id: "cmd_1", name: "Bash", detail: "ls" }]);

    expect(parseCodexEvent({
      method: "item/completed",
      params: {
        item: {
          id: "cmd_1",
          type: "commandExecution",
          command: "ls",
          aggregatedOutput: "done",
        },
      },
    }, state)).toEqual([{ type: "result", toolId: "cmd_1", content: "done" }]);
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

    expect(parseCodexEvent({ id: 1, error: { message: "app-server failed" } }, state)).toEqual([
      { type: "error", message: "app-server failed" },
    ]);
  });
});
