import type { RequestHandler } from "express";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

function getClientIp(req: any): string {
  const forwarded = req.headers["x-forwarded-for"] as string | undefined;
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

export function rateLimiter(opts: {
  windowMs: number;
  max: number;
  message?: string;
}): RequestHandler {
  const { windowMs, max, message = "Quá nhiều yêu cầu. Vui lòng thử lại sau." } = opts;

  // Use a stable key so the store survives hot-reloads in dev
  const storeKey = `${windowMs}:${max}`;
  if (!stores.has(storeKey)) {
    stores.set(storeKey, new Map());
  }
  const store = stores.get(storeKey)!;

  // Periodically clean up expired entries
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  }, Math.min(windowMs, 60_000)).unref();

  return (req, res, next) => {
    const ip = getClientIp(req);
    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || entry.resetAt <= now) {
      store.set(ip, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    entry.count += 1;

    if (entry.count > max) {
      res.status(429).json({ message });
      return;
    }

    next();
  };
}
