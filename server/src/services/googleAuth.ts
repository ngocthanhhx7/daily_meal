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
