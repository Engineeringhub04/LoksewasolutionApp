// Theory answer details — the student's own submission status page.
//
// Pending: card is a muted, view-only preview (nothing on it is clickable
// except Edit, which only shows inside the 1-hour window) while the answer
// waits for a teacher to check it. Reviewed: shows the admin's score,
// pass/fail, custom message, and a Download PDF button that saves the
// (possibly admin-replaced) file to the phone under a clean custom name.
import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
    if (!answer) return;
    setDownloading(true);
    try {
      const fileName = buildDownloadFileName(answer.examSetTitle, answer.createdAt?.toMillis() ?? null);
      const result = await downloadPdfToDevice(answer.pdfUrl, fileName);
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
  const editable = isPending && isWithinEditWindow(answer.createdAt, now);
  const remaining = editWindowRemainingMs(answer.createdAt, now);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubpageHeader title="Answer Details" />
      <ScrollView contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.md }}>
        {/*
          Pending submissions render as a muted, view-only preview — nothing
          inside this card is interactive. Only the Edit button below (shown
          separately, only inside the 1-hour window) can change anything.
        */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderRadius: radius.lg, borderColor: colors.border },
            isPending ? styles.mutedCard : null,
          ]}
          pointerEvents={isPending ? 'none' : 'auto'}
        >
          <Text variant="h3" weight="bold">{answer.examSetTitle || 'Theory Answer'}</Text>
          <Text variant="bodySmall" secondary>{[answer.courseName, answer.subcourseName].filter(Boolean).join(' · ')}</Text>

          {isPending ? (
            <View style={[styles.badge, { backgroundColor: '#D9770622' }]}>
              <Ionicons name="time-outline" size={14} color="#D97706" />
              <Text variant="caption" weight="bold" style={{ color: '#D97706' }}>Pending Review</Text>
            </View>
          ) : (
            <View style={[styles.badge, { backgroundColor: (answer.passed ? colors.success : colors.error) + '22' }]}>
              <Ionicons name={answer.passed ? 'checkmark-circle-outline' : 'close-circle-outline'} size={14} color={answer.passed ? colors.success : colors.error} />
              <Text variant="caption" weight="bold" style={{ color: answer.passed ? colors.success : colors.error }}>
                {answer.passed ? 'Passed' : 'Not Passed'} · {answer.score}/{answer.fullMarks}
              </Text>
            </View>
          )}

          {answer.status === 'reviewed' && answer.reviewNote ? (
            <View style={{ marginTop: spacing.sm }}>
              <Text variant="bodySmall" weight="semiBold">Message from our team</Text>
              <Text variant="bodySmall" secondary>{answer.reviewNote}</Text>
            </View>
          ) : null}
        </View>

        {isPending ? (
          <Text variant="bodySmall" secondary style={{ textAlign: 'center' }}>
            Hjr ko Answer PDF file hamro team sanga submit vaisakeko cha. Kehi din wait garnus (upto 7 days) — hamro team le check garepachi result yehi page ma dekhincha.
          </Text>
        ) : null}

        {answer.status === 'reviewed' ? (
          <Button
            label={downloading ? 'Downloading…' : 'Download PDF'}
            icon={<Ionicons name="download-outline" size={18} color={colors.onPrimary} />}
            onPress={handleDownload}
            loading={downloading}
          />
        ) : (
          <Button
            label="View my PDF"
            variant="secondary"
            icon={<Ionicons name="document-outline" size={18} color={colors.primary} />}
            onPress={() =>
              router.push({ pathname: '/pdf/[id]', params: { id: answer.id, uri: answer.pdfUrl, title: 'Your Answer' } } as never)
            }
          />
        )}

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
        ) : isPending ? (
          <Text variant="caption" secondary style={{ textAlign: 'center' }}>
            The 1-hour edit window has closed. Your submission is now locked for review.
          </Text>
        ) : null}

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
});
