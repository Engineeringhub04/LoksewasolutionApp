// Full-height scrollable wrapper for "there is nothing here" states.
//
// Empty/error states used to be rendered as a plain centred <View>, which meant
// those screens had NO pull-to-refresh exactly when the user most wants it —
// when the page is empty and they're trying to make data appear. Wrapping the
// state in a scroll view (with flexGrow so it still centres) keeps the gesture
// available while the content stays vertically centred.
import React from 'react';
import { ScrollView, type StyleProp, type ViewStyle } from 'react-native';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';

interface RefreshableCenterProps {
  children: React.ReactNode;
  refreshing: boolean;
  onRefresh: () => void;
  /** For screens whose header is a fixed overlay (Home/Profile). */
  progressViewOffset?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export function RefreshableCenter({
  children,
  refreshing,
  onRefresh,
  progressViewOffset,
  contentContainerStyle,
}: RefreshableCenterProps) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[{ flexGrow: 1, justifyContent: 'center' }, contentContainerStyle]}
      refreshControl={
        <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} progressViewOffset={progressViewOffset} />
      }
    >
      {children}
    </ScrollView>
  );
}
