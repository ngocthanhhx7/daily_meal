# Google Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google login and Google account linking for Android, iOS, and Web/PWA while preserving the existing Daily Meal JWT session flow.

**Architecture:** The client obtains a Google ID token and sends it to the Express API. The API verifies the ID token through a focused Google verifier service, enforces the chosen account-linking policy, and returns the existing Daily Meal JWT/session DTO.

**Tech Stack:** Expo React Native, React Native Web/PWA, Express, Mongoose, Zod, JWT, Vitest, Supertest, Google Auth Library, `@react-native-google-signin/google-signin`.

---

## Current Workspace Notes

The current working tree already contains uncommitted auth changes for Facebook and phone-related login cleanup in:

- `server/src/models/User.ts`
- `server/src/routes/auth.ts`
- `client/src/api/client.ts`
- `client/src/context/AuthContext.tsx`
- `client/src/screens/LoginScreen.tsx`

Preserve those changes. Add Google support alongside them instead of reverting them.

Baseline captured before this plan:

- `npm.cmd --workspace server run test`: 9 tests passed.
- `npm.cmd --workspace server run typecheck`: passed.
- `npm.cmd --workspace client run typecheck`: passed.

## File Structure

- Modify `server/package.json`: add `google-auth-library`.
- Modify `client/package.json`: add `@react-native-google-signin/google-signin` and web auth support if needed.
- Modify `client/app.json`: add the Google sign-in config plugin.
- Modify `server/src/config/env.ts`: parse Google OAuth client IDs.
- Modify `server/.env.example`: document Google OAuth variables.
- Modify `server/src/models/User.ts`: add Google provider fields and allow Google-only users to exist.
- Create `server/src/services/googleAuth.ts`: verify Google ID tokens behind a small boundary.
- Modify `server/src/routes/auth.ts`: add `/google` and `/google/link`.
- Modify `server/src/tests/api.test.ts`: add Google auth route tests with a mocked verifier.
- Modify `client/src/api/client.ts`: add Google login/link API methods.
- Modify `client/src/context/AuthContext.tsx`: expose Google login/link functions.
- Create `client/src/services/googleSignIn.ts`: platform-aware ID token acquisition.
- Modify `client/src/screens/LoginScreen.tsx`: add real Google login action.
- Modify `client/src/screens/SettingsScreen.tsx`: add Google linking action.

### Task 1: Backend Google Auth Tests

**Files:**
- Modify: `server/src/tests/api.test.ts`
- Later create: `server/src/services/googleAuth.ts`

- [ ] **Step 1: Write failing tests**

Add a mockable verifier and these tests near the auth tests:

```ts
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/googleAuth.js", () => ({
  verifyGoogleIdToken: vi.fn()
}));

import { verifyGoogleIdToken } from "../services/googleAuth.js";

const mockedVerifyGoogleIdToken = vi.mocked(verifyGoogleIdToken);

beforeEach(() => {
  mockedVerifyGoogleIdToken.mockReset();
});
```

Add tests:

```ts
it("creates a Google user and reads the current user", async () => {
  mockedVerifyGoogleIdToken.mockResolvedValue({
    sub: "google-new-user",
    email: "google-new@example.com",
    displayName: "Google New",
    avatarUrl: "https://example.com/avatar.png"
  });

  const response = await request(app)
    .post("/api/auth/google")
    .send({ idToken: "valid-google-token" })
    .expect(200);

  expect(response.body.user.email).toBe("google-new@example.com");

  const me = await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${response.body.token}`)
    .expect(200);

  expect(me.body.user.displayName).toBe("Google New");
});

it("signs in an existing linked Google user", async () => {
  mockedVerifyGoogleIdToken.mockResolvedValue({
    sub: "google-linked-user",
    email: "google-linked@example.com",
    displayName: "Google Linked",
    avatarUrl: undefined
  });

  await request(app).post("/api/auth/google").send({ idToken: "first-token" }).expect(200);
  const response = await request(app)
    .post("/api/auth/google")
    .send({ idToken: "second-token" })
    .expect(200);

  expect(response.body.user.email).toBe("google-linked@example.com");
});

