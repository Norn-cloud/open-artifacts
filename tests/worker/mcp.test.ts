import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Bindings } from "../../src/api";
import app from "../../src/index";
import { mcpRequestBodyLimit } from "../../src/mcp";

const BASE = "http://artifacts.test";
const MCP_TOKEN = "mcp-test-token-0123456789abcdef0";
const MCP_CHANNEL_SECRET = "mcp-channel-secret-0123456789abcdef";
const MCP_ENV = {
  ...env,
  MCP_TOKEN,
  MCP_CHANNEL_SECRET,
} as Bindings;

function request(
  body: unknown,
  headers: Record<string, string> = {},
  token = MCP_TOKEN,
): Request {
  return new Request(`${BASE}/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "mcp-protocol-version": "2025-06-18",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function fetchMcp(
  body: unknown,
  headers: Record<string, string> = {},
  token = MCP_TOKEN,
  mcpEnv: Bindings = MCP_ENV,
): Promise<{ response: Response; value: Record<string, unknown> | null }> {
  const ctx = createExecutionContext();
  const response = await app.fetch(request(body, headers, token), mcpEnv, ctx);
  await waitOnExecutionContext(ctx);
  const raw = await response.text();
  if (raw.trim() === "") return { response, value: null };
  const payload = raw
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .at(-1);
  return {
    response,
    value:
      response.headers.get("content-type")?.includes("json") === true ||
      payload !== undefined
        ? (JSON.parse(payload ?? raw) as Record<string, unknown>)
        : null,
  };
}

async function fetchRawMcp(
  input: Request,
  mcpEnv: Bindings = MCP_ENV,
): Promise<Response> {
  const ctx = createExecutionContext();
  const response = await app.fetch(input, mcpEnv, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

function byteStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

async function initialize() {
  return fetchMcp({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      capabilities: {},
      clientInfo: { name: "open-artifacts-test", version: "1.0.0" },
      protocolVersion: "2025-06-18",
    },
  });
}

function textResult(
  value: Record<string, unknown> | null,
): Record<string, unknown> {
  const content = value?.result as
    | { content?: Array<{ text?: string }> }
    | undefined;
  const text = content?.content?.[0]?.text;
  expect(text).toEqual(expect.any(String));
  return JSON.parse(text as string) as Record<string, unknown>;
}

describe("authenticated stateless MCP endpoint", () => {
  it("is hidden when either MCP secret is absent or too short", async () => {
    const noToken = await fetchMcp(
      { jsonrpc: "2.0", id: 1, method: "ping" },
      {},
      MCP_TOKEN,
      { ...env, MCP_CHANNEL_SECRET } as Bindings,
    );
    expect(noToken.response.status).toBe(404);

    const noChannelSecret = await fetchMcp(
      { jsonrpc: "2.0", id: 1, method: "ping" },
      {},
      MCP_TOKEN,
      { ...env, MCP_TOKEN } as Bindings,
    );
    expect(noChannelSecret.response.status).toBe(404);

    const shortToken = await fetchMcp(
      { jsonrpc: "2.0", id: 1, method: "ping" },
      {},
      MCP_TOKEN,
      { ...env, MCP_TOKEN: "too-short", MCP_CHANNEL_SECRET } as Bindings,
    );
    expect(shortToken.response.status).toBe(404);

    const shortChannelSecret = await fetchMcp(
      { jsonrpc: "2.0", id: 1, method: "ping" },
      {},
      MCP_TOKEN,
      { ...env, MCP_TOKEN, MCP_CHANNEL_SECRET: "too-short" } as Bindings,
    );
    expect(shortChannelSecret.response.status).toBe(404);
  });

  it("requires a bearer token", async () => {
    const missing = await fetchMcp(
      { jsonrpc: "2.0", id: 1, method: "ping" },
      { authorization: "" },
    );
    expect(missing.response.status).toBe(401);
    expect(missing.response.headers.get("www-authenticate")).toBe("Bearer");

    const invalid = await fetchMcp(
      { jsonrpc: "2.0", id: 1, method: "ping" },
      {},
      "wrong-token",
    );
    expect(invalid.response.status).toBe(401);
  });

  it("caps streamed bodies before SDK parsing even with absent or lying Content-Length", async () => {
    const oversized = new Uint8Array(mcpRequestBodyLimit(MCP_ENV) + 1);
    for (const contentLength of [undefined, "1"]) {
      const headers = new Headers({
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${MCP_TOKEN}`,
        "content-type": "application/json",
        "mcp-protocol-version": "2025-06-18",
      });
      if (contentLength !== undefined) {
        headers.set("content-length", contentLength);
      }
      const response = await fetchRawMcp(
        new Request(`${BASE}/mcp`, {
          method: "POST",
          headers,
          body: byteStream(oversized),
        }),
      );
      expect(
        response.status,
        `content-length=${contentLength ?? "absent"}`,
      ).toBe(413);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("initializes and exposes only the project-registry tools", async () => {
    const init = await initialize();
    expect(init.response.status).toBe(200);
    expect(init.value?.result).toEqual(
      expect.objectContaining({ serverInfo: expect.any(Object) }),
    );

    const tools = await fetchMcp({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });
    expect(tools.response.status).toBe(200);
    const listed = tools.value?.result as {
      tools: Array<{ name: string; inputSchema: Record<string, unknown> }>;
    };
    expect(listed.tools.map((tool) => tool.name)).toEqual([
      "list_artifacts",
      "get_artifact",
      "list_project_artifacts",
      "publish_project_artifact",
    ]);
    expect(JSON.stringify(tools.value)).not.toMatch(
      /(?:wt_|ch_|tokenHash|channelHash)/,
    );
  });

  it("lists and reads bounded metadata/content without credential fields", async () => {
    const created = await app.fetch(
      new Request(`${BASE}/api/artifacts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: "<h1>MCP registry fixture</h1>",
          favicon: "🧭",
          title: "MCP registry fixture",
        }),
      }),
      MCP_ENV,
      createExecutionContext(),
    );
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as { id: string };

    const listed = await fetchMcp({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "list_artifacts",
        arguments: { limit: 100, query: "MCP registry fixture" },
      },
    });
    expect(listed.response.status).toBe(200);
    const listedBody = textResult(listed.value);
    expect(listedBody.count).toBe(1);
    expect((listedBody.artifacts as Array<{ id: string }>)[0]?.id).toBe(
      createdBody.id,
    );

    const read = await fetchMcp({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "get_artifact",
        arguments: {
          id: createdBody.id,
          includeContent: true,
          contentLimit: 8,
        },
      },
    });
    expect(read.response.status).toBe(200);
    const readBody = textResult(read.value);
    expect(readBody.content).toBe("<h1>M…");
    expect(readBody.contentTruncated).toBe(true);
    expect(JSON.stringify(read.value)).not.toMatch(
      /(?:wt_[A-Za-z0-9_-]+|ch_[A-Za-z0-9_-]+|tokenHash|channelHash)/,
    );
  });

  it("filters private and org artifacts before applying list limits and denies direct reads", async () => {
    const title = "MCP visibility filtering fixture";
    const create = async () => {
      const response = await app.fetch(
        new Request(`${BASE}/api/artifacts`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            content: `<h1>${title}</h1>`,
            favicon: "🔐",
            title,
          }),
        }),
        MCP_ENV,
        createExecutionContext(),
      );
      expect(response.status).toBe(201);
      return (await response.json()) as { id: string };
    };
    const privateArtifact = await create();
    const orgArtifact = await create();
    const publicArtifact = await create();
    await env.DB.batch([
      env.DB.prepare("UPDATE artifacts SET visibility = ? WHERE id = ?").bind(
        "private",
        privateArtifact.id,
      ),
      env.DB.prepare("UPDATE artifacts SET visibility = ? WHERE id = ?").bind(
        "org",
        orgArtifact.id,
      ),
    ]);

    const listed = await fetchMcp({
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: {
        name: "list_artifacts",
        arguments: { limit: 1, query: title },
      },
    });
    const listedBody = textResult(listed.value);
    expect(listedBody.count).toBe(1);
    expect((listedBody.artifacts as Array<{ id: string }>)[0]?.id).toBe(
      publicArtifact.id,
    );

    for (const id of [privateArtifact.id, orgArtifact.id]) {
      const denied = await fetchMcp({
        jsonrpc: "2.0",
        id: 10,
        method: "tools/call",
        params: {
          name: "get_artifact",
          arguments: { id },
        },
      });
      expect(denied.value?.result).toEqual(
        expect.objectContaining({ isError: true }),
      );
      expect(JSON.stringify(denied.value)).not.toContain(title);
    }
  });

  it("uses authoritative R2 encryption metadata when the D1 version flag is stale", async () => {
    const created = await app.fetch(
      new Request(`${BASE}/api/artifacts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: "plain placeholder",
          favicon: "🛡️",
          title: "MCP stale encryption fixture",
        }),
      }),
      MCP_ENV,
      createExecutionContext(),
    );
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };
    const ciphertext = "ciphertext-must-not-escape";
    await env.CONTENT.put(
      `content/${id}/1`,
      JSON.stringify({
        v: 1,
        alg: "AES-GCM",
        kdf: "PBKDF2-SHA256",
        iterations: 5000,
        salt: "c2FsdA==",
        iv: "aXY=",
        ciphertext,
      }),
      { customMetadata: { encrypted: "1" } },
    );
    await env.DB.prepare(
      "UPDATE versions SET encrypted = 0 WHERE artifact_id = ? AND version = 1",
    )
      .bind(id)
      .run();

    const read = await fetchMcp({
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: {
        name: "get_artifact",
        arguments: { id, includeContent: true },
      },
    });
    const readBody = textResult(read.value);
    expect(readBody.content).toBeNull();
    expect(readBody.contentAvailable).toBe(false);
    expect(JSON.stringify(read.value)).not.toContain(ciphertext);
  });

  it("publishes stable project channels and increments versions without tokens", async () => {
    const first = await fetchMcp({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "publish_project_artifact",
        arguments: {
          content: "# Core Kit\n\nFirst registry snapshot.",
          favicon: "🧰",
          format: "markdown",
          project: "core-kit",
          title: "Core Kit registry",
        },
      },
    });
    expect(first.response.status).toBe(200);
    const firstBody = textResult(first.value);
    expect(firstBody.project).toBe("core-kit");
    expect(firstBody.created).toBe(true);
    expect(firstBody).not.toHaveProperty("writeToken");
    expect(JSON.stringify(first.value)).not.toMatch(
      /(?:wt_|ch_|MCP_CHANNEL_SECRET)/,
    );

    const second = await fetchMcp({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "publish_project_artifact",
        arguments: {
          content: "# Core Kit\n\nSecond registry snapshot.",
          favicon: "🧰",
          format: "markdown",
          project: "core-kit",
          title: "Core Kit registry v2",
        },
      },
    });
    const secondBody = textResult(second.value);
    expect(secondBody.created).toBe(false);
    expect(secondBody.version).toBe(2);
    expect((secondBody.artifact as { id: string }).id).toBe(
      (firstBody.artifact as { id: string }).id,
    );

    const project = await fetchMcp({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "list_project_artifacts",
        arguments: { project: "core-kit" },
      },
    });
    const projectBody = textResult(project.value);
    expect((projectBody.artifact as { id: string }).id).toBe(
      (firstBody.artifact as { id: string }).id,
    );
    expect((projectBody.versions as unknown[]).length).toBe(2);
    expect(JSON.stringify(project.value)).not.toMatch(
      /(?:wt_|ch_|channelHash)/,
    );
  });

  it("preserves an existing project format when a republish omits format", async () => {
    const first = await fetchMcp({
      jsonrpc: "2.0",
      id: 12,
      method: "tools/call",
      params: {
        name: "publish_project_artifact",
        arguments: {
          content: "# Zen registry\n\nMarkdown v1.",
          favicon: "🧘",
          format: "markdown",
          project: "zen",
          title: "Zen registry",
        },
      },
    });
    const firstBody = textResult(first.value);
    const firstArtifact = firstBody.artifact as { id: string; format: string };
    expect(firstArtifact.format).toBe("markdown");

    const second = await fetchMcp({
      jsonrpc: "2.0",
      id: 13,
      method: "tools/call",
      params: {
        name: "publish_project_artifact",
        arguments: {
          content: "# Zen registry\n\nMarkdown v2.",
          favicon: "🧘",
          project: "zen",
          title: "Zen registry v2",
        },
      },
    });
    const secondBody = textResult(second.value);
    expect((secondBody.artifact as { format: string }).format).toBe("markdown");
    expect(secondBody.version).toBe(2);

    const project = await fetchMcp({
      jsonrpc: "2.0",
      id: 14,
      method: "tools/call",
      params: {
        name: "list_project_artifacts",
        arguments: { project: "zen" },
      },
    });
    const projectBody = textResult(project.value);
    expect(
      (projectBody.versions as Array<{ format: string }>).map(
        (version) => version.format,
      ),
    ).toEqual(["markdown", "markdown"]);
  });

  it("uses the existing domain byte limit and rejects oversized content", async () => {
    const result = await fetchMcp({
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: {
        name: "publish_project_artifact",
        arguments: {
          content: "x".repeat(4 * 1024 * 1024 + 1),
          favicon: "⚠️",
          project: "norn",
          title: "Too large",
        },
      },
    });
    expect(result.response.status).toBe(200);
    expect(result.value?.result).toEqual(
      expect.objectContaining({ isError: true }),
    );
    const resultBody = result.value?.result as
      | { content: Array<{ text: string }> }
      | undefined;
    const text = resultBody?.content[0]?.text;
    expect(text).toMatch(/content: Too big.*4194304/);
  });
});
