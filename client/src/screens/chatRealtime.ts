import type { ChatMessage } from "../types/api";

export function appendUniqueMessage(current: ChatMessage[], incoming: ChatMessage) {
  if (current.some((message) => message.id === incoming.id)) {
    return current;
  }

  return [...current, incoming];
}
