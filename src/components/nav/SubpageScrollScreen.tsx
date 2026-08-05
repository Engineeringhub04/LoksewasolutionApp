// Standard scaffold for a sub-page: curved SubpageHeader (back + theme toggle),
// a scrollable body, and pull-to-refresh — with the same branded spinner as
// every other screen via AppRefreshControl.
//
// Having one scaffold is what makes "every page is scrollable and supports
// pull-to-refresh" true by construction, instead of relying on each new screen
// remembering to wire a RefreshControl.
//
// Screens with real data pass `refreshing` + `onRefresh` from useAsyncData.
// Static content pages pass neither: the gesture still works and shows the
// spinner briefly, so the interaction is consistent app-wide even where there's
// nothing to re-fetch.
import React, { useCallback, useRef, useState } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/core/theme';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';

interface SubpageScrollScreenProps {
  title: string;
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void | Promise<void>;
  /** Pinned below the scroll area (e.g. a Save button). */
  footer?: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export function SubpageScrollScreen({
  title,
  children,
  refreshing,
  onRefresh,
  footer,
  contentContainerStyle,
}: SubpageScrollScreenProps) {
  const { colors, spacing } = useTheme();

  // Fallback refresh for static pages — keeps the gesture available everywhere.
  const [selfRefreshing, setSelfRefreshing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleRefresh = useCallback(() => {
    if (onRefresh) {
      void onRefresh();
      return;
    }
    setSelfRefreshing(true);
    timerRef.current = setTimeout(() => setSelfRefreshing(false), 700);
  }, [onRefresh]);

  const isRefreshing = onRefresh ? Boolean(refreshing) : selfRefreshing;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubpageHeader title={title} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          { padding: spacing.screenPadding, paddingBottom: spacing.xxl, gap: spacing.md },
          contentContainerStyle,
        ]}
        refreshControl={<AppRefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {footer}
    </View>
  );
}
