# Google Login Design

## Goal

Add Gmail/Google login to Daily Meal for Android, iOS, and Web/PWA while keeping the existing Express, MongoDB, and Daily Meal JWT session model.

## Decisions

- Support Android, iOS, and Web/PWA.
- Keep email/password login and registration.
- Do not automatically merge a Google login into an existing email/password account when the email matches.
- If a matching email account exists and is not already linked to the Google subject, return a conflict and tell the user to sign in with email/password first, then link Google from settings.
- Use the existing Daily Meal JWT as the app session token after Google identity is verified.

## Architecture

The client obtains a Google ID token from the platform-specific Google sign-in flow, sends that ID token to the Daily Meal API, and the server verifies it with Google before issuing the existing Daily Meal JWT. The server remains the source of truth for account creation, provider linking, and session issuance.

Native Android and iOS use `@react-native-google-signin/google-signin`, because Expo recommends the provider library for Google authentication and it supports native sign-in. Web/PWA uses a browser-compatible Google Identity Services flow through a small client adapter. Both adapters expose the same client-facing shape: return an ID token or throw a user-readable error.

## Backend Design

### Environment

Add server environment support for Google OAuth client IDs:

- `GOOGLE_WEB_CLIENT_ID`
- `GOOGLE_ANDROID_CLIENT_ID`
- `GOOGLE_IOS_CLIENT_ID`

The backend accepts ID tokens whose audience matches any configured client ID. At least one client ID must be configured before Google auth can succeed.

### User Model

Extend `User` with optional provider metadata:

```ts
authProviders: {
  google?: {
    sub: string;
    email: string;
    linkedAt: Date;
  };
};
passwordHash?: string;
```

`passwordHash` becomes optional so Google-only users can exist without a local password. Existing password users continue to store and verify `passwordHash` as before.

### Service Boundary

Create a focused Google auth service that:

- verifies ID tokens with Google Auth Library,
- checks the token audience against configured client IDs,
- requires `email` and `sub`,
- returns `{ sub, email, displayName, avatarUrl }`.

The auth route owns account policy:

- `POST /api/auth/google`
  - If Google `sub` is already linked, sign in that user.
  - If no user exists with the Google email, create a Google-only user and sign in.
  - If a user exists with the same email but no matching Google link, return `409` with message: `Sign in with email and password first, then link Google in Settings.`
  - If a user exists with the email but a different Google `sub`, return `409`.

- `POST /api/auth/google/link`
  - Requires the current Daily Meal JWT.
  - Verifies the Google ID token.
  - Rejects if another user already has the Google `sub`.
  - Rejects if the Google email differs from the current user's email.
  - Stores the Google provider metadata on the current user.
  - Returns the updated user DTO.

### Password Change

`PATCH /api/auth/password` continues to require the current password. Google-only users have no password and cannot use this endpoint until a future "set password" flow exists. For this feature, returning `401` for missing or invalid current password is acceptable.

## Client Design

### API Client

Add:

```ts
googleLogin(body: { idToken: string }): Promise<{ token: string; user: User }>
linkGoogle(token: string, body: { idToken: string }): Promise<{ user: User }>
```

These use the existing `fetch` wrapper and error handling.

### Auth Context

Add:

```ts
signInWithGoogle(idToken: string): Promise<void>
linkGoogle(idToken: string): Promise<void>
```

`signInWithGoogle` calls `api.googleLogin` and reuses `persistSession`. `linkGoogle` calls `api.linkGoogle` and updates the current user.

### Google Client Adapter

Create a small client module that hides platform differences:

- Native calls Google sign-in and returns `idToken`.
- Web calls the browser Google identity flow and returns `credential` as the ID token.
- If the user cancels, throw a clear cancellation error.
- If Google client configuration is missing, throw a user-readable setup error.

Client public environment variables:

- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`

No Google client secret is stored in the client.

### Login Screen

Replace the current social placeholder mail button with a real Google sign-in button. Keep email/password UI unchanged. On `409`, show the server message so the user understands they must sign in with email/password first and link Google from Settings.

### Settings Screen

Add a "Link Google" action for signed-in users. It starts Google sign-in, sends the ID token to `POST /api/auth/google/link`, and shows a success or error alert. Existing settings behavior remains unchanged.

## Testing

Backend tests use TDD and avoid live Google network calls by injecting or mocking the Google verifier boundary:

- New Google email creates a user and returns a Daily Meal JWT.
- Linked Google account can sign in again.
- Existing email/password account with the same email but no Google link returns `409`.
- Authenticated user can link Google when email matches.
- Linking rejects a Google token already linked to another user.
- Linking rejects a Google token with a different email.
- Password login still works for existing password users.

Client typecheck verifies API and context signatures. Manual smoke testing is required for real Google sign-in on Android, iOS, and Web/PWA after Google Cloud OAuth client IDs are configured.

## Verification

Run:

```powershell
npm.cmd --workspace server run test
npm.cmd --workspace server run typecheck
npm.cmd --workspace client run typecheck
```

Manual smoke test:

1. Configure Google OAuth client IDs in `server/.env` and client Expo env vars.
2. Start API and Expo.
3. Sign in with Google using a new Gmail account.
4. Sign out and sign in again with the same Google account.
5. Register with email/password, sign out, then try Google login with the same email and confirm it is blocked with the linking message.
6. Sign in with email/password, open Settings, link Google, sign out, then sign in with Google.