it("blocks Google sign-in for an existing password account until it is linked", async () => {
  await register("google-conflict@example.com");
  mockedVerifyGoogleIdToken.mockResolvedValue({
    sub: "google-conflict-sub",
    email: "google-conflict@example.com",
    displayName: "Conflict",
    avatarUrl: undefined
  });

  const response = await request(app)
    .post("/api/auth/google")
    .send({ idToken: "conflict-token" })
    .expect(409);

  expect(response.body.message).toContain("Sign in with email and password first");
});

it("links Google to the current password account when email matches", async () => {
  const session = await register("google-link@example.com");
  mockedVerifyGoogleIdToken.mockResolvedValue({
    sub: "google-link-sub",
    email: "google-link@example.com",
    displayName: "Google Link",
    avatarUrl: undefined
  });

  const link = await request(app)
    .post("/api/auth/google/link")
    .set("Authorization", `Bearer ${session.token}`)
    .send({ idToken: "link-token" })
    .expect(200);

  expect(link.body.user.email).toBe("google-link@example.com");

  const login = await request(app)
    .post("/api/auth/google")
    .send({ idToken: "link-token" })
    .expect(200);

  expect(login.body.user.email).toBe("google-link@example.com");
});

it("rejects linking a Google account already linked to another user", async () => {
  await request(app).post("/api/auth/google").send({ idToken: "owner-token" }).expect(200);
  const session = await register("google-link-taken@example.com");

  mockedVerifyGoogleIdToken.mockResolvedValue({
    sub: "google-new-user",
    email: "google-link-taken@example.com",
    displayName: "Taken",
    avatarUrl: undefined
  });

  await request(app)
    .post("/api/auth/google/link")
    .set("Authorization", `Bearer ${session.token}`)
    .send({ idToken: "taken-token" })
    .expect(409);
});

it("rejects linking Google when the email differs from the current user", async () => {
  const session = await register("google-link-owner@example.com");
  mockedVerifyGoogleIdToken.mockResolvedValue({
    sub: "google-different-email",
    email: "different-google@example.com",
    displayName: "Different",
    avatarUrl: undefined
  });

  await request(app)
    .post("/api/auth/google/link")
    .set("Authorization", `Bearer ${session.token}`)
    .send({ idToken: "different-email-token" })
    .expect(409);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npm.cmd --workspace server run test
```

Expected: fail because `../services/googleAuth.js` and Google auth routes do not exist yet.

### Task 2: Backend Google Auth Implementation

**Files:**
- Modify: `server/package.json`
- Modify: `server/src/config/env.ts`
- Modify: `server/.env.example`
- Modify: `server/src/models/User.ts`
- Create: `server/src/services/googleAuth.ts`
- Modify: `server/src/routes/auth.ts`

- [ ] **Step 1: Install backend dependency**

Run:

```powershell
npm.cmd --workspace server install google-auth-library
```

Expected: `server/package.json` and root `package-lock.json` include `google-auth-library`.

- [ ] **Step 2: Add environment variables**

In `server/src/config/env.ts`, add optional strings to the schema:

```ts
GOOGLE_WEB_CLIENT_ID: optionalString,
GOOGLE_ANDROID_CLIENT_ID: optionalString,
GOOGLE_IOS_CLIENT_ID: optionalString
```

In `server/.env.example`, add:

```dotenv
GOOGLE_WEB_CLIENT_ID=
GOOGLE_ANDROID_CLIENT_ID=
GOOGLE_IOS_CLIENT_ID=
```

- [ ] **Step 3: Update the user schema**

In `server/src/models/User.ts`, make `passwordHash` optional and add Google provider metadata:

```ts
passwordHash: { type: String },
authProviders: {
  google: {
    sub: { type: String, unique: true, sparse: true },
    email: { type: String, lowercase: true, trim: true },
    linkedAt: { type: Date }
  }
},
```

Keep the existing `facebookId`, `phone`, and other fields intact.

- [ ] **Step 4: Create Google verifier service**

Create `server/src/services/googleAuth.ts`:

```ts
import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env.js";
import { HttpError } from "../middleware/error.js";

const client = new OAuth2Client();

export type GoogleIdentity = {
  sub: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
};

function googleAudiences() {
  return [
    env.GOOGLE_WEB_CLIENT_ID,
    env.GOOGLE_ANDROID_CLIENT_ID,
    env.GOOGLE_IOS_CLIENT_ID
  ].filter((value): value is string => Boolean(value));
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const audience = googleAudiences();

  if (!audience.length) {
    throw new HttpError(500, "Google sign-in is not configured");
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience
  });
  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email) {
    throw new HttpError(401, "Invalid Google account");
  }

  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    displayName: payload.name,
    avatarUrl: payload.picture
  };
}
```

- [ ] **Step 5: Add Google auth routes**

In `server/src/routes/auth.ts`, import `verifyGoogleIdToken` and add:

```ts
const googleAuthSchema = z.object({
  idToken: z.string().min(1)
});

