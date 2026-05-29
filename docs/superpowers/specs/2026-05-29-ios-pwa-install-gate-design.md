# iOS PWA Install Gate Design

## Goal

Daily Meal should run on iOS without App Store distribution by serving the Expo web build as a Progressive Web App at `https://ngocthanhhx7.site/`. iOS users who open the site in Safari must be guided to add Daily Meal to the Home Screen before using the main app, matching the GeForce NOW-style install flow.

## Scope

This work adds a production web/PWA path for the existing Daily Meal client and deployment setup. It does not rebuild the app as a separate web product and does not change the native iOS/App Store path.

In scope:

- Serve the Expo web build from the existing EC2/Nginx deployment at `https://ngocthanhhx7.site/`.
- Proxy API requests through the same domain using `/api/*` to avoid CORS issues.
- Add PWA metadata, manifest, icons, Apple web app meta tags, and a service worker/offline app shell.
- Add a hard iOS Safari install gate before the authenticated app flow.
- Let users proceed normally after launching from the Home Screen in standalone display mode.
- Document production build and Nginx deployment steps.

Out of scope:

- Publishing to the iOS App Store.
- Creating a separate React web app outside the Expo client.
- Offline API/data sync for authenticated resources.
- Push notifications.

## Platform Behavior

Daily Meal will use three runtime classes:

- iOS/iPadOS Safari, not standalone: show the install gate and block the main app.
- iOS/iPadOS Home Screen standalone: show the normal Daily Meal app.
- Android, desktop, and non-iOS browsers: show the normal app without the hard gate.

iOS Safari cannot show a native install prompt like Android. The gate will therefore provide clear manual instructions:

1. Open the site in Safari.
2. Tap the Share button.
3. Choose "Add to Home Screen".
4. Open Daily Meal from the new Home Screen icon.

If the site is opened inside an in-app browser that cannot add to Home Screen, the gate should tell the user to open the link in Safari.

## Client Architecture

The existing `client/App.tsx` remains the app entry point. A small web-only PWA layer will run before the navigation tree:

- Detect whether the runtime is web, iOS/iPadOS, Safari, and standalone.
- Render `IosInstallGate` only when the user is on iOS Safari and not standalone.
- Render the existing provider/navigation tree otherwise.

The gate must be self-contained and should not require authentication state. It should use existing theme colors and typography where possible, with plain React Native primitives so the Expo web build can render it.

The app should use a relative API origin on web:

- Production web: `/api`
- Local native/web development: existing localhost and Metro host behavior can remain available.

This keeps `https://ngocthanhhx7.site/` and `https://ngocthanhhx7.site/api/*` on the same origin.

## PWA Metadata

The client needs web metadata that allows Home Screen launch:

- App name: `Daily Meal`
- Short name: `Daily Meal`
- Start URL: `/`
- Scope: `/`
- Display: `standalone`
- Theme/background colors aligned with the current Daily Meal palette.
- Icons sized for standard PWA use and Apple touch icon use.
- Apple meta tags for mobile web app capability, title, touch icon, and status bar style.

The existing asset set can be reused for the first version. If no production-ready square icon exists, create a simple branded Daily Meal icon from the current palette and document where it lives.

## Service Worker And Offline Shell

The service worker should make the installed app launch reliably when the network is weak by caching the static app shell. It should not cache authenticated API responses.

Expected behavior:

- Cache web build static assets during install or first fetch.
- Use network-first or no-cache behavior for `/api/*`.
- Fall back to the cached app shell for navigation requests when possible.
- Keep the implementation minimal and easy to replace if Expo's generated web output changes.

## Deployment Architecture

Nginx on the existing EC2 server will serve both the web client and API:

- `/` serves the static Expo web build.
- `/api/` proxies to the Express app at `http://127.0.0.1:4000/api/`.
- HTTPS remains on `https://ngocthanhhx7.site/`.
- Static assets should use long-lived cache headers when safe.
- `index.html`, manifest, and service worker should avoid stale caching.

The server process managed by PM2 can remain unchanged unless the API needs environment updates for client origin or production mode.

## Testing

Automated checks:

- Typecheck the client and server.
- Build the Expo web output.
- Run existing server tests.

Manual browser checks:

- Desktop browser at `/` loads the app.
- API calls use `/api/*` on production web.
- Manifest, icons, and service worker are reachable.

Manual iOS checks:

- Open `https://ngocthanhhx7.site/` in Safari on iPhone/iPad.
- Confirm the install gate appears before login/home.
- Use Share -> Add to Home Screen.
- Open the Home Screen icon.
- Confirm the app opens without the gate and can log in/use core flows.
- Confirm safe areas and navigation feel app-like in standalone mode.

## Risks And Constraints

- iOS install cannot be triggered programmatically; the manual Share flow is required.
- Add to Home Screen works best from Safari on HTTPS.
- Expo web support for native-oriented modules can differ from iOS/Android native builds. Camera, image upload, and secure storage need focused web sanity checks.
- Service worker caching must not store private API responses.

## Acceptance Criteria

- `https://ngocthanhhx7.site/` serves the Daily Meal web app.
- iOS Safari users who are not in standalone mode see the hard install gate.
- iOS Home Screen standalone users can access the normal app.
- Android and desktop users are not blocked by the iOS gate.
- The PWA manifest, icons, Apple metadata, and service worker are present.
- Nginx deployment instructions/config cover static web hosting and `/api` proxying on the same domain.
