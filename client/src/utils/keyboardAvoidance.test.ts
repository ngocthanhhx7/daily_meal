import { describe, expect, test } from "vitest";
import { getKeyboardAvoidingBehavior } from "./keyboardAvoidance";

describe("keyboard avoidance policy", () => {
  test("uses position on iOS so the root screen is not resized by keyboard padding", () => {
    expect(getKeyboardAvoidingBehavior("ios")).toBe("position");
  });

  test("does not alter layout on non-iOS platforms", () => {
    expect(getKeyboardAvoidingBehavior("android")).toBeUndefined();
    expect(getKeyboardAvoidingBehavior("web")).toBeUndefined();
  });
});