const GOOGLE_LINK_REQUIRED =
  "Sign in with email and password first, then link Google in Settings.";
```

Then add `/google` and `/google/link` routes before `/me`:

```ts
authRouter.post("/google", async (req, res, next) => {
  try {
    const { idToken } = googleAuthSchema.parse(req.body);
    const googleUser = await verifyGoogleIdToken(idToken);

    let user = await User.findOne({ "authProviders.google.sub": googleUser.sub });

    if (!user) {
      const existingByEmail = await User.findOne({ email: googleUser.email });

      if (existingByEmail) {
        throw new HttpError(409, GOOGLE_LINK_REQUIRED);
      }

      user = await User.create({
        email: googleUser.email,
        displayName: googleUser.displayName ?? googleUser.email.split("@")[0],
        avatarUrl: googleUser.avatarUrl,
        authProviders: {
          google: {
            sub: googleUser.sub,
            email: googleUser.email,
            linkedAt: new Date()
          }
        }
      });
    }

    res.json({
      token: signAccessToken(user._id.toString()),
      user: userDto(user)
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/google/link", requireAuth, async (req, res, next) => {
  try {
    const { idToken } = googleAuthSchema.parse(req.body);
    const googleUser = await verifyGoogleIdToken(idToken);
    const user = await User.findById(req.user?.id);

    if (!user) {
      throw new HttpError(404, "User not found");
    }

    if (!user.email || user.email !== googleUser.email) {
      throw new HttpError(409, "Google email must match your Daily Meal account email.");
    }

    const owner = await User.findOne({
      "authProviders.google.sub": googleUser.sub,
      _id: { $ne: user._id }
    }).lean();

    if (owner) {
      throw new HttpError(409, "This Google account is already linked to another Daily Meal account.");
    }

    user.authProviders = {
      ...(user.authProviders ?? {}),
      google: {
        sub: googleUser.sub,
        email: googleUser.email,
        linkedAt: new Date()
      }
    };

    if (!user.avatarUrl && googleUser.avatarUrl) {
      user.avatarUrl = googleUser.avatarUrl;
    }

    await user.save();

    res.json({ user: userDto(user) });
  } catch (error) {
    next(error);
  }
});
```

- [ ] **Step 6: Run tests and typecheck**

Run:

```powershell
npm.cmd --workspace server run test
npm.cmd --workspace server run typecheck
```

Expected: tests and typecheck pass.

### Task 3: Client API and Auth Context

**Files:**
- Modify: `client/src/api/client.ts`
- Modify: `client/src/context/AuthContext.tsx`

- [ ] **Step 1: Add API methods**

Add:

```ts
googleLogin: (body: { idToken: string }) =>
  request<{ token: string; user: User }>("/api/auth/google", {
    method: "POST",
    body
  }),
linkGoogle: (token: string, body: { idToken: string }) =>
  request<{ user: User }>("/api/auth/google/link", {
    method: "POST",
    token,
    body
  }),
```

- [ ] **Step 2: Add auth context functions**

Extend `AuthContextValue`:

```ts
signInWithGoogle: (idToken: string) => Promise<void>;
linkGoogle: (idToken: string) => Promise<void>;
```

Add implementations:

```ts
signInWithGoogle: async (idToken) => {
  const result = await api.googleLogin({ idToken });
  await persistSession(result.token, result.user);
},
linkGoogle: async (idToken) => {
  if (!token) {
    return;
  }
  const result = await api.linkGoogle(token, { idToken });
  setUser(result.user);
},
```

- [ ] **Step 3: Run client typecheck**

Run:

```powershell
npm.cmd --workspace client run typecheck
```

Expected: pass.

### Task 4: Google Sign-In Client Adapter and UI

**Files:**
- Modify: `client/package.json`
- Modify: `client/app.json`
- Create: `client/src/services/googleSignIn.ts`
- Modify: `client/src/screens/LoginScreen.tsx`
- Modify: `client/src/screens/SettingsScreen.tsx`

- [ ] **Step 1: Install client dependency**

Run:

```powershell
npm.cmd --workspace client install @react-native-google-signin/google-signin
```

Expected: dependency appears in `client/package.json` and root `package-lock.json`.

- [ ] **Step 2: Add Expo config plugin**

In `client/app.json`, add the plugin:

```json
"@react-native-google-signin/google-signin"
```

Keep existing plugins intact.

- [ ] **Step 3: Create Google sign-in adapter**

Create `client/src/services/googleSignIn.ts` with a platform-aware `getGoogleIdToken()` function:

```ts
import { Platform } from "react-native";
import {
  GoogleSignin,
  statusCodes
} from "@react-native-google-signin/google-signin";

declare const process: {
  env: Record<string, string | undefined>;
};

type GoogleCredentialResponse = {
  credential?: string;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          prompt: (callback?: (notification: { isNotDisplayed?: () => boolean; isSkippedMoment?: () => boolean }) => void) => void;
        };
      };
    };
  }
}

