// §20 PDF Viewer — full-screen paper reader.
//
// The header is deliberately minimal and can be tapped away, so the paper gets
// the whole screen: tap anywhere to toggle the chrome, exactly like a reader app.
import React, { useCallback, useState } from 'react';
import { View, Pressable, StyleSheet, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { PdfViewer } from '@/src/components/media/PdfViewer';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';

export default function PdfViewerScreen() {
  const { id, uri, title } = useLocalSearchParams<{ id?: string; uri?: string; title?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [chromeVisible, setChromeVisible] = useState(true);

  // The link can arrive either as ?uri=... or as the route id itself (the Exam
  // tab pushes /pdf/<encoded-url> for theory papers).
  const source = uri ?? (id ? decodeURIComponent(id) : undefined);

  const handlePageChange = useCallback((current: number, total: number) => {
    setPage(current);
    if (total) setTotalPages(total);
  }, []);

  if (!source || !/^https?:\/\//i.test(source)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <DataNotFound
          title="No paper attached"
          description="This set does not have a question paper uploaded yet."
          onRetry={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />

      {/* The viewer fills the screen; the toolbar floats over it and is collapsed
          with its own button rather than a full-screen tap layer, which would
          swallow the document's scroll and pinch gestures. */}
      <PdfViewer uri={source} onPageChange={handlePageChange} />

      {chromeVisible ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(180)}
          style={[styles.header, { paddingTop: insets.top + 8 }]}
          pointerEvents="box-none"
        >
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconButton} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={20} color="#FFF" />
          </Pressable>

          <View style={styles.titleBlock}>
            <View style={styles.titleRow}>
              {/* Exam icon alongside the title, as requested. */}
              <Ionicons name="document-text" size={16} color="#FFF" />
              <Text variant="bodySmall" weight="bold" style={styles.title} numberOfLines={1}>
                {title ?? 'Question Paper'}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => setChromeVisible(false)}
            hitSlop={10}
            style={styles.iconButton}
            accessibilityLabel="Hide toolbar"
          >
            <Ionicons name="contract-outline" size={18} color="#FFF" />
          </Pressable>
        </Animated.View>
      ) : (
        <Pressable
          onPress={() => setChromeVisible(true)}
          style={[styles.showChromeButton, { top: insets.top + 8 }]}
          accessibilityLabel="Show toolbar"
        >
          <Ionicons name="expand-outline" size={18} color="#FFF" />
        </Pressable>
      )}

      {/* Page indicator — always visible, since it's the main orientation cue. */}
      {totalPages > 0 ? (
        <View style={[styles.pageBadge, { bottom: insets.bottom + 16 }]}>
          <Ionicons name="layers-outline" size={14} color="#FFF" />
          <Text variant="caption" weight="bold" style={styles.pageText}>
            {page} / {totalPages}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: 'rgba(15,23,42,0.88)',
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: '#FFF', flexShrink: 1 },
  showChromeButton: {
    position: 'absolute',
    left: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(15,23,42,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBadge: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.88)',
  },
  pageText: { color: '#FFF' },
});
