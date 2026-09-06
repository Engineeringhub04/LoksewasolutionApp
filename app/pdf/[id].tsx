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
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, View, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { lightColors, spacing } from '@/src/core/theme/tokens';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { PdfViewer } from '@/src/components/media/PdfViewer';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import {
  allowScreenCaptureAsync,
  disableAppSwitcherProtectionAsync,
  enableAppSwitcherProtectionAsync,
  preventScreenCaptureAsync,
} from 'expo-screen-capture';

const colors = lightColors;

export default function PdfViewerScreen() {
  const { id, uri, title, examSetId, sectionName, allowUpload, privacyProtected: privacyProtectedParam } = useLocalSearchParams<{
    id?: string;
    uri?: string;
    title?: string;
    /** Present only when this paper is a Theory Desk set — enables the upload footer. */
    examSetId?: string;
    sectionName?: string;
    allowUpload?: string;
    privacyProtected?: string;
  }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  // The link arrives either as ?uri=... or as the route id itself.
  const source = uri ?? (id ? decodeURIComponent(id) : undefined);
  const showUploadFooter = allowUpload === '1' && !!examSetId;
  const privacyProtected = privacyProtectedParam === '1';
  const [contentRestricted, setContentRestricted] = useState(false);

  useEffect(() => {
    if (!privacyProtected) return;

    setContentRestricted(false);
    void preventScreenCaptureAsync('theory-pdf');
    // App-switcher protection is currently available only on iOS in the
    // installed native module. Android uses the privacy overlay below while
    // backgrounded, plus the supported screen-capture prevention call.
    if (Platform.OS === 'ios') {
      void enableAppSwitcherProtectionAsync(1);
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      setContentRestricted(nextState !== 'active');
    });

    return () => {
      subscription.remove();
      void allowScreenCaptureAsync('theory-pdf');
      if (Platform.OS === 'ios') {
        void disableAppSwitcherProtectionAsync();
      }
    };
  }, [privacyProtected]);

  const handlePageChange = useCallback((current: number, total: number) => {
    setPage(current);
    if (total) setTotalPages(total);
  }, []);

  if (!source || !/^https?:\/\//i.test(source)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SubpageHeader title="Question Paper" showThemeToggle={false} />
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
      {/* Only ONE PdfViewer instance ever exists on this screen — toggling
         fullscreen just hides/shows the header and footer chrome around it
         instead of mounting a second WebView. A second instance would
         re-download and re-render the same document from scratch (visible as
         the "Preparing pages…" spinner flashing again), even though the bytes
         are cached, because pdf.js has to redo all of its canvas rendering
         work for a brand new WebView. */}
      {!fullscreen ? (
        <SubpageHeader
          title={title ?? 'Question Paper'}
          showThemeToggle={false}
          rightSlot={
            <Pressable onPress={() => setFullscreen(true)} style={styles.headerIconBox} accessibilityLabel="Fullscreen">
              <Ionicons name="expand-outline" size={20} color="#FFF" />
            </Pressable>
          }
        />
      ) : null}

      <PdfViewer uri={source} onPageChange={handlePageChange} />

      {/* Page indicator — the main orientation cue while scrolling. */}
      {totalPages > 0 ? (
        <View style={[styles.pageBadge, { bottom: (fullscreen ? 16 : showUploadFooter ? 84 : 16) + insets.bottom }]}>
          <Ionicons name="layers-outline" size={14} color="#FFF" />
          <Text variant="caption" weight="bold" style={styles.pageText}>
            {page} / {totalPages}
          </Text>
        </View>
      ) : null}

      {showUploadFooter && !fullscreen ? (
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

      {fullscreen ? (
        <Pressable
          onPress={() => setFullscreen(false)}
          style={[styles.closeButton, { top: insets.top + 12 }]}
          accessibilityLabel="Close fullscreen"
        >
          <Ionicons name="close" size={22} color="#FFF" />
        </Pressable>
      ) : null}

      {privacyProtected && contentRestricted ? (
        <View style={styles.restrictedOverlay} pointerEvents="none">
          <Ionicons name="shield-checkmark-outline" size={42} color="#FFF" />
          <Text variant="h2" weight="bold" style={styles.restrictedTitle}>
            This Content is Restricted
          </Text>
          <Text variant="bodySmall" style={styles.restrictedMessage}>
            Return to the app to continue viewing this theory paper.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
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
  closeButton: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15,23,42,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restrictedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  restrictedTitle: {
    color: '#FFF',
    textAlign: 'center',
    marginTop: 14,
  },
  restrictedMessage: {
    color: '#E5E7EB',
    textAlign: 'center',
    marginTop: 8,
  },
});
