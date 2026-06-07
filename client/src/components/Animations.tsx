import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, type ViewStyle, type StyleProp } from "react-native";

// ─── Animated Pressable with bounce effect ───────────────────────────
export function BouncePress({
  children,
  onPress,
  style,
  hitSlop,
  disabled
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.spring(scale, {
      toValue: 0.92,
      friction: 6,
      tension: 200,
      useNativeDriver: true
    }).start();
  }

  function handlePressOut() {
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 180,
      useNativeDriver: true
    }).start();
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={hitSlop}
      disabled={disabled}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// ─── Fade-in + slide-up entrance ─────────────────────────────────────
export function FadeSlideIn({
  children,
  delay = 0,
  duration = 400,
  slideDistance = 20,
  style
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  slideDistance?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(slideDistance)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start();
  }, []);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

// ─── Scale-in entrance (pop effect) ──────────────────────────────────
export function ScaleIn({
  children,
  delay = 0,
  duration = 350,
  style
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 120,
        delay,
        useNativeDriver: true
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: duration * 0.6,
        delay,
        useNativeDriver: true
      })
    ]).start();
  }, []);

  return (
    <Animated.View style={[style, { opacity, transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
}

// ─── Heart bounce animation (like button) ────────────────────────────
export function useHeartBounce() {
  const scale = useRef(new Animated.Value(1)).current;

  function bounce() {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.4,
        duration: 150,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 3,
        tension: 200,
        useNativeDriver: true
      })
    ]).start();
  }

  return { scale, bounce };
}

// ─── Wiggle animation (for stickers, badges) ─────────────────────────
export function Wiggle({
  children,
  active = true,
  style
}: {
  children: React.ReactNode;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      rotation.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(rotation, {
          toValue: 1,
          duration: 120,
          easing: Easing.linear,
          useNativeDriver: true
        }),
        Animated.timing(rotation, {
          toValue: -1,
          duration: 240,
          easing: Easing.linear,
          useNativeDriver: true
        }),
        Animated.timing(rotation, {
          toValue: 0,
          duration: 120,
          easing: Easing.linear,
          useNativeDriver: true
        }),
        Animated.delay(2000)
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  const rotate = rotation.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-6deg", "0deg", "6deg"]
  });

  const flatStyle = StyleSheet.flatten(style) || {};
  const existingTransform = Array.isArray(flatStyle.transform) ? flatStyle.transform : [];

  return (
    <Animated.View style={[style, { transform: [...existingTransform, { rotate }] as any }]}>
      {children}
    </Animated.View>
  );
}

// ─── Staggered list items ────────────────────────────────────────────
export function StaggerItem({
  children,
  index,
  style
}: {
  children: React.ReactNode;
  index: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <FadeSlideIn delay={index * 80} slideDistance={16} style={style}>
      {children}
    </FadeSlideIn>
  );
}

// ─── Pulse animation (for loading, badges) ───────────────────────────
export function Pulse({
  children,
  style
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.08,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
}

// ─── Floating animation (gentle up-down hover) ──────────────────────
export function Float({
  children,
  distance = 6,
  duration = 2000,
  style
}: {
  children: React.ReactNode;
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -distance,
          duration: duration / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(translateY, {
          toValue: distance,
          duration: duration / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View style={[style, { transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
