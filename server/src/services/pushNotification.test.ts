import { describe, expect, it } from "vitest";
import { createWebPushPayload } from "./pushNotification.js";

describe("createWebPushPayload", () => {
  it("adds an Inbox URL for message notifications", () => {
    expect(JSON.parse(createWebPushPayload("Tin nhắn mới", "Xin chào", { type: "message" }))).toMatchObject({
      title: "Tin nhắn mới",
      body: "Xin chào",
      data: {
        type: "message",
        url: "/?screen=Inbox"
      }
    });
  });

  it("keeps an explicit URL when one is provided", () => {
    expect(JSON.parse(createWebPushPayload("Daily Meal", "Có thông báo", { url: "/?screen=Notifications" }))).toMatchObject({
      data: {
        url: "/?screen=Notifications"
      }
    });
  });
});
