import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import type { Bindings } from "./api";
import { resolveMaxContentBytes } from "./api";
import type { ArtifactFormat, UpdateInput, VersionMeta } from "./domain";
import { validateCreate } from "./domain";
import { type ArtifactRecord, D1R2Store } from "./store";
import {
  generateId,
  generateWriteToken,
  sha256Hex,
  timingSafeEqual,
} from "./tokens";

/** The project namespace is deliberately closed: arbitrary channel names
 * would let a caller use the MCP surface as a second, unbounded publish API. */
export const PROJECT_SLUGS = [
  "norn",
  "soliman",
  "zen",
  "core-kit",
  "atlas",
  "mesh-vms",
  "mailcore",
  "notifycore",
  "registry",
] as const;

export type ProjectSlug = (typeof PROJECT_SLUGS)[number];

const PROJECT_SLUG_SCHEMA = z.enum(PROJECT_SLUGS);
const MAX_LIST_LIMIT = 100;
const DEFAULT_LIST_LIMIT = 50;
const MAX_QUERY_LENGTH = 200;
const DEFAULT_CONTENT_LIMIT = 64 * 1024;
const MAX_CONTENT_LIMIT = 128 * 1024;
const MAX_VERSION_HISTORY = 100;
const TRUNCATION_MARKER = "…";
const MCP_NAMESPACE = "open-artifacts:project-channel:v1:";

type PublicArtifact = {
  id: string;
  url: string;
  title: string;
  description: string;
  favicon: string;
  format: ArtifactFormat;
  encrypted: boolean;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
};

type PublicVersion = VersionMeta;

type McpSuccess = {
  content: [{ type: "text"; text: string }];
  isError?: false;
};

type McpFailure = {
  content: [{ type: "text"; text: string }];
  isError: true;
};

type McpResult = McpSuccess | McpFailure;

function jsonResult(value: unknown): McpSuccess {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
  };
}

