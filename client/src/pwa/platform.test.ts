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
