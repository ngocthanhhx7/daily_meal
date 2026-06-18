import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import React, { useEffect, useState } from "react";
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors } from "../theme/colors";
import { AppText } from "./AppText";

type PostVideoPlayerProps = {
  uri: string;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
  showBadge?: boolean;
};

export function PostVideoPlayer({ uri, active = false, style, showBadge = true }: PostVideoPlayerProps) {
  const [muted, setMuted] = useState(true);
  const player = useVideoPlayer({ uri }, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.audioMixingMode = "mixWithOthers";
  });

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    if (active) {
      player.play();
    } else {
      player.pause();
    }
  }, [active, player]);

  return (
    <Pressable style={[styles.wrap, style]} onPress={() => setMuted((current) => !current)}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
      {showBadge ? (
        <View style={styles.badge}>
          <Ionicons name={muted ? "volume-mute" : "volume-high"} size={14} color={colors.white} />
          <AppText variant="caption" style={styles.badgeText}>
            Video
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    backgroundColor: colors.black
  },
  badge: {
    position: "absolute",
    right: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)"
  },
  badgeText: {
    color: colors.white
  }
});