function errorResult(message: string): McpFailure {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

function safeBaseUrl(env: Bindings, request: Request): string {
  const configured = env.PUBLIC_URL?.trim();
  if (configured !== undefined && configured !== "") {
    return configured.replace(/\/+$/, "");
  }
  return new URL(request.url).origin;
}

function publicUrl(env: Bindings, request: Request, id: string): string {
  return `${safeBaseUrl(env, request)}/a/${encodeURIComponent(id)}`;
}

function publicVersionUrl(
  env: Bindings,
  request: Request,
  id: string,
  version: number,
): string {
  return `${publicUrl(env, request, id)}?v=${version}`;
}

function publicArtifact(
  env: Bindings,
  request: Request,
  record: ArtifactRecord,
): PublicArtifact {
  // Do not spread ArtifactRecord here. It contains token hashes, channel
  // hashes, and ownership identifiers that are intentionally not MCP data.
  return {
    id: record.id,
    url: publicUrl(env, request, record.id),
    title: record.title,
    description: record.description,
    favicon: record.favicon,
    format: record.format,
    encrypted: record.encrypted,
    currentVersion: record.currentVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function publicVersions(
  env: Bindings,
  request: Request,
  id: string,
  versions: VersionMeta[],
): Array<PublicVersion & { url: string }> {
  return versions.map((version) => ({
    ...version,
    url: publicVersionUrl(env, request, id, version.version),
  }));
}

function boundedVersionHistory(
  env: Bindings,
  request: Request,
  id: string,
  versions: VersionMeta[],
): {
  versions: Array<PublicVersion & { url: string }>;
  versionCount: number;
  versionsTruncated: boolean;
} {
  const visible =
    versions.length > MAX_VERSION_HISTORY
      ? versions.slice(-MAX_VERSION_HISTORY)
      : versions;
  return {
    versions: publicVersions(env, request, id, visible),
    versionCount: versions.length,
    versionsTruncated: visible.length !== versions.length,
  };
}

function boundedLimit(value: number | undefined): number {
  if (value === undefined || !Number.isInteger(value)) {
    return DEFAULT_LIST_LIMIT;
  }
  return Math.min(Math.max(value, 1), MAX_LIST_LIMIT);
}

function boundedContentLimit(value: number | undefined): number {
  if (value === undefined || !Number.isInteger(value)) {
    return DEFAULT_CONTENT_LIMIT;
  }
  return Math.min(Math.max(value, 1), MAX_CONTENT_LIMIT);
}

function truncateUtf8(
  value: string,
  maxBytes: number,
): {
  content: string;
  truncated: boolean;
} {
  const bytes = new TextEncoder().encode(value);
  if (bytes.byteLength <= maxBytes) {
    return { content: value, truncated: false };
  }
  // Build by code point so the response is valid UTF-8 and reserve room for
  // the marker. In particular, never append a 3-byte marker after slicing a
  // full maxBytes prefix: MCP callers rely on contentLimit being a hard cap.
  const markerBytes = new TextEncoder().encode(TRUNCATION_MARKER).byteLength;
  const prefixBudget =
    maxBytes >= markerBytes ? maxBytes - markerBytes : maxBytes;
  let prefix = "";
  let prefixBytes = 0;
  for (const codePoint of value) {
    const codePointBytes = new TextEncoder().encode(codePoint).byteLength;
    if (prefixBytes + codePointBytes > prefixBudget) break;
    prefix += codePoint;
    prefixBytes += codePointBytes;
  }
  const content =
    maxBytes >= markerBytes ? `${prefix}${TRUNCATION_MARKER}` : prefix;
  return { content, truncated: true };
}

function isProjectSlug(value: string): value is ProjectSlug {
  return (PROJECT_SLUGS as readonly string[]).includes(value);
}

/**
 * Returns the opaque D1 channel hash for a fixed project. The plaintext
 * project slug is not itself a channel credential, and the HMAC secret never
 * leaves the Worker; a deployment can therefore expose stable project URLs
 * without returning `ch_`/write tokens to agents.
 */
export async function projectChannelHash(
  project: ProjectSlug,
  secret: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${MCP_NAMESPACE}${project}`),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function channelBindingConflict(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("UNIQUE constraint failed") &&
    error.message.includes("channel_hash")
  );
}

function projectMetadata(
  env: Bindings,
  request: Request,
  project: ProjectSlug,
  record: ArtifactRecord | null,
  versions: VersionMeta[],
) {
  return {
    project,
    artifact: record === null ? null : publicArtifact(env, request, record),
    ...(record === null
      ? { versions: [], versionCount: 0, versionsTruncated: false }
      : boundedVersionHistory(env, request, record.id, versions)),
  };
}

async function readProject(
  env: Bindings,
  request: Request,
  project: ProjectSlug,
): Promise<McpResult> {
  const secret = env.MCP_CHANNEL_SECRET;
  if (secret === undefined || secret === "") {
    // The outer route already fails closed. Keep this guard for direct unit
    // tests and future call sites that use the tool factory independently.
    return errorResult("project channel registry is unavailable");
  }
  const store = new D1R2Store(env.DB, env.CONTENT);
  const record = await store.findByChannel(
    await projectChannelHash(project, secret),
  );
  const versions = record === null ? [] : await store.listVersions(record.id);
  return jsonResult(projectMetadata(env, request, project, record, versions));
}

async function publishProject(
  env: Bindings,
  request: Request,
  args: {
    project: ProjectSlug;
    content: string;
    format?: ArtifactFormat;
    title?: string;
    description?: string;
    favicon?: string;
    label?: string;
  },
): Promise<McpResult> {
  const channelSecret = env.MCP_CHANNEL_SECRET;
  if (channelSecret === undefined || channelSecret === "") {
    return errorResult("project channel registry is unavailable");
  }

  // Keep this path on the same validation function and cap configuration as
  // REST publishing. This preserves byte limits, title extraction, emoji
  // validation, formats, labels, and future domain changes in one place.
  const parsed = validateCreate(
    {
      content: args.content,
      format: args.format,
      title: args.title,
      description: args.description,
      favicon: args.favicon,
      label: args.label,
    },
    resolveMaxContentBytes(env),
  );
  if (!parsed.ok) {
    return errorResult(`${parsed.status}: ${parsed.error}`);
  }
  // MCP project publishing deliberately accepts plaintext only. Encrypted
  // Recipes are client-side zero-knowledge artifacts and cannot be usefully
  // inspected by the project registry; omitting `encrypted` also means the
  // tool can never accidentally return a ciphertext envelope as plaintext.
  const input = parsed.value;
  const channelHash = await projectChannelHash(args.project, channelSecret);
  const store = new D1R2Store(env.DB, env.CONTENT);
  let record = await store.findByChannel(channelHash);
  let createdByRequest = false;

  if (record === null) {
    const writeTokenHash = await sha256Hex(generateWriteToken());
    try {
      record = await store.create(
        generateId(),
        writeTokenHash,
        input,
        channelHash,
      );
      createdByRequest = true;
    } catch (error) {
      // Concurrent first publishes to the same fixed project channel race on
      // the existing unique index. Re-read the winner and continue as a
      // version publish; never expose the ephemeral write token.
      if (!channelBindingConflict(error)) throw error;
      record = await store.findByChannel(channelHash);
      if (record === null) throw error;
    }

    if (createdByRequest) {
      return jsonResult({
        project: args.project,
        artifact: publicArtifact(env, request, record),
        version: 1,
        created: true,
      });
    }
  }

  const update: UpdateInput = {
    content: input.content,
    format: input.format,
    title: input.title,
    description: input.description,
    favicon: input.favicon,
    label: input.label,
    encrypted: null,
    baseVersion: null,
    force: false,
  };
  let current = record;
  let version: number | { conflict: true; currentVersion: number } = {
    conflict: true,
    currentVersion: current.currentVersion,
  };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    version = await store.update(current, update);
    if (typeof version === "number") {
      const updated = await store.get(current.id);
      return jsonResult({
        project: args.project,
        artifact: publicArtifact(env, request, updated ?? current),
        version,
        created: false,
      });
    }
    const fresh = await store.get(current.id);
    if (fresh === null) return errorResult("project artifact disappeared");
    current = fresh;
  }
  return errorResult(
    `409: version conflict at ${"currentVersion" in version ? version.currentVersion : current.currentVersion}`,
  );
}

function createServer(env: Bindings, request: Request): McpServer {
  const server = new McpServer({
    name: "Open Artifacts Project Registry",
    version: "1.0.0",
  });

  server.registerTool(
    "list_artifacts",
    {
      title: "List artifacts",
      description:
        "List bounded public artifact metadata. Optionally search id, title, or description.",
      inputSchema: z.object({
        query: z.string().max(MAX_QUERY_LENGTH).optional(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
      }),
    },
    async (args) => {
      const store = new D1R2Store(env.DB, env.CONTENT);
      const query = args.query?.trim() ?? "";
      const artifacts = await store.list({
        limit: boundedLimit(args.limit),
        query,
      });
      return jsonResult({
        artifacts: artifacts.map((artifact) =>
          publicArtifact(env, request, artifact),
        ),
        count: artifacts.length,
        limit: boundedLimit(args.limit),
        query,
      });
    },
  );

  server.registerTool(
    "get_artifact",
    {
      title: "Get artifact",
      description:
        "Read artifact metadata and version history, with optional bounded plaintext content.",
      inputSchema: z.object({
        id: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{12}$/),
        version: z.number().int().min(1).optional(),
        includeContent: z.boolean().optional(),
        contentLimit: z.number().int().min(1).max(MAX_CONTENT_LIMIT).optional(),
      }),
    },
    async (args) => {
      const store = new D1R2Store(env.DB, env.CONTENT);
      const record = await store.get(args.id);
      if (record === null) return errorResult("artifact not found");
      const versions = await store.listVersions(record.id);
      const versionNumber = args.version ?? record.currentVersion;
      const version = versions.find((item) => item.version === versionNumber);
      if (version === undefined) return errorResult("version not found");

      const result: Record<string, unknown> = {
        artifact: publicArtifact(env, request, record),
        version: {
          ...version,
          url: publicVersionUrl(env, request, record.id, version.version),
        },
        ...boundedVersionHistory(env, request, record.id, versions),
      };
      if (args.includeContent === true) {
        if (version.encrypted) {
          result.content = null;
          result.contentAvailable = false;
          result.contentReason = "encrypted artifact content is not exposed";
        } else {
          const content = await store.getContent(record.id, version.version);
          if (content === null) return errorResult("content not found");
          const bounded = truncateUtf8(
            content.body,
            boundedContentLimit(args.contentLimit),
          );
          result.content = bounded.content;
          result.contentAvailable = true;
          result.contentTruncated = bounded.truncated;
          result.contentLimit = boundedContentLimit(args.contentLimit);
        }
      }
      return jsonResult(result);
    },
  );

  server.registerTool(
    "list_project_artifacts",
    {
      title: "List project artifacts",
      description:
        "Resolve one of the fixed project channels and return its artifact metadata and versions.",
      inputSchema: z.object({ project: PROJECT_SLUG_SCHEMA }),
    },
    async ({ project }) => readProject(env, request, project),
  );

  server.registerTool(
    "publish_project_artifact",
    {
      title: "Publish project artifact",
      description:
        "Create or version the stable artifact for a fixed project. Publishing is plaintext and domain-validated.",
      inputSchema: z.object({
        project: PROJECT_SLUG_SCHEMA,
        content: z.string().min(1),
        format: z.enum(["html", "markdown", "react"]).optional(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(1000).optional(),
        favicon: z.string().min(1).optional(),
        label: z.string().max(60).optional(),
      }),
    },
    async (args) => publishProject(env, request, args),
  );

  return server;
}

async function constantTimeBearerMatches(
  request: Request,
  expected: string,
): Promise<boolean> {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer[ \t]+([^ \t]+)$/i);
  const presented = match?.[1] ?? "";
  const [presentedHash, expectedHash] = await Promise.all([
    sha256Hex(presented),
    sha256Hex(expected),
  ]);
  return match !== undefined && timingSafeEqual(presentedHash, expectedHash);
}

function unavailableResponse(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: { "cache-control": "no-store" },
  });
}

function unauthorizedResponse(): Response {
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "cache-control": "no-store",
      "www-authenticate": "Bearer",
    },
  });
}

/**
 * Authenticated stateless Streamable HTTP entry point. The handler is built
 * per request so its factory closes over the request's D1/R2 bindings without
 * sharing an MCP server instance between concurrent requests.
 */
export async function handleMcp(
  request: Request,
  env: Bindings,
  ctx: ExecutionContext,
): Promise<Response> {
  const token = env.MCP_TOKEN;
  const channelSecret = env.MCP_CHANNEL_SECRET;
  if (
    token === undefined ||
    token === "" ||
    channelSecret === undefined ||
    channelSecret === ""
  ) {
    return unavailableResponse();
  }
  if (!(await constantTimeBearerMatches(request, token))) {
    return unauthorizedResponse();
  }
  const handler = createMcpHandler(() => createServer(env, request), {
    route: "/mcp",
    // The endpoint is fronted by Agent Gateway. Keep the Cloudflare handler
    // strict about Host/Origin defaults while allowing non-browser clients;
    // no wildcard Origin override is needed for Codex/Claude.
    legacy: "stateless",
  });
  return handler(request, env, ctx);
}

export function isKnownProjectSlug(value: string): value is ProjectSlug {
  return isProjectSlug(value);
}
