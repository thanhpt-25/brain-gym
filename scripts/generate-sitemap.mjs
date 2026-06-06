/**
 * Generates public/sitemap.xml by fetching live exam and question IDs from the API.
 * Run after build: node scripts/generate-sitemap.mjs
 *
 * Requires VITE_API_BASE_URL or falls back to https://brain-gym.biz/api/v1
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_URL = "https://brain-gym.biz";
const API_BASE = process.env.VITE_API_BASE_URL ?? `${SITE_URL}/api/v1`;
const OUT_PATH = path.join(__dirname, "../public/sitemap.xml");
const PAGE_SIZE = 100;

const staticRoutes = [
  { loc: "/", changefreq: "weekly", priority: "1.0" },
  { loc: "/exams", changefreq: "daily", priority: "0.9" },
  { loc: "/questions", changefreq: "daily", priority: "0.9" },
  { loc: "/leaderboard", changefreq: "daily", priority: "0.7" },
];

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function fetchAllPages(buildUrl) {
  const items = [];
  let page = 1;
  while (true) {
    const data = await fetchJson(buildUrl(page));
    const batch = data?.data ?? data?.items ?? [];
    items.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    page++;
  }
  return items;
}

async function fetchDynamicRoutes() {
  const routes = [];

  try {
    const examList = await fetchAllPages(
      (p) => `${API_BASE}/exams?limit=${PAGE_SIZE}&page=${p}`,
    );
    for (const exam of examList) {
      if (exam.shareCode) {
        routes.push({
          loc: `/exams/share/${exam.shareCode}`,
          changefreq: "weekly",
          priority: "0.6",
        });
      } else if (exam.id) {
        routes.push({
          loc: `/exams/${exam.id}`,
          changefreq: "weekly",
          priority: "0.6",
        });
      }
    }
  } catch (e) {
    console.warn("Could not fetch exams:", e.message);
  }

  try {
    const questionList = await fetchAllPages(
      (p) =>
        `${API_BASE}/questions?limit=${PAGE_SIZE}&page=${p}&status=APPROVED`,
    );
    for (const q of questionList) {
      if (q.id) {
        routes.push({
          loc: `/questions/${q.id}`,
          changefreq: "monthly",
          priority: "0.5",
        });
      }
    }
  } catch (e) {
    console.warn("Could not fetch questions:", e.message);
  }

  return routes;
}

function buildXml(routes) {
  const today = new Date().toISOString().split("T")[0];
  const urls = routes
    .map(
      (r) => `  <url>
    <loc>${SITE_URL}${escapeXml(r.loc)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${escapeXml(r.changefreq)}</changefreq>
    <priority>${escapeXml(r.priority)}</priority>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

async function main() {
  console.log("Generating sitemap…");
  const dynamic = await fetchDynamicRoutes();
  const all = [...staticRoutes, ...dynamic];
  const xml = buildXml(all);
  fs.writeFileSync(OUT_PATH, xml, "utf8");
  console.log(`✓ Wrote ${all.length} URLs to ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
