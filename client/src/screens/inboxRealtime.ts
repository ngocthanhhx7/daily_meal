import type { Conversation } from "../types/api";

export function upsertRealtimeConversation(current: Conversation[], incoming: Conversation) {
  return [
    incoming,
    ...current.filter((conversation) => conversation.id !== incoming.id)
  ];
}
