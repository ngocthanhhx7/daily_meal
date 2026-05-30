import React, { useEffect } from "react";
import { Platform } from "react-native";

function upsertMeta(name: string, content: string) {
  const existing = document.querySelector(`meta[name="${name}"]`);
  const element = existing ?? document.createElement("meta");
  element.setAttribute("name", name);
  element.setAttribute("content", content);
  if (!existing) {
    document.head.appendChild(element);
  }
}

function upsertLink(rel: string, href: string, attrs: Record<string, string> = {}) {
  const existing = document.querySelector(`link[rel="${rel}"][href="${href}"]`);
  const element = existing ?? document.createElement("link");
  element.setAttribute("rel", rel);
  element.setAttribute("href", href);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  if (!existing) {
    document.head.appendChild(element);
  }
}

export function PwaRuntime() {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      return;
    }

    document.title = "Daily Meal";
    upsertMeta("theme-color", "#F4F3EF");
    upsertMeta("apple-mobile-web-app-capable", "yes");
    upsertMeta("apple-mobile-web-app-title", "Daily Meal");
    upsertMeta("apple-mobile-web-app-status-bar-style", "default");
    upsertMeta("mobile-web-app-capable", "yes");
    upsertLink("manifest", "/manifest.json");
    upsertLink("apple-touch-icon", "/icons/daily-meal-icon.png");
    upsertLink("icon", "/favicon.png", { type: "image/png" });

    if ("serviceWorker" in navigator && window.location.protocol === "https:") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failure should not block the app.
      });
    }
  }, []);

  return null;
}
