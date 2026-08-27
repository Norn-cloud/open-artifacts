import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { frameDocument, unlockShell } from "../../src/wrap";

const BASE = "http://artifacts.test";

async function create(body: Record<string, unknown>): Promise<CreateResult> {
  const res = await exports.default.fetch(
    new Request(`${BASE}/api/artifacts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Frame Shell Test",
        favicon: "🧩",
        ...body,
      }),
    }),
  );
  expect(res.status).toBe(201);
  return (await res.json()) as CreateResult;
}

interface CreateResult {
  id: string;
  url: string;
  writeToken: string;
  version: number;
}

describe("frameDocument — sheet presentation", () => {
  it.each(["html", "markdown", "react"] as const)(
    "insets %s content as a bordered sheet on a themed backdrop",
    (format) => {
      const doc = frameDocument({ format, content: "<p>hi</p>", nonce: "n" });
      expect(doc).toContain("--oa-shell-gap");
      expect(doc).toContain("html{background:var(--oa-shell-backdrop)}");
      expect(doc).toMatch(
        /body\{margin:var\(--oa-shell-gap\);background:var\(--oa-bg\);border:1px solid var\(--oa-border\);border-radius:var\(--oa-shell-radius\)/,
      );
    },
  );

  it("keeps the window as the scroll container (handoff drives window.scrollTo)", () => {
    const doc = frameDocument({
      format: "html",
      content: "<p>hi</p>",
      nonce: "n",
    });
    // The sheet is body margin, not a body scrollport: no overflow on the
    // scrolling element, so the record/play shim's window.scrollTo keeps working.
    expect(doc).not.toMatch(/html\{[^}]*overflow/);
    expect(doc).not.toMatch(/body\{[^}]*overflow-y:auto/);
  });

  it("detects canvas mode before first paint and restores the full-bleed plane", () => {
    const doc = frameDocument({
      format: "html",
      content: "<p>hi</p>",
      nonce: "n",
    });
    expect(doc).toContain('html[data-shell="flat"]');
    // Same signal the comments bridge uses: a transformed .oa-plane.
    expect(doc).toMatch(/querySelector\('\.oa-plane'\)/);
    expect(doc).toMatch(/transform!=='none'/);
    expect(doc).toMatch(/setAttribute\('data-shell','flat'\)/);
  });

  it("re-pins authored sticky headers below the sheet inset", () => {
    const doc = frameDocument({
      format: "html",
      content: "<p>hi</p>",
      nonce: "n",
    });
    expect(doc).toMatch(/position==='sticky'/);
    expect(doc).toMatch(/style\.top='var\(--oa-shell-gap\)'/);
  });

  it("flows through the encrypted unlock template", () => {
    const shell = unlockShell({
      title: "Encrypted",
      description: "",
      favicon: "🔒",
      format: "html",
      url: `${BASE}/a/abc123456789`,
      ogImage: `${BASE}/og/abc123456789`,
      brand: {
        name: "Open Artifacts",
        wordmark: "OPEN ARTIFACTS",
        tagline: "t",
      },
      branded: false,
      artifactId: "abc123456789",
      nonce: "n",
      envelope: {
        salt: "AAAA",
        iv: "AAAA",
        iterations: 10000,
        ciphertext: "AAAA",
      },
    });
    expect(shell).toContain("--oa-shell-gap");
  });
});

describe("GET /a/:id — the host page stays full-bleed", () => {
  it("carries no sheet presentation; the frame keeps its fixed positioning", async () => {
    const created = await create({ content: "<h1>Sheet</h1>" });
    const res = await exports.default.fetch(`${BASE}/a/${created.id}`);
    expect(res.status).toBe(200);
    const hostHtml = await res.text();
    expect(hostHtml).not.toContain("oa-shell");
    expect(hostHtml).toContain("#oa-frame{position:fixed");
  });

  it("serves the sheet presentation from the frame route", async () => {
    const created = await create({ content: "<h1>Sheet</h1>" });
    const res = await exports.default.fetch(`${BASE}/a/${created.id}/frame`);
    expect(res.status).toBe(200);
    const frameHtml = await res.text();
    expect(frameHtml).toContain("--oa-shell-gap");
    expect(frameHtml).toContain("<h1>Sheet</h1>");
  });

  it("includes smooth frame opacity transition and global shortcuts on host page", async () => {
    const created = await create({ content: "<h1>Shortcuts</h1>" });
    const res = await exports.default.fetch(`${BASE}/a/${created.id}`);
    expect(res.status).toBe(200);
    const hostHtml = await res.text();
    expect(hostHtml).toContain("opacity:0;transition:opacity .15s ease");
    expect(hostHtml).toContain("#oa-frame[data-ready]{opacity:1}");
    expect(hostHtml).toContain('e.key==="c"||e.key==="C"');
    expect(hostHtml).toContain('e.key==="t"||e.key==="T"');
  });
});
