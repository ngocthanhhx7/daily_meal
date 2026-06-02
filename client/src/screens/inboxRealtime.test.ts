import { describe, expect, it } from "vitest";
import type { Conversation } from "../types/api";
import { upsertRealtimeConversation } from "./inboxRealtime";

function conversation(id: string, body: string, updatedAt: string): Conversation {
  return {
    id,
    participants: [],
    otherUser: {
      id: `other-${id}`,
      displayName: `User ${id}`,
      isPremium: false
    },
    lastMessage: {
      body,
      sentAt: updatedAt
    },
    updatedAt
  };
}

describe("upsertRealtimeConversation", () => {
  it("moves an updated conversation to the top without duplicating it", () => {
    const current = [
      conversation("older", "old", "2026-06-03T01:00:00.000Z"),
      conversation("target", "before", "2026-06-03T01:01:00.000Z")
    ];
    const incoming = conversation("target", "new message", "2026-06-03T01:02:00.000Z");

    expect(upsertRealtimeConversation(current, incoming)).toEqual([
      incoming,
      current[0]
    ]);
  });

  it("inserts a new realtime conversation at the top", () => {
    const current = [conversation("existing", "old", "2026-06-03T01:00:00.000Z")];
    const incoming = conversation("new", "hello", "2026-06-03T01:03:00.000Z");

    expect(upsertRealtimeConversation(current, incoming)).toEqual([
      incoming,
      current[0]
    ]);
  });
});
