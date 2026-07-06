type VideoPlaybackPlayer = {
  play: () => void | Promise<unknown>;
  pause: () => void;
};

export function syncVideoPlayback(player: VideoPlaybackPlayer, active: boolean) {
  if (!active) {
    player.pause();
    return;
  }

  const playResult = player.play();
  if (playResult && typeof (playResult as Promise<unknown>).catch === "function") {
    (playResult as Promise<unknown>).catch(() => {
      // Web video play can be interrupted when virtualized feed cells unmount.
    });
  }
}
