import { describe, expect, it, vi } from "vitest";
import { syncVideoPlayback } from "./videoPlayback";

describe("video playback lifecycle helper", () => {
  it("swallows interrupted play promises so unmounts do not create unhandled rejections", async () => {
    const player = {
      play: vi.fn(() => Promise.reject(new Error("interrupted"))),
      pause: vi.fn()
    };

    syncVideoPlayback(player, true);
    await Promise.resolve();
    await Promise.resolve();

    expect(player.play).toHaveBeenCalledOnce();
    expect(player.pause).not.toHaveBeenCalled();
  });

  it("pauses instead of playing when the item is inactive", () => {
    const player = {
      play: vi.fn(),
      pause: vi.fn()
    };

    syncVideoPlayback(player, false);

    expect(player.pause).toHaveBeenCalledOnce();
    expect(player.play).not.toHaveBeenCalled();
  });
});
