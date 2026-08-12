// §20 PDF Viewer — the "View Question" paper reader.
//
// Uses the app's own curved SubpageHeader so it matches every other subpage, with
// the paper filling the rest of the screen and a floating page counter.
//
// LOCKED TO LIGHT THEME: a scanned paper is almost always dark text on a white
// background; rendering the surrounding chrome in dark mode made the page look
// broken (a bright white rectangle in a dark screen) rather than helping
// readability. This screen pulls `lightColors` directly instead of `useTheme()`,
// deliberately opting out of the user's theme preference for this one screen —
// every other screen must keep using useTheme() as normal.
//
// Theory Desk sets (contentType 'pdf') also get an "Upload your Answer" footer
// button so a student can go straight from reading the question to submitting
// their written answer for review.
import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { lightColors, spacing } from '@/src/core/theme/tokens';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { PdfViewer } from '@/src/components/media/PdfViewer';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';

const colors = lightColors;

export default function PdfViewerScreen() {
  const { id, uri, title, examSetId, sectionName, allowUpload } = useLocalSearchParams<{
    id?: string;
    uri?: string;
    title?: string;
    /** Present only when this paper is a Theory Desk set — enables the upload footer. */
    examSetId?: string;
    sectionName?: string;
    allowUpload?: string;
  }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  // The link arrives either as ?uri=... or as the route id itself.
  const source = uri ?? (id ? decodeURIComponent(id) : undefined);
  const showUploadFooter = allowUpload === '1' && !!examSetId;

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
        <View style={[styles.pageBadge, { bottom: (showUploadFooter ? 84 : 16) + insets.bottom }]}>
          <Ionicons name="layers-outline" size={14} color="#FFF" />
          <Text variant="caption" weight="bold" style={styles.pageText}>
            {page} / {totalPages}
          </Text>
        </View>
      ) : null}

      {showUploadFooter ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm, borderTopColor: colors.border, backgroundColor: colors.surface }]}>
          <Button
            label="Upload your Answer"
            icon={<Ionicons name="cloud-upload-outline" size={18} color={colors.onPrimary} />}
            onPress={() =>
              router.push({
                pathname: '/exam-answer/upload',
                params: { examSetId, examSetTitle: title ?? '', sectionName: sectionName ?? '' },
              } as never)
            }
          />
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
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
