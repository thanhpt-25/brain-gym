/**
 * Pre-renders public routes to static HTML using Playwright.
 * Run after build: npm run build && npm run prerender
 *
 * Starts a local static server from dist/, visits each public route,
 * and writes the fully-rendered HTML back into dist/ so crawlers receive
 * content without executing JavaScript.
 *
 * Requires: serve-handler (npm install --save-dev serve-handler)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "../dist");
const PORT = 5174;
const BASE_URL = `http://localhost:${PORT}`;
const NAV_TIMEOUT_MS = 30_000;

const ROUTES = ["/", "/exams", "/questions", "/leaderboard"];

async function loadHandler() {
  try {
    const mod = await import("serve-handler");
    return mod.default;
  } catch {
    console.error(
      'Missing dependency: run "npm install --save-dev serve-handler" first',
    );
    process.exit(1);
  }
}

function startServer(handler) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) =>
      handler(req, res, { public: DIST }),
    );
    server.on("error", reject);
    server.listen(PORT, () => {
      console.log(`Static server → ${BASE_URL}`);
      resolve(server);
    });
  });
}

async function prerender() {
  if (!fs.existsSync(DIST)) {
    console.error("dist/ not found — run `npm run build` first");
    process.exit(1);
  }

  const handler = await loadHandler();
  const server = await startServer(handler);
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    for (const route of ROUTES) {
      const url = `${BASE_URL}${route}`;
      const outFile = path.join(
        DIST,
        route === "/" ? "index.html" : `${route.slice(1)}/index.html`,
      );

      console.log(`Rendering ${route}…`);
      await page.goto(url, { waitUntil: "networkidle", timeout: NAV_TIMEOUT_MS });
      await page.waitForSelector("#root > *", { timeout: 10_000 });

      const html = await page.content();
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.writeFileSync(outFile, html, "utf8");
      console.log(`  ✓ ${outFile}`);
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\nPre-rendered ${ROUTES.length} routes.`);
}

prerender().catch((e) => {
  console.error(e);
  process.exit(1);
});
