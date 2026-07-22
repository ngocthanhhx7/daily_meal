import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../../config/env.js";
import { findNearbyRestaurants } from "./places.js";

const originalApiKey = env.GEOAPIFY_API_KEY;

describe("findNearbyRestaurants", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.assign(env, { GEOAPIFY_API_KEY: originalApiKey });
  });

  it("maps Geoapify places into nearby restaurants", async () => {
    Object.assign(env, { GEOAPIFY_API_KEY: "geo-key" });
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const query = new URL(String(url)).searchParams;
      expect(query.get("categories")).toContain("catering.restaurant.vietnamese");
      expect(query.get("filter")).toBe("circle:106.7,10.776,5000");
      return new Response(
        JSON.stringify({
          features: [
            {
              properties: {
                place_id: "restaurant-1",
                name: "Quán chay An Nhiên",
                formatted: "1 Đường Hoa, Quận 1, TP.HCM",
                distance: 241,
                categories: ["catering.restaurant", "catering.restaurant.vegetarian"],
                cuisine: "vegetarian",
                opening_hours: "Mo-Su 08:00-22:00",
                website: "https://example.test",
                "contact:phone": "+84 90 000 0000"
              },
              geometry: { coordinates: [106.7002, 10.7763] }
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const restaurants = await findNearbyRestaurants({
      latitude: 10.7762,
      longitude: 106.7001,
      cuisines: ["vegetarian"],
      limit: 3
    });

    expect(restaurants).toEqual([
      expect.objectContaining({
        key: "geoapify:restaurant-1",
        name: "Quán chay An Nhiên",
        address: "1 Đường Hoa, Quận 1, TP.HCM",
        distanceMeters: 241,
        cuisine: "vegetarian",
        openingHours: "Mo-Su 08:00-22:00",
        phone: "+84 90 000 0000",
        matchReason: "Phù hợp với ẩm thực vegetarian bạn quan tâm"
      })
    ]);
    expect(restaurants[0]?.mapUrl).toContain("google.com/maps/search");
  });

  it("returns no places without a Geoapify key", async () => {
    Object.assign(env, { GEOAPIFY_API_KEY: undefined });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(findNearbyRestaurants({ latitude: 10.71, longitude: 106.61 })).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces Geoapify failures so the engine can mark degraded results", async () => {
    Object.assign(env, { GEOAPIFY_API_KEY: "geo-key" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));

    await expect(findNearbyRestaurants({ latitude: 10.72, longitude: 106.62 })).rejects.toThrow(
      "Geoapify provider returned 503"
    );
  });

  it("caches provider results by rounded coordinates", async () => {
    Object.assign(env, { GEOAPIFY_API_KEY: "geo-key" });
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          features: [
            {
              properties: { place_id: "cached", name: "Cơm nhà", formatted: "Quận 3" },
              geometry: { coordinates: [106.681, 10.781] }
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await findNearbyRestaurants({ latitude: 10.7806, longitude: 106.6806 });
    await findNearbyRestaurants({ latitude: 10.7809, longitude: 106.6809 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
