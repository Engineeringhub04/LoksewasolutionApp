// Wraps AuthHeader + a scrollable body so the header stays FIXED in place while
// only the body scrolls underneath it — the body's top edge visually slides
// behind the header as the user scrolls up, instead of the header scrolling
// away together with the content (which is what happened before this fix).
import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, type LayoutChangeEvent, type ScrollViewProps } from 'react-native';
import { AuthHeader } from './AuthHeader';

interface AuthScreenLayoutProps {
  title: string;
  subtitle: string;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
  scrollViewProps?: ScrollViewProps;
}

const OVERLAP = 22;

export function AuthScreenLayout({ title, subtitle, onBack, rightSlot, children, scrollViewProps }: AuthScreenLayoutProps) {
  const [headerHeight, setHeaderHeight] = useState(0);

  return (
    <View style={styles.container}>
      {/* Scrollable body — starts just under the header, slides behind it on scroll */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight > 0 ? headerHeight - OVERLAP : 0 },
        ]}
        keyboardShouldPersistTaps="handled"
        {...scrollViewProps}
      >
        <View style={styles.body}>{children}</View>
      </ScrollView>

      {/* Fixed header — always on top, never scrolls */}
      <View style={styles.headerWrap} onLayout={(e: LayoutChangeEvent) => setHeaderHeight(e.nativeEvent.layout.height)}>
        <AuthHeader title={title} subtitle={subtitle} onBack={onBack} rightSlot={rightSlot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  body: { paddingHorizontal: 24, paddingTop: 28 },
  headerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});
