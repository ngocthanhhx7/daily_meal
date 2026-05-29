# iOS PWA Install Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve Daily Meal as an iOS-installable PWA at `https://ngocthanhhx7.site/` with a GeForce NOW-style iOS Safari install gate.

**Architecture:** Keep the existing Expo React Native client as the single app. Add a web-only PWA runtime that injects metadata/registers the service worker, detects iOS Safari standalone state, and renders a blocking install gate before the existing auth/navigation providers. Deploy the exported static web build through the existing EC2/Nginx site while proxying `/api/*` to the Express API.

**Tech Stack:** Expo 54, React Native Web, TypeScript, Vitest for pure PWA detection tests, Express API behind Nginx, PM2 on EC2.

---

## File Structure

- Modify `client/package.json`: add web export and client test scripts, plus explicit Expo web dependencies if they are missing.
- Modify `client/app.json`: add Expo web metadata fields and point to PWA favicon.
- Create `client/src/pwa/platform.ts`: pure runtime detection helpers for web/iOS/Safari/standalone.
- Create `client/src/pwa/platform.test.ts`: unit tests for the detection helpers.
- Create `client/src/pwa/IosInstallGate.tsx`: the full-screen iOS installation instructions.
- Create `client/src/pwa/PwaRuntime.tsx`: web-only head metadata injection and service worker registration.
- Modify `client/App.tsx`: render `PwaRuntime`, then gate or existing app tree.
- Create `client/public/manifest.json`: install metadata for browsers.
- Create `client/public/sw.js`: minimal app-shell service worker that never caches `/api/*`.
- Create `client/public/browserconfig.xml`: harmless legacy metadata for Windows browsers.
- Copy `client/assets/stickers/custom-smile.png` to `client/public/icons/daily-meal-icon.png` and `client/public/favicon.png`.
- Modify `docs/ec2-deployment.md`: add web build and Nginx config for `https://ngocthanhhx7.site/`.

---

### Task 1: Web Build Scripts And Explicit Dependencies

**Files:**
- Modify: `client/package.json`

- [ ] **Step 1: Add scripts and dependencies**

Update the `scripts`, `dependencies`, and `devDependencies` sections in `client/package.json` to include:

```json
{
  "scripts": {
    "start": "expo start",
    "start:clean": "expo start -c",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web",
    "build:web": "expo export --platform web --output-dir dist",
    "test:pwa": "vitest run src/pwa/platform.test.ts",
    "build:apk": "npx eas-cli build -p android --profile preview",
    "build:apk:clean": "npx eas-cli build -p android --profile preview --clear-cache",
    "build:aab": "npx eas-cli build -p android --profile production",
    "build:aab:clean": "npx eas-cli build -p android --profile production --clear-cache",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@expo/metro-runtime": "~6.1.2",
    "react-dom": "19.1.0",
    "react-native-web": "~0.21.0"
  },
  "devDependencies": {
    "vitest": "^2.1.8"
  }
}
```

Keep all existing dependencies and scripts not shown above. Do not remove native build scripts.

- [ ] **Step 2: Install/update the workspace lockfile**

Run:

```powershell
npm.cmd install
```

Expected: `package-lock.json` updates without dependency resolution errors.

- [ ] **Step 3: Verify Expo export command exists**

Run:

```powershell
npm.cmd --workspace client exec expo export -- --help
```

Expected: output includes `Export the static files of the app for hosting it on a web server`.

- [ ] **Step 4: Commit**

```powershell
git add client/package.json package-lock.json
git commit -m "chore: add expo web build tooling"
```

---

### Task 2: PWA Platform Detection

**Files:**
- Create: `client/src/pwa/platform.ts`
- Create: `client/src/pwa/platform.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `client/src/pwa/platform.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getPwaEnvironment, shouldShowIosInstallGate } from "./platform";

const iphoneSafari =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const ipadSafari =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const iphoneInstagram =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 340.0.0";

const androidChrome =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

