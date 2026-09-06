// Bottom Navigation (PRD §8.3, §16): Home, Exam, Discussion, Profile.
import React from 'react';
import { Tabs } from 'expo-router';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { GlassTabBar } from '@/src/components/nav/GlassTabBar';

export default function TabLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        headerShown: false,
        // The glass bar floats over the screen; the navigator itself must not
        // paint a white/dark rectangular strip behind it.
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        // Bottom-tab switches can't show a preloader, so they cross-fade
        // instead of hard-cutting between screens.
        animation: 'fade',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.home'),
        }}
      />
      <Tabs.Screen
        name="exam"
        options={{
          title: t('nav.exam'),
        }}
      />
      <Tabs.Screen
        name="discussion"
        options={{
          title: t('nav.discussion'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('nav.profile'),
        }}
      />
    </Tabs>
  );
}
