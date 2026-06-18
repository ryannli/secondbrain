import { createCodexParseState, parseCodexEvent, type AgentStreamEvent } from "./agentChatEvents";

const INITIALIZE_REQUEST_ID = 0;
const THREAD_START_REQUEST_ID = 1;
const TURN_START_REQUEST_ID = 2;

interface CodexAppServerProtocolOptions {
  prompt: string;
  cwd: string;
  sendJson: (message: unknown) => void;
  sendEvent: (event: AgentStreamEvent) => void;
  finish: () => void;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function threadIdFromResponse(message: Record<string, unknown>): string | null {
  const result = asRecord(message.result);
  const thread = asRecord(result?.thread);
  return stringValue(thread?.id) ?? null;
}

export function createCodexAppServerProtocol(options: CodexAppServerProtocolOptions) {
  const codexState = createCodexParseState();
  let threadStarted = false;
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    options.finish();
  };

  const sendTurnStart = (threadId: string) => {
    options.sendJson({
      method: "turn/start",
      id: TURN_START_REQUEST_ID,
      params: {
        threadId,
        cwd: options.cwd,
        approvalPolicy: "never",
        sandboxPolicy: {
          type: "workspaceWrite",
          writableRoots: [options.cwd],
          networkAccess: false,
          excludeTmpdirEnvVar: false,
          excludeSlashTmp: false,
        },
        input: [{
          type: "text",
          text: options.prompt,
          text_elements: [],
        }],
      },
    });
  };

  return {
    start() {
      options.sendJson({
        method: "initialize",
        id: INITIALIZE_REQUEST_ID,
        params: {
          clientInfo: {
            name: "secondbrain",
            title: "Second Brain",
            version: "0.1.0",
          },
          capabilities: {
            experimentalApi: true,
            requestAttestation: false,
          },
        },
      });
      options.sendJson({ method: "initialized", params: {} });
      options.sendJson({
        method: "thread/start",
        id: THREAD_START_REQUEST_ID,
        params: {
          cwd: options.cwd,
          approvalPolicy: "never",
          sandbox: "workspace-write",
          ephemeral: true,
        },
      });
    },

    handleMessage(rawMessage: unknown) {
      const message = asRecord(rawMessage);
      if (!message || finished) return;

      for (const parsedEvent of parseCodexEvent(message, codexState)) {
        options.sendEvent(parsedEvent);
      }

      if (message.id === THREAD_START_REQUEST_ID && !threadStarted) {
        const threadId = threadIdFromResponse(message);
        if (threadId) {
          threadStarted = true;
          sendTurnStart(threadId);
        }
      }

      const method = stringValue(message.method);
      if (method === "turn/completed" || method === "turn/failed") {
        finish();
        return;
      }

      if (message.error || method === "error") {
        finish();
      }
    },
  };
}
