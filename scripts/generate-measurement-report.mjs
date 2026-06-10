#!/usr/bin/env node
import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { gzipSync } from "node:zlib";

const DEFAULT_WEB_URL = "https://dailymeal.site/";
const DEFAULT_API_URL = "https://api.dailymeal.site/";
const SECRET_KEY_PATTERN = /token|secret|password|authorization|cookie|apikey|api_key|access[_-]?key|bearer/i;

function parseArgs(argv) {
  const options = {
    webUrl: process.env.DAILY_MEAL_WEB_URL || DEFAULT_WEB_URL,
    apiUrl: process.env.DAILY_MEAL_API_URL || DEFAULT_API_URL,
    runs: Number(process.env.MEASUREMENT_RUNS || 5),
    lighthouseRuns: Number(process.env.LIGHTHOUSE_RUNS || 3),
    output: "",
    tokenEnv: process.env.DAILY_MEAL_API_TOKEN_ENV || "DAILY_MEAL_API_TOKEN",
    analyticsUrl: process.env.DAILY_MEAL_ANALYTICS_URL || "",
    analyticsTokenEnv: process.env.DAILY_MEAL_ANALYTICS_TOKEN_ENV || "DAILY_MEAL_ANALYTICS_TOKEN",
    assetDir: process.env.MEASUREMENT_ASSET_DIR || path.join("client", "dist"),
    timeoutMs: Number(process.env.MEASUREMENT_TIMEOUT_MS || 15000),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[++index];
    if (arg === "--web-url") options.webUrl = next();
    else if (arg === "--api-url") options.apiUrl = next();
    else if (arg === "--runs") options.runs = Number(next());
    else if (arg === "--lighthouse-runs") options.lighthouseRuns = Number(next());
    else if (arg === "--output") options.output = next();
    else if (arg === "--api-token-env") options.tokenEnv = next();
    else if (arg === "--api-token") options.apiToken = next();
    else if (arg === "--analytics-url") options.analyticsUrl = next();
    else if (arg === "--analytics-token-env") options.analyticsTokenEnv = next();
    else if (arg === "--analytics-token") options.analyticsToken = next();
    else if (arg === "--asset-dir") options.assetDir = next();
    else if (arg === "--timeout-ms") options.timeoutMs = Number(next());
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(options.runs) || options.runs < 1) options.runs = 5;
  if (!Number.isFinite(options.lighthouseRuns) || options.lighthouseRuns < 0) options.lighthouseRuns = 3;
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1000) options.timeoutMs = 15000;
  return options;
}

