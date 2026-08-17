#!/usr/bin/env node
// Warns about posts missing from feed.xml. Does NOT modify feed.xml —
// the feed is maintained by hand; this only flags what needs adding.
// Run with `node check-feed.js`. Always exits 0 (warn-only, non-blocking).

const fs = require("fs");
const path = require("path");

const SITE_URL = "https://ben-chaplin.com";
const POSTS_DIR = path.join(__dirname, "posts");
const EXTERNAL_POSTS = path.join(__dirname, "external-posts.json");
const FEED = path.join(__dirname, "feed.xml");

let feed;
try {
  feed = fs.readFileSync(FEED, "utf8");
} catch (_) {
  console.warn("⚠️  feed.xml not found — nothing to check against.");
  process.exit(0);
}

// Collect the URLs every post should appear under in the feed.
const expected = [];

for (const file of fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md"))) {
  const slug = file.replace(/\.md$/, "");
  expected.push({ label: file, url: `${SITE_URL}/blog/${slug}` });
}

try {
  for (const p of JSON.parse(fs.readFileSync(EXTERNAL_POSTS, "utf8"))) {
    expected.push({ label: `${p.title} (external)`, url: p.url });
  }
} catch (_) {}

const missing = expected.filter((p) => !feed.includes(p.url));

if (missing.length) {
  console.warn(`\n⚠️  ${missing.length} post(s) missing from feed.xml — add by hand:`);
  for (const p of missing) {
    console.warn(`     - ${p.label}\n       ${p.url}`);
  }
  console.warn("");
} else {
  console.log("✓ feed.xml is up to date.");
}
