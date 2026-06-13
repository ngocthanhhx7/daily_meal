#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scanFile, scanText } from "./scan-mojibake.mjs";

const validVietnamese = [
  "# Báo cáo đo lường Daily Meal",
  "",
  "Ứng dụng mạng xã hội hình ảnh về đồ ăn, có bình luận, công thức và thông báo.",
  "Không được nhầm các ký tự tiếng Việt như ă, â, đ, ê, ô, ơ, ư, ờ, ệ là mojibake.",
].join("\n");

assert.equal(scanText(validVietnamese).length, 0, "valid Vietnamese Markdown should pass");

const mojibakeSamples = [
  Buffer.from("# Báo cáo đo lường", "utf8").toString("latin1"),
  [
    "Quotes look like ",
    "\u00e2\u20ac\u015c",
    "this",
    "\u00e2\u20ac\u009d",
    " and apostrophes like ",
    "\u00e2\u20ac\u2122",
    ".",
  ].join(""),
  "A replacement character here: \uFFFD",
].join("\n");

const findings = scanText(mojibakeSamples);
const findingPatterns = new Set(findings.map((finding) => finding.pattern));
assert.ok(findingPatterns.has("utf8-read-as-cp1252-vietnamese"), "Vietnamese mojibake should be flagged");
assert.ok(findingPatterns.has("smart-punctuation-mojibake"), "smart punctuation mojibake should be flagged");
assert.ok(findingPatterns.has("stray-c1-control"), "stray C1 control characters should be flagged");
assert.ok(findingPatterns.has("replacement-character"), "replacement characters should be flagged");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "daily-meal-mojibake-"));
const invalidFile = path.join(tmpDir, "invalid.md");
fs.writeFileSync(invalidFile, Buffer.from([0xff, 0xfe, 0xfd]));

const invalidFindings = scanFile(invalidFile);
assert.equal(invalidFindings[0]?.pattern, "invalid-utf8", "invalid UTF-8 bytes should be flagged");

fs.rmSync(tmpDir, { recursive: true, force: true });

console.log("Mojibake scanner tests passed.");
