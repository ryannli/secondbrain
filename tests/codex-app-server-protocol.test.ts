import { describe, expect, it } from "vitest";
import { createCodexAppServerProtocol } from "@/lib/codexAppServerProtocol";
import type { AgentStreamEvent } from "@/lib/agentChatEvents";

describe("Codex app-server protocol", () => {
  it("initializes, starts a thread, and starts a turn with the prompt", () => {
    const sent: unknown[] = [];
    const events: AgentStreamEvent[] = [];
    let finished = 0;

    const protocol = createCodexAppServerProtocol({
      prompt: "hello",
      cwd: "/brain",
      sendJson: (message) => sent.push(message),
      sendEvent: (event) => events.push(event),
      finish: () => { finished += 1; },
    });

    protocol.start();

    expect(sent).toMatchObject([
      { method: "initialize", id: 0 },
      { method: "initialized" },
      { method: "thread/start", id: 1, params: { cwd: "/brain", sandbox: "workspace-write", ephemeral: true } },
    ]);

    protocol.handleMessage({ id: 1, result: { thread: { id: "thread_1" } } });

    expect(sent.at(-1)).toMatchObject({
      method: "turn/start",
      id: 2,
      params: {
        threadId: "thread_1",
        cwd: "/brain",
        sandboxPolicy: { type: "workspaceWrite", writableRoots: ["/brain"] },
        input: [{ type: "text", text: "hello", text_elements: [] }],
      },
    });
    expect(events).toEqual([]);
    expect(finished).toBe(0);
  });

  it("forwards text deltas and finishes on turn completion", () => {
    const sent: unknown[] = [];
    const events: AgentStreamEvent[] = [];
    let finished = 0;

    const protocol = createCodexAppServerProtocol({
      prompt: "hello",
      cwd: "/brain",
      sendJson: (message) => sent.push(message),
      sendEvent: (event) => events.push(event),
      finish: () => { finished += 1; },
    });

    protocol.handleMessage({
      method: "item/agentMessage/delta",
      params: { itemId: "msg_1", delta: "alpha" },
    });
    protocol.handleMessage({ method: "turn/completed", params: {} });
    protocol.handleMessage({
      method: "item/agentMessage/delta",
      params: { itemId: "msg_1", delta: "ignored" },
    });

    expect(sent).toEqual([]);
    expect(events).toEqual([{ type: "text", content: "alpha" }]);
    expect(finished).toBe(1);
  });

  it("surfaces JSON-RPC errors and finishes once", () => {
    const events: AgentStreamEvent[] = [];
    let finished = 0;

    const protocol = createCodexAppServerProtocol({
      prompt: "hello",
      cwd: "/brain",
      sendJson: () => {},
      sendEvent: (event) => events.push(event),
      finish: () => { finished += 1; },
    });

    protocol.handleMessage({ id: 1, error: { message: "boom" } });
    protocol.handleMessage({ method: "turn/completed", params: {} });

    expect(events).toEqual([{ type: "error", message: "boom" }]);
    expect(finished).toBe(1);
  });
});
