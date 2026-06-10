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
  "# BÃ¡o cÃ¡o Ä‘o lÆ°á»ng",
  "Quotes look like â€œthisâ€\u009d and apostrophes like â€™.",
  "A replacement character here: \uFFFD",
].join("\n");

const findings = scanText(mojibakeSamples);
assert.ok(findings.length >= 3, "common mojibake sequences should be flagged");
assert.ok(findings.some((finding) => finding.pattern === "replacement-character"));

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "daily-meal-mojibake-"));
const invalidFile = path.join(tmpDir, "invalid.md");
fs.writeFileSync(invalidFile, Buffer.from([0xff, 0xfe, 0xfd]));

const invalidFindings = scanFile(invalidFile);
assert.equal(invalidFindings[0]?.pattern, "invalid-utf8", "invalid UTF-8 bytes should be flagged");

fs.rmSync(tmpDir, { recursive: true, force: true });

console.log("Mojibake scanner tests passed.");