let configured = false;

function configureNativeGoogle() {
  if (configured) {
    return;
  }

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

  if (!webClientId) {
    throw new Error("Google login is missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.");
  }

  GoogleSignin.configure({
    webClientId,
    iosClientId
  });
  configured = true;
}

function loadGoogleScript() {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      reject(new Error("Google login is not available in this environment."));
      return;
    }

    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>("script[data-daily-meal-google]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load Google login.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.dailyMealGoogle = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google login."));
    document.head.appendChild(script);
  });
}

async function getWebGoogleIdToken() {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  if (!clientId) {
    throw new Error("Google login is missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.");
  }

  await loadGoogleScript();

  return new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("Google login timed out."));
    }, 60000);

    window.google?.accounts?.id?.initialize({
      client_id: clientId,
      callback: (response) => {
        window.clearTimeout(timeout);
        if (!response.credential) {
          reject(new Error("Google did not return an ID token."));
          return;
        }
        resolve(response.credential);
      }
    });

    window.google?.accounts?.id?.prompt((notification) => {
      if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
        window.clearTimeout(timeout);
        reject(new Error("Google login was cancelled or unavailable."));
      }
    });
  });
}

export async function getGoogleIdToken() {
  if (Platform.OS === "web") {
    return getWebGoogleIdToken();
  }

  try {
    configureNativeGoogle();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();
    const idToken = result.data?.idToken;

    if (!idToken) {
      throw new Error("Google did not return an ID token.");
    }

    return idToken;
  } catch (error: any) {
    if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error("Google login was cancelled.");
    }
    throw error;
  }
}
```

- [ ] **Step 4: Add Google login button behavior**

In `client/src/screens/LoginScreen.tsx`, import `getGoogleIdToken`, read `signInWithGoogle`, and make a Google social button call:

```ts
async function handleGoogleLogin() {
  setLoading(true);
  try {
    const idToken = await getGoogleIdToken();
    await signInWithGoogle(idToken);
  } catch (error) {
    Alert.alert("Không thể đăng nhập bằng Google", error instanceof Error ? error.message : "Thử lại sau");
  } finally {
    setLoading(false);
  }
}
```

- [ ] **Step 5: Add Google link action in Settings**

In `client/src/screens/SettingsScreen.tsx`, use `linkGoogle` from auth context and call `getGoogleIdToken()` from a new row labeled `Liên kết Google`.

- [ ] **Step 6: Run client typecheck**

Run:

```powershell
npm.cmd --workspace client run typecheck
```

Expected: pass.

### Task 5: Final Verification

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run full verification**

Run:

```powershell
npm.cmd --workspace server run test
npm.cmd --workspace server run typecheck
npm.cmd --workspace client run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 2: Review git diff**

Run:

```powershell
git status --short
git diff --stat
```

Expected: only planned files and pre-existing user changes are present.

- [ ] **Step 3: Manual smoke test note**

Real Google sign-in requires Google Cloud OAuth client IDs for Web, Android, and iOS. Record that native runtime smoke testing remains pending until those IDs are configured.
