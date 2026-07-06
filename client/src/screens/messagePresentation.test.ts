import { describe, expect, it } from "vitest";
import { getParticipantAccent, getParticipantAvatarLabel } from "./messagePresentation";

describe("message presentation helpers", () => {
  it("uses the same accent for the same participant across renders", () => {
    expect(getParticipantAccent("user-42")).toBe(getParticipantAccent("user-42"));
  });

  it("uses different accents for common different participants", () => {
    expect(getParticipantAccent("trung-bac-thao")).not.toBe(getParticipantAccent("be-cho-vang"));
  });

  it("falls back to the first uppercase display name character for avatar labels", () => {
    expect(getParticipantAvatarLabel({ displayName: "trung bac thao" })).toBe("T");
  });

  it("uses the default avatar label when no name is available", () => {
    expect(getParticipantAvatarLabel({})).toBe("D");
  });

});
