#!/usr/bin/env node
// Bundles src/sonar.js into dist/ and inlines it into the landing page,
// so the site works from file:// with no fetch and no runtime dependencies.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "dist");
mkdirSync(dist, { recursive: true });

const source = readFileSync(join(here, "src", "sonar.js"), "utf8");

const banner = [
  "/* Sonar — find who doesn't follow you back on Instagram.",
  " * Runs entirely in your browser tab. Nothing is uploaded anywhere.",
  " * Paste into the DevTools console on https://www.instagram.com while signed in.",
  " */"
].join("\n");

const readable = `${banner}\n${source}`;
writeFileSync(join(dist, "sonar.js"), readable);

// Compact build: drop comment-only lines and indentation. Newlines are kept so
// this stays a straightforward, verifiable transform rather than a minifier.
const compact = stripComments(source);
writeFileSync(join(dist, "sonar.compact.js"), `${banner}\n${compact}`);

const template = readFileSync(join(here, "site", "index.template.html"), "utf8");
const page = template
  .replace("__PAYLOAD__", () => jsonForScriptTag(compact))
  .replace(/__SIZE__/g, () => `${Math.round(compact.length / 1024)} KB`);
writeFileSync(join(dist, "index.html"), page);

console.log(`dist/sonar.js          ${kb(readable)}`);
console.log(`dist/sonar.compact.js  ${kb(compact)}`);
console.log(`dist/index.html              ${kb(page)}`);

function kb(text) {
  return `${(Buffer.byteLength(text) / 1024).toFixed(1)} KB`;
}

// A JSON string literal is valid JS, but "</script" would still close the tag,
// and U+2028/U+2029 are line terminators to older parsers. Both are built with
// the RegExp constructor so no raw separator ends up in this file.
function jsonForScriptTag(text) {
  const separators = new RegExp("[\\u2028\\u2029]", "g");
  return JSON.stringify(text)
    .replace(/<\/(script)/gi, "<\\/$1")
    .replace(separators, (char) => (char.charCodeAt(0) === 0x2028 ? "\\u2028" : "\\u2029"));
}

function stripComments(code) {
  const out = [];
  let inBlock = false;
  let inTemplate = false;

  for (const line of code.split("\n")) {
    const trimmed = line.trim();

    // Never touch lines inside a template literal — the CSS block contains
    // lines that start with "*" and would otherwise look like comments.
    if (!inTemplate) {
      if (inBlock) {
        if (trimmed.endsWith("*/")) inBlock = false;
        continue;
      }
      if (trimmed.startsWith("/*")) {
        if (!trimmed.endsWith("*/")) inBlock = true;
        continue;
      }
      if (trimmed.startsWith("//")) continue;
      if (!trimmed) continue;
    }

    out.push(inTemplate ? line : trimmed);
    if (countBackticks(line) % 2 === 1) inTemplate = !inTemplate;
  }
  return out.join("\n");
}

function countBackticks(line) {
  let count = 0;
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === "`" && line[i - 1] !== "\\") count += 1;
  }
  return count;
}
