// §20 PDF Viewer — the "View Question" paper reader.
//
// Uses the app's own curved SubpageHeader so it matches every other subpage, with
// the paper filling the rest of the screen and a floating page counter.
import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { PdfViewer } from '@/src/components/media/PdfViewer';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';

export default function PdfViewerScreen() {
  const { id, uri, title } = useLocalSearchParams<{ id?: string; uri?: string; title?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  // The link arrives either as ?uri=... or as the route id itself.
  const source = uri ?? (id ? decodeURIComponent(id) : undefined);

  const handlePageChange = useCallback((current: number, total: number) => {
    setPage(current);
    if (total) setTotalPages(total);
  }, []);

  if (!source || !/^https?:\/\//i.test(source)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SubpageHeader title="Question Paper" />
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
      <SubpageHeader title={title ?? 'Question Paper'} />

      <PdfViewer uri={source} onPageChange={handlePageChange} />

      {/* Page indicator — the main orientation cue while scrolling. */}
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
  pageBadge: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.9)',
  },
  pageText: { color: '#FFF' },
});
