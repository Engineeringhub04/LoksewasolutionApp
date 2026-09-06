// Theory answer details — the student's own submission status page.
//
// Pending: card is a muted, view-only preview (nothing on it is clickable
// except Edit, which only shows inside the 1-hour window) while the answer
// waits for a teacher to check it.
//
// Reviewed: a distinct, premium layout — a gradient result card (score,
// pass/fail), a "Message from our Teacher" note card, a primary "Download
// Your Checked PDF" action, and a secondary "View Your Submitted PDF" so the
// student can still compare their original against the teacher's marked copy.
import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useRefreshOnFocus } from '@/src/core/hooks/useRefreshOnFocus';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { downloadPdfToDevice } from '@/src/core/media/pdfDownload';
import {
  fetchExamAnswer,
  isWithinEditWindow,
  editWindowRemainingMs,
  type ExamAnswer,
} from '@/src/core/firebase/services/examAnswers';

function formatRemaining(ms: number): string {
  const totalMinutes = Math.ceil(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

/** "ExamTitle-Date-LoksewasolutionApp.pdf", with anything unsafe for a filename stripped. */
function buildDownloadFileName(examTitle: string, createdAtMs: number | null): string {
  const safeTitle = (examTitle || 'ExamAnswer').replace(/[\\/:*?"<>|]/g, '').trim().replace(/\s+/g, '-');
  const date = createdAtMs ? new Date(createdAtMs) : new Date();
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `${safeTitle}-${dateStr}-LoksewasolutionApp.pdf`;
}

export default function ExamAnswerDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();

  const [answer, setAnswer] = useState<ExamAnswer | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const result = await fetchExamAnswer(id);
      if (result) setAnswer(result);
      else setNotFound(true);
    } catch {
      showToast('Could not load this submission.', 'error');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Re-check on every focus so returning from the edit flow (or an admin
  // grading it while this screen is backgrounded) shows the latest state.
  useRefreshOnFocus(load);

  const handleDownload = async () => {
    if (!answer || !answer.checkedPdfUrl) return;
    setDownloading(true);
    try {
      const fileName = buildDownloadFileName(answer.examSetTitle, answer.createdAt?.toMillis() ?? null);
      const result = await downloadPdfToDevice(answer.checkedPdfUrl, fileName);
      if (result.saved) {
        showToast('PDF saved to your device.', 'success');
      }
    } catch {
      showToast('Could not download the PDF. Please try again.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SubpageHeader title="Answer Details" />
        <PageLoaderOverlay visible label="Loading…" />
      </View>
    );
  }

  if (notFound || !answer) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SubpageHeader title="Answer Details" />
        <DataNotFound title="Submission not found" description="This answer may have been removed." onRetry={() => router.back()} />
      </View>
    );
  }

  const now = Date.now();
  const isPending = answer.status === 'pending';
  const isReviewed = answer.status === 'reviewed';
  const editable = isPending && isWithinEditWindow(answer.createdAt, now);
  const remaining = editWindowRemainingMs(answer.createdAt, now);
  const resultColor = answer.passed ? '#16A34A' : '#DC2626';

  return (
    <View style={{ flex: 1, backgroundColor: isReviewed ? '#F8FAFC' : colors.background }}>
      <SubpageHeader title="Answer Details" />
      <ScrollView contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.md }}>
        {isReviewed ? (
          // ===== Premium reviewed layout =====
          <>
            <LinearGradient
              colors={answer.passed ? ['#15803D', '#22C55E'] : ['#B91C1C', '#EF4444']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.resultCard, { borderRadius: radius.lg }]}
            >
              <View style={styles.resultIconBadge}>
                <Ionicons name={answer.passed ? 'trophy' : 'ribbon-outline'} size={26} color="#FFF" />
              </View>
              <Text variant="h2" weight="bold" style={{ color: '#FFF', marginTop: spacing.sm }}>
                {answer.passed ? 'Passed' : 'Not Passed'}
              </Text>
              <Text variant="bodySmall" style={{ color: 'rgba(255,255,255,0.85)', marginTop: 2 }} numberOfLines={1}>
                {answer.examSetTitle || 'Theory Answer'}
              </Text>
              <View style={styles.scorePill}>
                <Text variant="bodyLarge" weight="bold" style={{ color: '#FFF' }}>
                  {answer.score} <Text variant="bodySmall" style={{ color: 'rgba(255,255,255,0.8)' }}>/ {answer.fullMarks}</Text>
                </Text>
              </View>
            </LinearGradient>

            {answer.reviewNote ? (
              <View style={[styles.noteCard, { backgroundColor: colors.surface, borderRadius: radius.lg, borderColor: colors.border }]}>
                <View style={styles.noteHeader}>
                  <View style={[styles.noteIconBadge, { backgroundColor: `${resultColor}18` }]}>
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color={resultColor} />
                  </View>
                  <Text variant="bodySmall" weight="bold">Message From Our Teacher</Text>
                </View>
                <Text variant="bodySmall" secondary style={{ lineHeight: 20 }}>{answer.reviewNote}</Text>
              </View>
            ) : null}

            {answer.checkedPdfUrl ? (
              <Button
                label={downloading ? 'Downloading…' : 'Download Your Checked PDF'}
                icon={<Ionicons name="download-outline" size={18} color={colors.onPrimary} />}
                onPress={handleDownload}
                loading={downloading}
              />
            ) : null}

            <Button
              label="View Your Submitted PDF"
              variant="secondary"
              icon={<Ionicons name="document-outline" size={18} color={colors.primary} />}
              onPress={() =>
                router.push({ pathname: '/pdf/[id]', params: { id: answer.id, uri: answer.pdfUrl, title: 'Your Submitted Answer' } } as never)
              }
            />
          </>
        ) : (
          // ===== Pending state — muted, view-only preview =====
          <>
            <View
              style={[styles.card, styles.mutedCard, { backgroundColor: colors.surface, borderRadius: radius.lg, borderColor: colors.border }]}
              pointerEvents="none"
            >
              <Text variant="h3" weight="bold">{answer.examSetTitle || 'Theory Answer'}</Text>
              <Text variant="bodySmall" secondary>{[answer.courseName, answer.subcourseName].filter(Boolean).join(' · ')}</Text>
              <View style={[styles.badge, { backgroundColor: '#D9770622' }]}>
                <Ionicons name="time-outline" size={14} color="#D97706" />
                <Text variant="caption" weight="bold" style={{ color: '#D97706' }}>Pending Review</Text>
              </View>
            </View>

            <Text variant="bodySmall" secondary style={{ textAlign: 'center' }}>
              Your answer PDF has been submitted to our team. Please wait a few days (up to 7 days) — the result will appear here once a teacher has checked it.
            </Text>

            <Button
              label="View my Submitted PDF"
              variant="secondary"
              icon={<Ionicons name="document-outline" size={18} color={colors.primary} />}
              onPress={() =>
                router.push({ pathname: '/pdf/[id]', params: { id: answer.id, uri: answer.pdfUrl, title: 'Your Answer' } } as never)
              }
            />

            {editable ? (
              <>
                <Button
                  label="Edit / Re-upload"
                  variant="secondary"
                  icon={<Ionicons name="create-outline" size={18} color={colors.primary} />}
                  onPress={() =>
                    router.push({
                      pathname: '/exam-answer/upload',
                      params: {
                        examSetId: answer.examSetId,
                        examSetTitle: answer.examSetTitle,
                        sectionName: answer.sectionName,
                        editId: answer.id,
                      },
                    } as never)
                  }
                />
                <Text variant="caption" secondary style={{ textAlign: 'center' }}>
                  You can edit this submission for {formatRemaining(remaining)} more.
                </Text>
              </>
            ) : (
              <Text variant="caption" secondary style={{ textAlign: 'center' }}>
                The 1-hour edit window has closed. Your submission is now locked for review.
              </Text>
            )}
          </>
        )}

        <View style={[styles.helpCard, { borderColor: colors.border, borderRadius: radius.md }]}>
          <Text variant="bodySmall" secondary style={{ textAlign: 'center' }}>
            If something here looks confusing or wrong, please contact our team.
          </Text>
          <Button label="Contact Us" variant="secondary" onPress={() => router.push('/contact-us')} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 6 },
  mutedCard: { opacity: 0.6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, marginTop: 8 },
  helpCard: { borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 10, alignItems: 'center' },
  resultCard: {
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 6,
  },
  resultIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scorePill: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  noteCard: { borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 8 },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noteIconBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
