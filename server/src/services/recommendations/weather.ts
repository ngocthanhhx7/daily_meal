import { env } from "../../config/env.js";
import type { WeatherContext } from "./types.js";

type WeatherCacheEntry = { expiresAt: number; value: WeatherContext };
const weatherCache = new Map<string, WeatherCacheEntry>();
const WEATHER_TIMEOUT_MS = 5_000;

function roundedCoordinate(value: number) {
  return Math.round(value * 1000) / 1000;
}

function weatherCondition(symbolCode: string | undefined, precipitationMm: number) {
  const code = symbolCode ?? "";
  if (precipitationMm > 0 || /rain|sleet|snow|thunder/.test(code)) return "Mưa";
  if (/cloud/.test(code)) return "Nhiều mây";
  if (/clear|fair/.test(code)) return "Trời quang";
  return "Thời tiết ổn định";
}

export async function getWeatherContext(latitude: number, longitude: number): Promise<WeatherContext> {
  const lat = roundedCoordinate(latitude);
  const lon = roundedCoordinate(longitude);
  const cacheKey = `${lat}:${lon}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEATHER_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`,
      {
        signal: controller.signal,
        headers: {
          "User-Agent": env.WEATHER_USER_AGENT,
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Weather provider returned ${response.status}`);
    }

    const payload = (await response.json()) as any;
    const first = payload?.properties?.timeseries?.[0];
    const details = first?.data?.instant?.details ?? {};
    const nextHour = first?.data?.next_1_hours ?? first?.data?.next_6_hours ?? {};
    const temperature = Number(details.air_temperature);
    if (!Number.isFinite(temperature)) {
      throw new Error("Weather provider response is missing temperature");
    }

    const precipitationMm = Number(nextHour?.details?.precipitation_amount ?? 0);
    const symbolCode = nextHour?.summary?.symbol_code as string | undefined;
    const value: WeatherContext = {
      temperature: Math.round(temperature * 10) / 10,
      condition: weatherCondition(symbolCode, precipitationMm),
      symbolCode,
      precipitationMm,
      isHot: temperature >= 29,
      isCold: temperature <= 21,
      isRainy: precipitationMm > 0 || /rain|sleet|snow|thunder/.test(symbolCode ?? ""),
      fetchedAt: new Date().toISOString()
    };

    const expiresHeader = response.headers.get("expires");
    const providerExpiry = expiresHeader ? Date.parse(expiresHeader) : Number.NaN;
    const expiresAt = Number.isFinite(providerExpiry)
      ? Math.max(Date.now() + 60_000, providerExpiry)
      : Date.now() + 15 * 60_000;
    weatherCache.set(cacheKey, { expiresAt, value });
    return value;
  } finally {
    clearTimeout(timeout);
  }
}
