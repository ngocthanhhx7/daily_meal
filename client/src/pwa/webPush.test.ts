import { describe, expect, it } from "vitest";
import type { PwaEnvironment } from "./platform";
import { getWebPushReadiness, shouldAutoRequestWebPushPermission } from "./webPush";

const baseEnvironment: PwaEnvironment = {
  isWeb: true,
  isIos: true,
  isSafari: true,
  isStandalone: true,
  isInstallCapableIosSafari: true,
  isIosInAppBrowser: false
};

function readiness(overrides: Partial<Parameters<typeof getWebPushReadiness>[0]> = {}) {
  return getWebPushReadiness({
    environment: baseEnvironment,
    hasNotification: true,
    hasServiceWorker: true,
    hasPushManager: true,
    permission: "default",
    publicKey: "public-key",
    ...overrides
  });
}

describe("getWebPushReadiness", () => {
  it("requires iOS web apps to be launched from Home Screen", () => {
    expect(
      readiness({
        environment: { ...baseEnvironment, isStandalone: false }
      })
    ).toBe("install-required");
  });

  it("requires a user permission action before registration", () => {
    expect(readiness({ permission: "default" })).toBe("needs-permission");
  });

  it("is ready when the PWA is standalone, permission is granted, and VAPID key exists", () => {
    expect(readiness({ permission: "granted" })).toBe("ready");
  });

  it("detects missing VAPID public key", () => {
    expect(readiness({ publicKey: "" })).toBe("missing-public-key");
  });
});

describe("shouldAutoRequestWebPushPermission", () => {
  it("auto-prompts only once when permission is still undecided", () => {
    expect(
      shouldAutoRequestWebPushPermission({
        readiness: "needs-permission",
        hasAutoRequested: false
      })
    ).toBe(true);

    expect(
      shouldAutoRequestWebPushPermission({
        readiness: "needs-permission",
        hasAutoRequested: true
      })
    ).toBe(false);
  });

  it("does not auto-prompt when the browser permission was denied", () => {
    expect(
      shouldAutoRequestWebPushPermission({
        readiness: "permission-denied",
        hasAutoRequested: false
      })
    ).toBe(false);
  });
});
