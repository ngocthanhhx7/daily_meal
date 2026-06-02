import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../types/api";
import { appendUniqueMessage } from "./chatRealtime";

function message(id: string, body: string): ChatMessage {
  return {
    id,
    conversationId: "conversation-1",
    sender: {
      id: "user-1",
      displayName: "Tester",
      isPremium: false
    },
    body,
    createdAt: "2026-06-03T01:00:00.000Z"
  };
}

describe("appendUniqueMessage", () => {
  it("appends a new message", () => {
    const current = [message("m1", "first")];
    const incoming = message("m2", "second");

    expect(appendUniqueMessage(current, incoming)).toEqual([...current, incoming]);
  });

  it("keeps the current list when the message already exists", () => {
    const existing = message("m1", "first");

    expect(appendUniqueMessage([existing], existing)).toEqual([existing]);
  });
});
