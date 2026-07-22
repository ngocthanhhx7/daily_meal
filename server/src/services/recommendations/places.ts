import { env } from "../../config/env.js";
import type { NearbyRestaurant } from "./types.js";

type FindNearbyRestaurantsInput = {
  latitude: number;
  longitude: number;
  cuisines?: string[];
  limit?: number;
};

type GeoapifyFeature = {
  properties?: Record<string, unknown>;
  geometry?: { coordinates?: unknown };
};

type CachedRestaurant = Omit<NearbyRestaurant, "matchReason">;
type PlaceCacheEntry = { expiresAt: number; value: CachedRestaurant[] };

const placesCache = new Map<string, PlaceCacheEntry>();
const GEOAPIFY_TIMEOUT_MS = 5_000;
const PLACES_CACHE_MS = 10 * 60_000;
const GEOAPIFY_CATEGORIES = [
  "catering.restaurant",
  "catering.restaurant.vietnamese",
  "catering.restaurant.vegetarian",
  "catering.fast_food"
].join(",");

function roundedCoordinate(value: number) {
  return Math.round(value * 1000) / 1000;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function number(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function mapUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

function categoryCuisine(categories: string[]) {
  const category = categories.find((item) => item.startsWith("catering.restaurant."));
  return category?.split(".").at(-1)?.replace(/_/g, " ");
}

function mapFeature(feature: GeoapifyFeature): CachedRestaurant | undefined {
  const properties = feature.properties ?? {};
  const coordinates = Array.isArray(feature.geometry?.coordinates) ? feature.geometry?.coordinates : [];
  const longitude = number(coordinates[0] ?? properties.lon);
  const latitude = number(coordinates[1] ?? properties.lat);
  const name = text(properties.name) || text(properties.address_line1);
  if (!name || latitude === undefined || longitude === undefined) return undefined;

  const categories = stringArray(properties.categories);
  const cuisine = text(properties.cuisine) || categoryCuisine(categories) || undefined;
  const address = text(properties.formatted) || text(properties.address_line2) || "Chưa có địa chỉ";
  const placeId = text(properties.place_id) || `${latitude}:${longitude}:${name.toLowerCase()}`;

  return {
    key: `geoapify:${placeId}`,
    name,
    address,
    distanceMeters: number(properties.distance),
    latitude,
    longitude,
    categories,
    cuisine,
    openingHours: text(properties.opening_hours) || undefined,
    website: text(properties.website) || undefined,
    phone: text(properties.contact_phone) || text(properties["contact:phone"]) || undefined,
    mapUrl: mapUrl(latitude, longitude)
  };
}

function normalizeCuisines(cuisines: string[] | undefined) {
  return (cuisines ?? []).map((cuisine) => cuisine.trim()).filter(Boolean);
}

function matchReason(restaurant: CachedRestaurant, cuisines: string[]) {
  if (!cuisines.length) return "Nhà hàng gần vị trí của bạn";
  const searchable = [restaurant.cuisine, ...restaurant.categories, restaurant.name]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("vi");
  const matchedCuisine = cuisines.find((cuisine) => searchable.includes(cuisine.toLocaleLowerCase("vi")));
  return matchedCuisine
    ? `Phù hợp với ẩm thực ${matchedCuisine} bạn quan tâm`
    : "Nhà hàng gần vị trí của bạn";
}

async function loadNearbyRestaurants(latitude: number, longitude: number): Promise<CachedRestaurant[]> {
  const cacheKey = `${latitude}:${longitude}`;
  const cached = placesCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEOAPIFY_TIMEOUT_MS);
  try {
    const query = new URLSearchParams({
      categories: GEOAPIFY_CATEGORIES,
      filter: `circle:${longitude},${latitude},5000`,
      bias: `proximity:${longitude},${latitude}`,
      limit: "20",
      apiKey: env.GEOAPIFY_API_KEY ?? ""
    });
    const response = await fetch(`https://api.geoapify.com/v2/places?${query.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error(`Geoapify provider returned ${response.status}`);

    const payload = (await response.json()) as { features?: GeoapifyFeature[] };
    const value = (payload.features ?? []).map(mapFeature).filter((item): item is CachedRestaurant => Boolean(item));
    placesCache.set(cacheKey, { value, expiresAt: Date.now() + PLACES_CACHE_MS });
    return value;
  } finally {
    clearTimeout(timeout);
  }
}

export async function findNearbyRestaurants({
  latitude,
  longitude,
  cuisines,
  limit = 5
}: FindNearbyRestaurantsInput): Promise<NearbyRestaurant[]> {
  if (!env.GEOAPIFY_API_KEY || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];

  const roundedLatitude = roundedCoordinate(latitude);
  const roundedLongitude = roundedCoordinate(longitude);
  const requestedCuisines = normalizeCuisines(cuisines);
  const maximum = Math.max(1, Math.min(Math.trunc(limit) || 5, 20));

  const restaurants = await loadNearbyRestaurants(roundedLatitude, roundedLongitude);
  return restaurants
    .slice(0, maximum)
    .map((restaurant) => ({ ...restaurant, matchReason: matchReason(restaurant, requestedCuisines) }));
}