describe("getPwaEnvironment", () => {
  it("detects iPhone Safari outside standalone", () => {
    expect(getPwaEnvironment({ platform: "web", userAgent: iphoneSafari, standalone: false })).toMatchObject({
      isWeb: true,
      isIos: true,
      isSafari: true,
      isStandalone: false,
      isInstallCapableIosSafari: true
    });
  });

  it("detects iPadOS Safari outside standalone", () => {
    expect(getPwaEnvironment({ platform: "web", userAgent: ipadSafari, standalone: false, maxTouchPoints: 5 })).toMatchObject({
      isIos: true,
      isSafari: true,
      isInstallCapableIosSafari: true
    });
  });

  it("does not treat iOS in-app browsers as Safari", () => {
    expect(getPwaEnvironment({ platform: "web", userAgent: iphoneInstagram, standalone: false }).isSafari).toBe(false);
  });

  it("does not gate Android Chrome", () => {
    expect(shouldShowIosInstallGate({ platform: "web", userAgent: androidChrome, standalone: false })).toBe(false);
  });

  it("does not gate iOS standalone launch", () => {
    expect(shouldShowIosInstallGate({ platform: "web", userAgent: iphoneSafari, standalone: true })).toBe(false);
  });

  it("gates iOS Safari when not standalone", () => {
    expect(shouldShowIosInstallGate({ platform: "web", userAgent: iphoneSafari, standalone: false })).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm.cmd --workspace client run test:pwa
```

Expected: FAIL because `client/src/pwa/platform.ts` does not exist.

- [ ] **Step 3: Implement the detection helpers**

Create `client/src/pwa/platform.ts`:

```ts
import { Platform } from "react-native";

type PwaEnvironmentInput = {
  platform?: string;
  userAgent?: string;
  standalone?: boolean;
  maxTouchPoints?: number;
};

export type PwaEnvironment = {
  isWeb: boolean;
  isIos: boolean;
  isSafari: boolean;
  isStandalone: boolean;
  isInstallCapableIosSafari: boolean;
  isIosInAppBrowser: boolean;
};

function readNavigator() {
  if (typeof navigator === "undefined") {
    return { userAgent: "", maxTouchPoints: 0 };
  }

  return {
    userAgent: navigator.userAgent ?? "",
    maxTouchPoints: navigator.maxTouchPoints ?? 0
  };
}

function readStandalone() {
  if (typeof window === "undefined") {
    return false;
  }

  const mediaStandalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const navigatorStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

  return mediaStandalone || navigatorStandalone;
}

export function getPwaEnvironment(input: PwaEnvironmentInput = {}): PwaEnvironment {
  const nav = readNavigator();
  const platform = input.platform ?? Platform.OS;
  const userAgent = input.userAgent ?? nav.userAgent;
  const maxTouchPoints = input.maxTouchPoints ?? nav.maxTouchPoints;
  const standalone = input.standalone ?? readStandalone();

  const isWeb = platform === "web";
  const isIphoneOrIpod = /iPhone|iPod/i.test(userAgent);
  const isIpad = /iPad/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1 && /Mobile/i.test(userAgent));
  const isIos = isIphoneOrIpod || isIpad;
  const hasSafari = /Safari/i.test(userAgent);
  const hasSafariVersion = /Version\/[\d.]+/i.test(userAgent);
  const isExcludedIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|Instagram|FBAN|FBAV|Line|MicroMessenger/i.test(userAgent);
  const isSafari = hasSafari && hasSafariVersion && !isExcludedIosBrowser;

  return {
    isWeb,
    isIos,
    isSafari,
    isStandalone: standalone,
    isInstallCapableIosSafari: isWeb && isIos && isSafari,
    isIosInAppBrowser: isWeb && isIos && !isSafari
  };
}

export function shouldShowIosInstallGate(input: PwaEnvironmentInput = {}) {
  const environment = getPwaEnvironment(input);
  return environment.isInstallCapableIosSafari && !environment.isStandalone;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```powershell
npm.cmd --workspace client run test:pwa
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```powershell
git add client/src/pwa/platform.ts client/src/pwa/platform.test.ts client/package.json package-lock.json
git commit -m "test: add ios pwa environment detection"
```

---

### Task 3: iOS Install Gate UI

**Files:**
- Create: `client/src/pwa/IosInstallGate.tsx`

- [ ] **Step 1: Create the gate component**

Create `client/src/pwa/IosInstallGate.tsx`:

```tsx
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { getPwaEnvironment } from "./platform";

const steps = [
  { number: "1", title: "Nhấn nút Chia sẻ", detail: "Trong thanh công cụ Safari, chạm biểu tượng chia sẻ." },
  { number: "2", title: "Chọn Thêm vào Màn hình chính", detail: "Kéo danh sách hành động nếu bạn chưa thấy lựa chọn này." },
  { number: "3", title: "Mở Daily Meal từ icon mới", detail: "Sau khi thêm, quay về Home Screen và mở Daily Meal như một ứng dụng." }
];

export function IosInstallGate() {
  const environment = getPwaEnvironment();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      bounces={false}
    >
      <View style={styles.icon}>
        <Text style={styles.iconText}>DM</Text>
      </View>

      <Text style={styles.title}>Cài Daily Meal trên iPhone</Text>
      <Text style={styles.subtitle}>
        Để dùng Daily Meal toàn màn hình như ứng dụng, hãy thêm vào Màn hình chính trước khi tiếp tục.
      </Text>

      <View style={styles.phoneHint}>
        <Text style={styles.shareSymbol}>□↑</Text>
        <Text style={styles.phoneHintText}>Safari → Chia sẻ → Thêm vào Màn hình chính</Text>
      </View>

      <View style={styles.steps}>
        {steps.map((step) => (
          <View key={step.number} style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{step.number}</Text>
            </View>
            <View style={styles.stepCopy}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDetail}>{step.detail}</Text>
            </View>
          </View>
        ))}
      </View>

      {environment.isIosInAppBrowser ? (
        <Text style={styles.warning}>
          Nếu bạn đang mở từ Facebook, Instagram hoặc Zalo, hãy mở liên kết này bằng Safari trước.
        </Text>
      ) : null}

      <Text style={styles.footer}>
        Sau khi mở bằng icon trên Home Screen, màn hình này sẽ tự biến mất.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas
  },
  content: {
    minHeight: "100%",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
    gap: 18
  },
  icon: {
    alignSelf: "center",
    width: 86,
    height: 86,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
    boxShadow: "0 14px 34px rgba(79, 111, 61, 0.22)"
  },
  iconText: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 28
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 30,
    lineHeight: 36,
    textAlign: "center"
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center"
  },
  phoneHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.surface,
    padding: 14
  },
  shareSymbol: {
    color: colors.greenDark,
    fontFamily: fonts.bold,
    fontSize: 24
  },
  phoneHintText: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 19,
    flexShrink: 1
  },
  steps: {
    gap: 12
  },
  step: {
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: 14
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green
  },
  stepNumberText: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 14
  },
  stepCopy: {
    flex: 1,
    gap: 3
  },
  stepTitle: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 20
  },
  stepDetail: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18
  },
  warning: {
    color: colors.red,
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center"
  },
  footer: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center"
  }
});
```

- [ ] **Step 2: Typecheck**

Run:

```powershell
npm.cmd --workspace client run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```powershell
git add client/src/pwa/IosInstallGate.tsx
git commit -m "feat: add ios pwa install gate"
```