function usage() {
  return [
    "Usage: node scripts/generate-measurement-report.mjs [options]",
    "",
    "Options:",
    "  --web-url <url>                 Web/PWA URL to measure",
    "  --api-url <url>                 API base URL to measure",
    "  --runs <n>                      HTTP timing attempts per target",
    "  --lighthouse-runs <n>           Lighthouse attempts; median is reported when available",
    "  --output <file>                 Write Markdown report to a file instead of stdout",
    "  --api-token-env <name>          Env var containing bearer token for authenticated API probes",
    "  --api-token <token>             Bearer token; accepted but never printed",
    "  --analytics-url <url>           Optional analytics summary endpoint",
    "  --analytics-token-env <name>    Env var containing analytics bearer token",
    "  --analytics-token <token>       Analytics bearer token; accepted but never printed",
    "  --asset-dir <dir>               Local static asset directory, default client/dist",
  ].join("\n");
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

function average(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function bytes(value) {
  if (value == null) return "Unavailable";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / 1024 / 1024).toFixed(2)} MiB`;
}

function ms(value) {
  if (value == null) return "Unavailable";
  return `${Math.round(value)} ms`;
}

function sanitizeUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (SECRET_KEY_PATTERN.test(key)) url.searchParams.set(key, "REDACTED");
    }
    return url.toString();
  } catch {
    return value.replace(/(token|secret|password|api[_-]?key)=([^&\s]+)/gi, "$1=REDACTED");
  }
}

function statusLabel(summary) {
  if (!summary || summary.attempts === 0) return "Unavailable";
  if (summary.errorRate > 0) return "Partially measured";
  return "Measured";
}

async function timedFetch(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const arrayBuffer = await response.arrayBuffer();
    const body = Buffer.from(arrayBuffer);
    const durationMs = performance.now() - start;
    return {
      ok: response.ok,
      status: response.status,
      durationMs,
      sizeBytes: body.byteLength,
      bodyText: body.toString("utf8"),
      headers: Object.fromEntries(response.headers.entries()),
    };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      durationMs: performance.now() - start,
      error: error.name === "AbortError" ? "timeout" : error.message,
      sizeBytes: 0,
      bodyText: "",
      headers: {},
    };
  } finally {
    clearTimeout(timeout);
  }
}

function summarizeAttempts(attempts) {
  const durations = attempts.map((attempt) => attempt.durationMs).filter(Number.isFinite);
  const successes = attempts.filter((attempt) => attempt.ok).length;
  const statusCounts = new Map();
  for (const attempt of attempts) {
    statusCounts.set(attempt.status, (statusCounts.get(attempt.status) || 0) + 1);
  }
  return {
    attempts: attempts.length,
    successes,
    errorRate: attempts.length ? (attempts.length - successes) / attempts.length : 1,
    min: durations.length ? Math.min(...durations) : null,
    avg: average(durations),
    p95: percentile(durations, 95),
    max: durations.length ? Math.max(...durations) : null,
    statuses: [...statusCounts.entries()].map(([status, count]) => `${status} x${count}`).join(", "),
    lastHeaders: attempts.at(-1)?.headers || {},
    lastSizeBytes: attempts.at(-1)?.sizeBytes ?? null,
  };
}

async function measureUrl(label, url, runs, headers, timeoutMs) {
  const attempts = [];
  for (let index = 0; index < runs; index += 1) {
    attempts.push(await timedFetch(url, { headers }, timeoutMs));
  }
  return { label, url: sanitizeUrl(url), ...summarizeAttempts(attempts) };
}

function extractAssets(html, baseUrl) {
  const assets = new Set();
  const patterns = [
    /\bsrc=["']([^"']+)["']/gi,
    /\bhref=["']([^"']+)["']/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const raw = match[1];
      if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) continue;
      try {
        assets.add(new URL(raw, baseUrl).toString());
      } catch {
        // Ignore malformed asset references.
      }
    }
  }
  return [...assets];
}

async function measureDiscoveredAssets(webUrl, timeoutMs) {
  const root = await timedFetch(webUrl, {}, timeoutMs);
  const html = root.ok ? root.bodyText : "";
  const assetUrls = extractAssets(html, webUrl).slice(0, 30);
  const assets = [];
  for (const assetUrl of assetUrls) {
    const measurement = await timedFetch(assetUrl, {}, timeoutMs);
    assets.push({
      url: sanitizeUrl(assetUrl),
      status: measurement.status,
      transferBytes: measurement.sizeBytes,
      cacheControl: measurement.headers["cache-control"] || "",
      contentType: measurement.headers["content-type"] || "",
      durationMs: measurement.durationMs,
    });
  }
  return { root, assets };
}

function walkLocalAssets(rootDir) {
  const absolute = path.resolve(rootDir);
  if (!fs.existsSync(absolute)) return { available: false, rootDir, files: [], totalBytes: 0, totalGzipBytes: 0 };

  const files = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else if (entry.isFile()) {
        const buffer = fs.readFileSync(fullPath);
        files.push({
          path: path.relative(absolute, fullPath).replace(/\\/g, "/"),
          bytes: buffer.byteLength,
          gzipBytes: gzipSync(buffer).byteLength,
        });
      }
    }
  };
  visit(absolute);

  return {
    available: true,
    rootDir,
    files: files.sort((a, b) => b.bytes - a.bytes),
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    totalGzipBytes: files.reduce((sum, file) => sum + file.gzipBytes, 0),
  };
}

function findLighthouseCommand() {
  const local = process.platform === "win32"
    ? path.join("node_modules", ".bin", "lighthouse.cmd")
    : path.join("node_modules", ".bin", "lighthouse");
  const candidates = [
    { command: local, argsPrefix: [] },
    { command: "lighthouse", argsPrefix: [] },
    { command: "npx", argsPrefix: ["--no-install", "lighthouse"] },
  ];
  for (const candidate of candidates) {
    const result = childProcess.spawnSync(candidate.command, [...candidate.argsPrefix, "--version"], {
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    if (result.status === 0) return candidate;
  }
  return "";
}

function runLighthouse(webUrl, runs) {
  if (runs === 0) return { available: false, reason: "Disabled by --lighthouse-runs 0", runs: [] };
  const lighthouseCommand = findLighthouseCommand();
  if (!lighthouseCommand) return { available: false, reason: "Lighthouse binary not found locally, on PATH, or via npx --no-install.", runs: [] };

  const reports = [];
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "daily-meal-lh-"));
  try {
    for (let index = 0; index < runs; index += 1) {
      const output = path.join(tempDir, `lighthouse-${index}.json`);
      const args = [
        ...lighthouseCommand.argsPrefix,
        webUrl,
        "--quiet",
        "--output=json",
        `--output-path=${output}`,
        "--chrome-flags=--headless=new --no-sandbox",
      ];
      const result = childProcess.spawnSync(lighthouseCommand.command, args, {
        encoding: "utf8",
        shell: process.platform === "win32",
        timeout: 180000,
      });
      if (result.status !== 0 || !fs.existsSync(output)) {
        reports.push({ ok: false, error: (result.stderr || result.stdout || "Lighthouse failed").trim().slice(0, 500) });
        continue;
      }
      const json = JSON.parse(fs.readFileSync(output, "utf8"));
      reports.push({
        ok: true,
        performance: Math.round((json.categories.performance?.score ?? 0) * 100),
        accessibility: Math.round((json.categories.accessibility?.score ?? 0) * 100),
        bestPractices: Math.round((json.categories["best-practices"]?.score ?? 0) * 100),
        seo: Math.round((json.categories.seo?.score ?? 0) * 100),
        fcp: json.audits["first-contentful-paint"]?.numericValue,
        lcp: json.audits["largest-contentful-paint"]?.numericValue,
        tbt: json.audits["total-blocking-time"]?.numericValue,
        cls: json.audits["cumulative-layout-shift"]?.numericValue,
        speedIndex: json.audits["speed-index"]?.numericValue,
        totalByteWeight: json.audits["total-byte-weight"]?.numericValue,
      });
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  const successful = reports.filter((report) => report.ok);
  const median = {};
  for (const key of ["performance", "accessibility", "bestPractices", "seo", "fcp", "lcp", "tbt", "cls", "speedIndex", "totalByteWeight"]) {
    const values = successful.map((report) => report[key]).filter((value) => Number.isFinite(value));
    median[key] = percentile(values, 50);
  }

  return {
    available: successful.length > 0,
    command: [lighthouseCommand.command, ...lighthouseCommand.argsPrefix].join(" "),
    runs: reports,
    median,
  };
}

function flattenAnalytics(value, prefix = "", out = []) {
  if (out.length >= 40 || value == null) return out;
  if (typeof value !== "object") {
    const key = prefix || "value";
    if (!SECRET_KEY_PATTERN.test(key)) out.push({ key, value });
    return out;
  }
  if (Array.isArray(value)) {
    out.push({ key: prefix || "items", value: `${value.length} item(s)` });
    if (value.length > 0 && typeof value[0] === "object") flattenAnalytics(value[0], `${prefix || "items"}[0]`, out);
    return out;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key)) continue;
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (typeof nested === "object" && nested != null) flattenAnalytics(nested, nextPrefix, out);
    else out.push({ key: nextPrefix, value: nested });
    if (out.length >= 40) break;
  }
  return out;
}

async function fetchAnalytics(options) {
  if (!options.analyticsUrl) return { available: false, reason: "No analytics URL provided." };
  const token = options.analyticsToken || process.env[options.analyticsTokenEnv] || "";
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await timedFetch(options.analyticsUrl, { headers }, options.timeoutMs);
  if (!response.ok) {
    return {
      available: false,
      reason: `Analytics request returned ${response.status}.`,
      url: sanitizeUrl(options.analyticsUrl),
      tokenProvided: Boolean(token),
    };
  }
  let payload;
  try {
    payload = JSON.parse(response.bodyText);
  } catch {
    return {
      available: false,
      reason: "Analytics response was not valid JSON.",
      url: sanitizeUrl(options.analyticsUrl),
      tokenProvided: Boolean(token),
    };
  }
  return {
    available: true,
    url: sanitizeUrl(options.analyticsUrl),
    tokenProvided: Boolean(token),
    metrics: flattenAnalytics(payload),
  };
}

function markdownTable(headers, rows) {
  const header = `| ${headers.join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\n/g, " ")).join(" | ")} |`);
  return [header, divider, ...body].join("\n");
}

function renderReport({ options, webSummary, apiSummaries, remoteAssets, localAssets, lighthouse, analytics }) {
  const generatedAt = new Date().toISOString();
  const runId = crypto.createHash("sha256")
    .update(`${generatedAt}:${options.webUrl}:${options.apiUrl}`)
    .digest("hex")
    .slice(0, 10);

  const lines = [
    "# Daily Meal Measurement Run",
    "",
    `Generated: ${generatedAt}`,
    `Run ID: ${runId}`,
    "",
    "## Data Availability",
    "",
    markdownTable(
      ["Area", "Status", "Evidence"],
      [
        ["Web timing", statusLabel(webSummary), `${webSummary.attempts} request(s) to ${webSummary.url}`],
        ["API timing", apiSummaries.length ? "Measured" : "Unavailable", `${apiSummaries.length} endpoint group(s)`],
        ["Lighthouse median", lighthouse.available ? "Measured" : "Unavailable", lighthouse.available ? `${lighthouse.runs.filter((run) => run.ok).length}/${lighthouse.runs.length} run(s)` : lighthouse.reason],
        ["Bundle/static assets", localAssets.available || remoteAssets.assets.length ? "Measured" : "Unavailable", localAssets.available ? options.assetDir : `${remoteAssets.assets.length} remote asset(s)`],
        ["Analytics", analytics.available ? "Measured" : "Unavailable", analytics.available ? sanitizeUrl(options.analyticsUrl) : analytics.reason],
      ],
    ),
    "",
    "## Web Timing",
    "",
    markdownTable(
      ["Target", "Status", "Success", "Avg", "P95", "Max", "Bytes", "Cache"],
      [[
        webSummary.url,
        webSummary.statuses,
        `${webSummary.successes}/${webSummary.attempts}`,
        ms(webSummary.avg),
        ms(webSummary.p95),
        ms(webSummary.max),
        bytes(webSummary.lastSizeBytes),
        webSummary.lastHeaders["cache-control"] || "",
      ]],
    ),
    "",
    "## API Timing",
    "",
    markdownTable(
      ["Endpoint", "Status", "Success", "Avg", "P95", "Max"],
      apiSummaries.map((summary) => [
        summary.url,
        summary.statuses,
        `${summary.successes}/${summary.attempts}`,
        ms(summary.avg),
        ms(summary.p95),
        ms(summary.max),
      ]),
    ),
    "",
    "## Lighthouse Median",
    "",
    lighthouse.available
      ? markdownTable(
          ["Metric", "Median"],
          [
            ["Performance", lighthouse.median.performance],
            ["Accessibility", lighthouse.median.accessibility],
            ["Best Practices", lighthouse.median.bestPractices],
            ["SEO", lighthouse.median.seo],
            ["FCP", ms(lighthouse.median.fcp)],
            ["LCP", ms(lighthouse.median.lcp)],
            ["TBT", ms(lighthouse.median.tbt)],
            ["CLS", lighthouse.median.cls],
            ["Speed Index", ms(lighthouse.median.speedIndex)],
            ["Total byte weight", bytes(lighthouse.median.totalByteWeight)],
          ],
        )
      : `Unavailable: ${lighthouse.reason}`,
    "",
    "## Static Assets",
    "",
    localAssets.available
      ? [
          `Local directory: \`${options.assetDir}\``,
          `Total size: ${bytes(localAssets.totalBytes)} raw, ${bytes(localAssets.totalGzipBytes)} gzip-estimated.`,
          "",
          markdownTable(
            ["File", "Raw", "Gzip"],
            localAssets.files.slice(0, 15).map((file) => [file.path, bytes(file.bytes), bytes(file.gzipBytes)]),
          ),
        ].join("\n")
      : `Local directory unavailable: \`${options.assetDir}\``,
    "",
    "### Remote Discovered Assets",
    "",
    remoteAssets.assets.length
      ? markdownTable(
          ["Asset", "Status", "Transfer", "Duration", "Cache"],
          remoteAssets.assets.slice(0, 15).map((asset) => [
            asset.url,
            asset.status,
            bytes(asset.transferBytes),
            ms(asset.durationMs),
            asset.cacheControl,
          ]),
        )
      : "No remote assets discovered from the web shell.",
    "",
    "## Analytics Summary",
    "",
    analytics.available
      ? [
          `Source: ${sanitizeUrl(options.analyticsUrl)}`,
          `Token provided: ${analytics.tokenProvided ? "yes, redacted" : "no"}`,
          "",
          markdownTable(["Metric", "Value"], analytics.metrics.map((metric) => [metric.key, metric.value])),
        ].join("\n")
      : `Unavailable: ${analytics.reason}`,
    "",
    "## Secret Handling",
    "",
    "Bearer tokens and sensitive query parameters are redacted. This report records whether a token was provided, but never prints token values.",
    "",
  ];

  return lines.join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return 0;
  }

  const apiToken = options.apiToken || process.env[options.tokenEnv] || "";
  const authHeaders = apiToken ? { Authorization: `Bearer ${apiToken}` } : {};

  const webSummary = await measureUrl("web root", options.webUrl, options.runs, {}, options.timeoutMs);
  const remoteAssets = await measureDiscoveredAssets(options.webUrl, options.timeoutMs);

  const apiEndpoints = [
    { label: "health", path: "/health", headers: {} },
    { label: "premium plans", path: "/api/payments/premium/plans", headers: {} },
  ];
  if (apiToken) {
    apiEndpoints.push(
      { label: "auth me", path: "/api/auth/me", headers: authHeaders },
      { label: "feed", path: "/api/posts/feed", headers: authHeaders },
      { label: "notifications", path: "/api/notifications", headers: authHeaders },
    );
  }

  const apiSummaries = [];
  for (const endpoint of apiEndpoints) {
    const url = new URL(endpoint.path, options.apiUrl).toString();
    apiSummaries.push(await measureUrl(endpoint.label, url, options.runs, endpoint.headers, options.timeoutMs));
  }

  const localAssets = walkLocalAssets(options.assetDir);
  const lighthouse = runLighthouse(options.webUrl, options.lighthouseRuns);
  const analytics = await fetchAnalytics(options);
  const report = renderReport({ options, webSummary, apiSummaries, remoteAssets, localAssets, lighthouse, analytics });

  if (options.output) {
    fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
    fs.writeFileSync(options.output, report, "utf8");
    console.log(`Measurement report written to ${options.output}`);
  } else {
    console.log(report);
  }
  return 0;
}

main().then((code) => {
  process.exitCode = code;
}).catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
