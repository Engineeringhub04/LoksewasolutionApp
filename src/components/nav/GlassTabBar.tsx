import React, { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/core/theme';

// Keep the floating glass bar compact on both platforms so it leaves the
// final content row visible above the overlay.
export const GLASS_TAB_BAR_HEIGHT = 62;
const HORIZONTAL_MARGIN = 14;
const BOTTOM_GAP = 8;

/** Bottom clearance required by screens whose content scrolls below the glass pill. */
export function getGlassTabBarContentPadding(bottomInset: number) {
  return GLASS_TAB_BAR_HEIGHT + BOTTOM_GAP + 16 + bottomInset;
}

const iconNames = {
  index: { focused: 'home', unfocused: 'home-outline' },
  exam: { focused: 'school', unfocused: 'school-outline' },
  discussion: { focused: 'chatbubbles', unfocused: 'chatbubbles-outline' },
  profile: { focused: 'person', unfocused: 'person-outline' },
} as const;

type IconName = keyof typeof Ionicons.glyphMap;

function getTabLabel(options: BottomTabBarProps['descriptors'][string]['options'], routeName: string) {
  if (typeof options.tabBarLabel === 'string') return options.tabBarLabel;
  if (typeof options.title === 'string') return options.title;
  return routeName;
}

export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, effective, motion } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const barWidth = Math.max(280, width - HORIZONTAL_MARGIN * 2);
  const itemWidth = barWidth / state.routes.length;
  const activeX = useSharedValue(state.index * itemWidth + 4);

  useEffect(() => {
    activeX.value = withTiming(state.index * itemWidth + 4, { duration: motion.standard });
  }, [activeX, itemWidth, motion.standard, state.index]);

  const activePillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: activeX.value }],
  }));

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { height: GLASS_TAB_BAR_HEIGHT + insets.bottom + 12 }]}
    >
      <BlurView
        intensity={effective === 'dark' ? 48 : 62}
        tint={effective === 'dark' ? 'dark' : 'light'}
        experimentalBlurMethod="dimezisBlurView"
        style={[
          styles.bar,
          {
            width: barWidth,
            bottom: insets.bottom + BOTTOM_GAP,
            backgroundColor: effective === 'dark' ? 'rgba(15,23,42,0.76)' : 'rgba(255,255,255,0.78)',
            borderColor: effective === 'dark' ? 'rgba(148,163,184,0.24)' : 'rgba(255,255,255,0.88)',
            // Explicitly remove the top edge on both platforms. BlurView may otherwise
            // render a light separator above the floating pill.
            borderTopWidth: 0,
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activePill,
            activePillStyle,
            {
              width: itemWidth - 8,
              backgroundColor: effective === 'dark' ? 'rgba(59,130,246,0.32)' : 'rgba(37,99,235,0.13)',
              borderColor: effective === 'dark' ? 'rgba(147,197,253,0.28)' : 'rgba(37,99,235,0.16)',
            },
          ]}
        />
        <View style={styles.items}>
          {state.routes.map((route, index) => {
            const descriptor = descriptors[route.key];
            const options = descriptor?.options ?? {};
            const focused = state.index === index;
            const label = getTabLabel(options, route.name);
            const names = iconNames[route.name as keyof typeof iconNames] ?? iconNames.index;
            const icon = (focused ? names.focused : names.unfocused) as IconName;

            const onPress = () => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              }
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({ type: 'tabLongPress', target: route.key });
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                testID={options.tabBarButtonTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                style={({ pressed }) => [styles.item, { width: itemWidth }, pressed && styles.pressed]}
              >
                <Ionicons
                  name={icon}
                  size={21}
                  color={focused ? colors.primary : colors.textSecondary}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.label,
                    {
                      color: focused ? colors.primary : colors.textSecondary,
                      fontWeight: focused ? '700' : '600',
                    },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 20,
  },
  bar: {
    position: 'absolute',
    height: GLASS_TAB_BAR_HEIGHT,
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  topReflection: {
    position: 'absolute',
    top: 0,
    left: 18,
    right: 18,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  activePill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    borderRadius: 23,
    borderWidth: 1,
  },
  items: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.1,
  },
  pressed: {
    opacity: 0.72,
  },
});
