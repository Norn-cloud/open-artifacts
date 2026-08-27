import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const VIEWPORTS = [320, 375, 414, 768];
const COMMAND_TIMEOUT_MS = 30_000;
const SERVER_TIMEOUT_MS = 5_000;
const AGENT_BROWSER =
  process.env.OPEN_ARTIFACTS_AGENT_BROWSER ?? "agent-browser";

const SERVER_SCRIPT = `
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
const content = readFileSync(process.argv[1]);
const server = createServer((request, response) => {
  if (request.url !== "/artifact.html") {
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(content);
});
server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (address && typeof address !== "string") console.log(address.port);
});
`;

function commandError(error) {
  const stderr = error?.stderr?.toString().trim();
  return stderr || error?.message || String(error);
}

function runBrowser(args) {
  try {
    return execFileSync(AGENT_BROWSER, args, {
      encoding: "utf8",
      timeout: COMMAND_TIMEOUT_MS,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    throw new Error(
      `${AGENT_BROWSER} ${args.join(" ")} failed: ${commandError(error)}`,
    );
  }
}

function parseEvaluation(output) {
  try {
    return JSON.parse(JSON.parse(output));
  } catch {
    throw new Error(
      `agent-browser returned an unreadable evaluation result: ${output.slice(0, 200)}`,
    );
  }
}

function evaluate(session, expression) {
  return parseEvaluation(
    runBrowser(["--session", session, "eval", `JSON.stringify(${expression})`]),
  );
}

function startPreviewServer(path) {
  const child = spawn(
    process.execPath,
    ["--input-type=module", "-e", SERVER_SCRIPT, path],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("quality smoke preview server did not start in time"));
    }, SERVER_TIMEOUT_MS);
    const fail = (error) => {
      clearTimeout(timeout);
      child.kill("SIGKILL");
      reject(error);
    };
    child.once("error", fail);
    child.stderr.once("data", (data) =>
      fail(new Error(`quality smoke preview server failed: ${data}`)),
    );
    child.stdout.once("data", (data) => {
      const port = Number(String(data).trim());
      if (!Number.isInteger(port) || port <= 0) {
        fail(
          new Error(
            `quality smoke preview server returned invalid port: ${data}`,
          ),
        );
        return;
      }
      clearTimeout(timeout);
      resolve({ child, url: `http://127.0.0.1:${port}/artifact.html` });
    });
  });
}

const renderProbe = `(() => {
  const overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
  const headingOverflows = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")]
    .filter((heading) => heading.scrollWidth > heading.clientWidth + 1)
    .map((heading) => heading.id || heading.className || heading.tagName.toLowerCase());
  return { overflow, headingOverflows };
})()`;

export async function runArtifactQualitySmoke(content) {
  const session = `oa-quality-${randomUUID()}`;
  const directory = mkdtempSync(join(tmpdir(), "oa-quality-smoke-"));
  const previewPath = join(directory, "artifact.html");
  writeFileSync(previewPath, content);

  let server;
  try {
    server = await startPreviewServer(previewPath);
    runBrowser([
      "--session",
      session,
      "--allowed-domains",
      "127.0.0.1",
      "open",
      server.url,
    ]);
    const failures = [];

    for (const width of VIEWPORTS) {
      runBrowser([
        "--session",
        session,
        "set",
        "viewport",
        String(width),
        "900",
      ]);
      const probe = evaluate(session, renderProbe);
      if (probe.overflow) {
        failures.push(`${width}px: document scrolls horizontally`);
      }
      if (probe.headingOverflows.length > 0) {
        failures.push(
          `${width}px: display heading overflows (${probe.headingOverflows.join(", ")})`,
        );
      }
    }

    if (failures.length > 0) {
      throw new Error(`quality smoke failed:\n  - ${failures.join("\n  - ")}`);
    }
    return { widths: VIEWPORTS };
  } finally {
    try {
      runBrowser(["--session", session, "close"]);
    } catch {
      // A failed browser launch may not have created a session.
    }
    server?.child.kill("SIGTERM");
    rmSync(directory, { recursive: true, force: true });
  }
}
