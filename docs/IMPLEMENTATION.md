# Daily Meal Implementation

## Architecture

Daily Meal is scaffolded as a TypeScript monorepo:

- `client/`: Expo React Native mobile app.
- `server/`: Express TypeScript API backed by MongoDB.
- `client/assets/figma-snapshots/`: copied planning screenshots from `ảnh chụp từ figma/`.
- `client/assets/fonts/`: SF Pro Text font files copied from `font-text/`.
- `figma-export/`: reserved for the exported Figma asset zip/folder.

The app follows the Figma flows, but the UI is normalized into one production design system instead of copying every rough wireframe style exactly.

## Local Setup

Use `npm.cmd` on this Windows machine because PowerShell blocks `npm.ps1`.

```powershell
npm.cmd install
```

Start MongoDB locally:

```powershell
& "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe" --dbpath C:\tmp\mongodb-daily-meal
```

Create `server/.env` from `server/.env.example`, then start the API:

```powershell
npm.cmd run dev:server
```

Create `client/.env` from `client/.env.example`. For Expo web on `http://localhost:8081`, keep the API URL pointed at the local API:

```powershell
$env:EXPO_PUBLIC_API_URL="http://localhost:4000"
npm.cmd run dev:client
```

Or start Expo without overriding the API URL when the client and API are served from the same origin:

```powershell
npm.cmd run dev:client
```

For Android emulator, set the API URL to the host loopback:

```powershell
$env:EXPO_PUBLIC_API_URL="http://10.0.2.2:4000"
npm.cmd run dev:client
```

## Backend

Server stack:

- Express, Mongoose, Zod, JWT, bcrypt.
- Local raster image uploads via Multer into `server/uploads` with PNG/JPEG/WebP/GIF allowlisting.
- Shineshop AI analysis for meal photo nutrition.
- Development fallback calorie analysis is returned when `SHINESHOP_API_KEY` is empty.
- Socket.io requires a valid JWT and verifies conversation membership before joining chat rooms.
- Public user DTOs hide email/phone for other users; owner data remains available through `/api/auth/me`.
- Block interactions are enforced across follow, profile visibility, feed/search visibility, post interactions, conversations, and realtime chat rooms.
- PayOS Premium activations store a paid entitlement expiry in `premiumPaidEndsAt`; legacy/manual Premium remains supported when no paid expiry exists.

Implemented routes:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PATCH /api/auth/password`
- `PATCH /api/users/me`
- `GET /api/users/search`
- `GET /api/users/:id`
- `POST /api/users/:id/follow`
- `DELETE /api/users/:id/follow`
- `POST /api/users/:id/interactions`
- `DELETE /api/users/:id/interactions/:type`
- `GET /api/users/:id/posts`
- `GET /api/users/:id/saved-posts`
- `GET /api/messages/conversations`
- `POST /api/messages/conversations`
- `GET /api/messages/conversations/:id/messages`
- `POST /api/messages/conversations/:id/messages`
- `PATCH /api/onboarding/preferences`
- `GET /api/posts/feed`
- `GET /api/posts/search`
- `POST /api/posts`
- `PATCH /api/posts/:id`
- `DELETE /api/posts/:id`
- `POST /api/posts/:id/like`
- `POST /api/posts/:id/save`
- `GET /api/posts/:id/comments`
- `POST /api/posts/:id/comments`
- `POST /api/uploads`
- `GET /api/stickers`
- `POST /api/meals/analyze`
- `GET /api/meals`
- `GET /api/meals/:id`

Shineshop defaults:

- `SHINESHOP_BASE_URL=https://api.shineshop.dev/v1`
- `SHINESHOP_MODEL=gpt-4o-mini`
- `SHINESHOP_MAX_TOKENS=1200`

## Client

Implemented flows:

- Email/password login and registration.
- Onboarding interest and eating-style selection.
- Home feed with post cards, nutrition, recipe, comments, like/save actions.
- Search screen with post search, user search, and follow/unfollow actions.
- Create post with camera/gallery, free vs premium image limits, premium sticker gating, AI calorie attachment.
- Meals screen with camera/gallery image analysis and meal history.
- Public profile with follow state. Mutual follows become friends automatically.
- Public profile action menu: restrict, block, copy name to search, report.
- Messaging flow from public profile to inbox and chat.
- Own profile, edit profile, avatar upload, birthday visibility, change password, settings, edit post, recipe, comments.
- Support feedback and share-account screens are UI placeholders until matching backend APIs are available; they no longer show fake success states.

Fallback demo data appears when the backend has no posts/meals yet, so the UI remains inspectable during early setup.

## Assets

Current tracked assets:

- SF Pro Text font family in `client/assets/fonts`.
- Figma screenshots `image1.png` through `image10.png` in `client/assets/figma-snapshots`.

Reserved folders:

- `client/assets/icons`
- `client/assets/stickers`
- `client/assets/backgrounds`
- `client/assets/banners`
- `client/assets/images/food`

When a Figma export zip is available, place it under `figma-export/` and move assets into the folders above. The API seeds sticker metadata that points to future sticker assets.

## Validation

Run:

```powershell
npm.cmd run typecheck
npm.cmd test
```

Manual smoke test:

1. Register a user.
2. Complete onboarding.
3. Create a free post with 1 image.
4. Toggle Premium in Profile.
5. Create a premium post with up to 3 images and a VIP sticker.
6. Analyze a meal image.
7. Search posts and open another profile.
8. Search a user, follow them, then have the other user follow back to verify friend status.
9. Edit profile name, bio, avatar, and birthday visibility.
10. Change password and log in again with the new password.
11. Open another profile, switch between posted and saved tabs, use the 3-dot action menu, and start a chat.