---

### Task 4: PWA Runtime And App Integration

**Files:**
- Create: `client/src/pwa/PwaRuntime.tsx`
- Modify: `client/App.tsx`

- [ ] **Step 1: Create the web runtime helper**

Create `client/src/pwa/PwaRuntime.tsx`:

```tsx
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
```

- [ ] **Step 2: Integrate the runtime and gate**

Modify `client/App.tsx`:

```tsx
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { IosInstallGate } from "./src/pwa/IosInstallGate";
import { PwaRuntime } from "./src/pwa/PwaRuntime";
import { shouldShowIosInstallGate } from "./src/pwa/platform";
import { colors } from "./src/theme/colors";

export default function App() {
  const [fontsLoaded] = useFonts({
    "WorkSans-Regular": require("./assets/fonts/WorkSans-Regular.ttf"),
    "WorkSans-Medium": require("./assets/fonts/WorkSans-Medium.ttf"),
    "WorkSans-Semibold": require("./assets/fonts/WorkSans-SemiBold.ttf"),
    "WorkSans-Bold": require("./assets/fonts/WorkSans-Bold.ttf")
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas }}>
        <PwaRuntime />
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  if (shouldShowIosInstallGate()) {
    return (
      <SafeAreaProvider>
        <PwaRuntime />
        <StatusBar style="dark" />
        <IosInstallGate />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <PwaRuntime />
      <AuthProvider>
        <StatusBar style="dark" />
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 3: Verify detection tests still pass**

Run:

```powershell
npm.cmd --workspace client run test:pwa
```

Expected: PASS.

- [ ] **Step 4: Typecheck**

Run:

```powershell
npm.cmd --workspace client run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add client/App.tsx client/src/pwa/PwaRuntime.tsx
git commit -m "feat: gate ios safari behind pwa install"
```

---

### Task 5: Manifest, Icons, And Service Worker

**Files:**
- Create: `client/public/manifest.json`
- Create: `client/public/sw.js`
- Create: `client/public/browserconfig.xml`
- Create by copy: `client/public/icons/daily-meal-icon.png`
- Create by copy: `client/public/favicon.png`
- Modify: `client/app.json`

- [ ] **Step 1: Copy icon assets**

Run:

```powershell
New-Item -ItemType Directory -Force client\public\icons
Copy-Item client\assets\stickers\custom-smile.png client\public\icons\daily-meal-icon.png
Copy-Item client\assets\stickers\custom-smile.png client\public\favicon.png
```

Expected: both PNG files exist under `client/public`.

- [ ] **Step 2: Create the web manifest**

Create `client/public/manifest.json`:

```json
{
  "name": "Daily Meal",
  "short_name": "Daily Meal",
  "description": "Share meals, recipes, and daily nutrition moments.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#F4F3EF",
  "theme_color": "#F4F3EF",
  "icons": [
    {
      "src": "/icons/daily-meal-icon.png",
      "sizes": "180x180 192x192 512x512 1024x1024",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 3: Create the service worker**

Create `client/public/sw.js`:

```js
const CACHE_NAME = "daily-meal-shell-v1";
const SHELL_PATHS = ["/", "/manifest.json", "/icons/daily-meal-icon.png", "/favicon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_PATHS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        if (response.ok && request.method === "GET") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
```

- [ ] **Step 4: Create browserconfig**

Create `client/public/browserconfig.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square150x150logo src="/icons/daily-meal-icon.png"/>
      <TileColor>#F4F3EF</TileColor>
    </tile>
  </msapplication>
</browserconfig>
```

- [ ] **Step 5: Add Expo web config**

Modify `client/app.json` by adding a top-level `web` key inside `expo`:

```json
{
  "web": {
    "bundler": "metro",
    "output": "static",
    "favicon": "./public/favicon.png"
  }
}
```

Keep the existing `ios`, `android`, `plugins`, and `extra` sections.

- [ ] **Step 6: Build web output**

Run:

```powershell
npm.cmd --workspace client run build:web
```

Expected: PASS and `client/dist` contains static web assets.

- [ ] **Step 7: Verify public PWA files are exported**

Run:

```powershell
Test-Path client\dist\manifest.json
Test-Path client\dist\sw.js
Test-Path client\dist\icons\daily-meal-icon.png
```

Expected: all three commands print `True`.

- [ ] **Step 8: Commit**

```powershell
git add client/app.json client/public
git commit -m "feat: add pwa manifest and service worker"
```

---

### Task 6: Production API Base URL

**Files:**
- Modify: `client/src/api/client.ts`

- [ ] **Step 1: Update API URL resolution**

Modify only `resolveApiBaseUrl()` in `client/src/api/client.ts`:

```ts
function resolveApiBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }

  const metroHost = getMetroHost();

  if (metroHost) {
    return `http://${metroHost}:4000`;
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:4000";
  }

  return "http://localhost:4000";
}
```

Because every API method already calls paths beginning with `/api`, `window.location.origin` makes production web requests go to `https://ngocthanhhx7.site/api/*`.

- [ ] **Step 2: Typecheck**

Run:

```powershell
npm.cmd --workspace client run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run PWA tests**

Run:

```powershell
npm.cmd --workspace client run test:pwa
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add client/src/api/client.ts
git commit -m "fix: use same-origin api on web"
```

---

### Task 7: EC2/Nginx Deployment Documentation

**Files:**
- Modify: `docs/ec2-deployment.md`

- [ ] **Step 1: Add web build instructions**

Add this section after the existing server build/setup instructions:

```markdown
## Web PWA Build

Build the Expo web app on the EC2 instance after pulling new code:

```bash
cd ~/daily_meal
npm ci
npm --workspace client run build:web
sudo mkdir -p /var/www/daily-meal
sudo rsync -a --delete client/dist/ /var/www/daily-meal/
sudo chown -R nginx:nginx /var/www/daily-meal
```

The web app uses the same origin for API calls. Requests to `/api/*` must be proxied to the Express server.
```

- [ ] **Step 2: Replace or extend Nginx config**

In the Nginx section, provide this production server block:

```nginx
server {
    listen 80;
    server_name ngocthanhhx7.site www.ngocthanhhx7.site;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ngocthanhhx7.site www.ngocthanhhx7.site;

    root /var/www/daily-meal;
    index index.html;
    client_max_body_size 10m;

    location = /index.html {
        add_header Cache-Control "no-store";
        try_files $uri =404;
    }

    location = /manifest.json {
        add_header Cache-Control "no-cache";
        try_files $uri =404;
    }

    location = /sw.js {
        add_header Cache-Control "no-cache";
        try_files $uri =404;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:4000/uploads/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(?:js|css|png|jpg|jpeg|gif|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
        try_files $uri =404;
    }

    # Keep the existing ssl_certificate and ssl_certificate_key lines from Certbot here.
}
```

- [ ] **Step 3: Add deploy verification commands**

Add:

```markdown
After updating Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
curl -I https://ngocthanhhx7.site/
curl -I https://ngocthanhhx7.site/manifest.json
curl https://ngocthanhhx7.site/health
```

For API health through the same domain, keep either `/health` proxied separately or test an authenticated `/api/*` route from the web app. If `/health` is needed publicly, add a `location = /health` proxy to `http://127.0.0.1:4000/health`.
```

- [ ] **Step 4: Commit**

```powershell
git add docs/ec2-deployment.md
git commit -m "docs: add pwa nginx deployment"
```

---

### Task 8: Full Verification

**Files:**
- No code changes unless verification exposes a defect.

- [ ] **Step 1: Run server tests**

Run:

```powershell
npm.cmd --workspace server run test
```

Expected: PASS.

- [ ] **Step 2: Run full typecheck**

Run:

```powershell
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run PWA tests**

Run:

```powershell
npm.cmd --workspace client run test:pwa
```

Expected: PASS.

- [ ] **Step 4: Run web build**

Run:

```powershell
npm.cmd --workspace client run build:web
```

Expected: PASS and `client/dist` is produced.

- [ ] **Step 5: Serve the static build locally**

Run:

```powershell
npm.cmd exec serve -- client/dist -l 5173
```

Expected: local static server starts at `http://localhost:5173`.

- [ ] **Step 6: Desktop sanity check**

Open `http://localhost:5173` in a desktop browser.

Expected:

- The iOS install gate is not shown.
- The Daily Meal app loads to login or home.
- Browser devtools Application tab shows `manifest.json`.
- Service worker registration is skipped on HTTP localhost unless the browser allows localhost service workers.

- [ ] **Step 7: iOS manual verification after deploy**

On an iPhone or iPad:

1. Open `https://ngocthanhhx7.site/` in Safari.
2. Confirm the install gate appears.
3. Tap Share.
4. Tap Add to Home Screen.
5. Open Daily Meal from the Home Screen icon.
6. Confirm the app opens without the gate.
7. Log in and verify feed, image upload, and one API-backed screen.

Expected: the Home Screen app runs in standalone mode and reaches the normal Daily Meal flow.

- [ ] **Step 8: Final commit if verification fixes were needed**

If verification required code or docs fixes:

```powershell
git add <changed-files>
git commit -m "fix: polish pwa install flow"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review

- Spec coverage: Tasks cover same-domain Nginx deployment, PWA metadata, iOS Safari hard gate, standalone bypass, service worker, and verification.
- Placeholder scan: no TBD/TODO/fill-in placeholders remain. The Nginx SSL certificate lines are explicitly preserved from the existing Certbot config because those values are environment-specific.
- Type consistency: PWA detection exports `getPwaEnvironment` and `shouldShowIosInstallGate`; those exact names are used by tests and `App.tsx`.
