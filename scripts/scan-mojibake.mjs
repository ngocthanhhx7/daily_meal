#!/usr/bin/env node
import { TextDecoder } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

const decoder = new TextDecoder("utf-8", { fatal: true });

const MOJIBAKE_PATTERNS = [
  {
    name: "replacement-character",
    regex: /\uFFFD/g,
    reason: "Unicode replacement character usually means invalid or lossy decoding.",
  },
  {
    name: "utf8-read-as-cp1252-vietnamese",
    regex: /(?:\u00C3[\u0080-\u00BF]|\u00C4[\u0080-\u00BF]|\u00C6[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]|\u00E1[\u00BA-\u00BF][\u0080-\u00BF])/g,
    reason: "Common Vietnamese UTF-8 byte sequences rendered as Windows-1252/Latin-1 text.",
  },
  {
    name: "smart-punctuation-mojibake",
    regex: /\u00E2\u20AC[\u0098-\u009D\u2018-\u201D]|\u00E2\u20AC[\u0093-\u009D\u2013\u201D]|\u00E2\u0080[\u0093-\u009D]/g,
    reason: "Curly quotes, dashes, or ellipsis rendered as mojibake.",
  },
  {
    name: "stray-c1-control",
    regex: /[\u0080-\u009F]/g,
    reason: "C1 control characters should not appear in UTF-8 Markdown.",
  },
];

function usage() {
  return [
    "Usage: node scripts/scan-mojibake.mjs [paths...]",
    "",
    "Scans repo text/code files for invalid UTF-8 and common mojibake sequences.",
    "When no path is provided, scans README.md, docs, client/src, and server/src.",
  ].join("\n");
}

function walkFiles(inputPath) {
  const absolute = path.resolve(inputPath);
  if (!fs.existsSync(absolute)) return [];

  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [absolute];
  if (!stat.isDirectory()) return [];

  const files = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const fullPath = path.join(absolute, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function defaultTargets() {
  const targets = [];
  if (fs.existsSync("README.md")) targets.push("README.md");
  if (fs.existsSync("docs")) targets.push("docs");
  if (fs.existsSync("client/src")) targets.push("client/src");
  if (fs.existsSync("server/src")) targets.push("server/src");
  return targets;
}

function shouldScan(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return [".md", ".mdx", ".txt", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"].includes(ext);
}

function lineAndColumn(text, offset) {
  const before = text.slice(0, offset);
  const lines = before.split(/\r\n|\n|\r/);
  return {
    line: lines.length,
    column: [...lines.at(-1)].length + 1,
  };
}

function preview(text, offset, length) {
  const start = Math.max(0, offset - 24);
  const end = Math.min(text.length, offset + length + 24);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export function scanText(text) {
  const findings = [];
  for (const pattern of MOJIBAKE_PATTERNS) {
    pattern.regex.lastIndex = 0;
    for (const match of text.matchAll(pattern.regex)) {
      const where = lineAndColumn(text, match.index ?? 0);
      findings.push({
        pattern: pattern.name,
        reason: pattern.reason,
        line: where.line,
        column: where.column,
        match: match[0],
        preview: preview(text, match.index ?? 0, match[0].length),
      });
    }
  }
  return findings;
}

export function scanFile(filePath) {
  const bytes = fs.readFileSync(filePath);
  let text;
  try {
    text = decoder.decode(bytes);
  } catch (error) {
    return [{
      pattern: "invalid-utf8",
      reason: `File is not valid UTF-8: ${error.message}`,
      line: 1,
      column: 1,
      match: "",
      preview: "",
    }];
  }
  return scanText(text);
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usage());
    return 0;
  }

  const targets = args.length ? args : defaultTargets();
  const files = [...new Set(targets.flatMap(walkFiles).filter(shouldScan))].sort();
  if (files.length === 0) {
    console.error("No Markdown/text files found to scan.");
    return 2;
  }

  let totalFindings = 0;
  for (const file of files) {
    const findings = scanFile(file);
    if (findings.length === 0) continue;

    totalFindings += findings.length;
    const relative = path.relative(process.cwd(), file) || file;
    for (const finding of findings) {
      console.log(`${relative}:${finding.line}:${finding.column} ${finding.pattern}: ${finding.reason}`);
      if (finding.preview) console.log(`  ${finding.preview}`);
    }
  }

  if (totalFindings > 0) {
    console.error(`Mojibake scan failed: ${totalFindings} finding(s).`);
    return 1;
  }

  console.log(`Mojibake scan passed: ${files.length} file(s) checked.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
