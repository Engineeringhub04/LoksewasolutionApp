// Admin grading screen for a single Theory answer submission.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/src/core/theme';
import { useRefreshOnFocus } from '@/src/core/hooks/useRefreshOnFocus';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { FloatingLabelField } from '@/src/components/inputs/FloatingLabelField';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PdfViewer } from '@/src/components/media/PdfViewer';
import { pickAnswerPdf } from '@/src/core/media/pdfPicker';
import { uploadPdfToCloudinary } from '@/src/core/media/cloudinary';
import { fetchExamAnswer, reviewExamAnswer, type ExamAnswer } from '@/src/core/firebase/services/examAnswers';

/** Two quick-fill messages the admin can drop in with one tap, both name-tagged. */
function presetMessage(kind: 'pass' | 'fail', name: string): string {
  const who = name || 'Student';
  return kind === 'pass'
    ? `${who}, well done — your answer has been reviewed and meets the required standard. Keep up the good work.`
    : `${who}, your answer has been reviewed. A few areas need more work to meet the required standard — please check the marked points and try again next time.`;
}

/** A small monospace box with a copy button — used for the raw PDF link instead of dumping it as plain wrapped text. */
function LinkCodeBox({ url }: { url: string }) {
  const { colors, spacing, radius } = useTheme();
  const handleCopy = async () => {
    await Clipboard.setStringAsync(url);
    showToast('Link copied.', 'success');
  };
  return (
    <View style={[styles.linkBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderRadius: radius.md }]}>
      <Text variant="caption" numberOfLines={1} style={{ flex: 1, fontFamily: 'monospace' }}>{url}</Text>
      <Pressable onPress={handleCopy} hitSlop={8} style={{ paddingLeft: spacing.sm }}>
        <Ionicons name="copy-outline" size={18} color={colors.primary} />
      </Pressable>
    </View>
  );
}

export default function AdminExamAnswerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [answer, setAnswer] = useState<ExamAnswer | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [scoreText, setScoreText] = useState('');
  const [fullMarksText, setFullMarksText] = useState('100');
  const [passed, setPassed] = useState<boolean | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [noteTouched, setNoteTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  // Two independent fullscreen viewers — the original submission and the
  // teacher's checked copy are different files and must not share one modal.
  const [fullscreenSubmitted, setFullscreenSubmitted] = useState(false);
  const [fullscreenChecked, setFullscreenChecked] = useState(false);

  const [checkedPdfUrl, setCheckedPdfUrl] = useState<string | null>(null);
  const [checkedPdfName, setCheckedPdfName] = useState<string | null>(null);
  const [pickingPdf, setPickingPdf] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const result = await fetchExamAnswer(id);
      if (!result) {
        setNotFound(true);
        return;
      }
      setAnswer(result);
      setScoreText((prev) => (prev === '' ? String(result.score || '') : prev));
      setFullMarksText((prev) => (prev === '100' && result.fullMarks !== 100 ? String(result.fullMarks) : prev));
      setPassed((prev) => (prev === null && result.status === 'reviewed' ? result.passed : prev));
      setReviewNote((prev) => (!noteTouched && prev === '' ? result.reviewNote : prev));
    } catch {
      showToast('Could not load this submission.', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useRefreshOnFocus(load);

  const score = Number(scoreText);
  const fullMarks = Number(fullMarksText);
  const validScore = Number.isFinite(score) && score >= 0;
  const validFullMarks = Number.isFinite(fullMarks) && fullMarks > 0;
  const canSave = validScore && validFullMarks && passed !== null && !saving && score <= fullMarks;

  const displayName = useMemo(() => {
    if (!answer) return '';
    if (answer.profileName && answer.profileName !== answer.studentName) {
      return `${answer.studentName} (${answer.profileName})`;
    }
    return answer.studentName || answer.profileName;
  }, [answer]);

  const applyPreset = (kind: 'pass' | 'fail') => {
    setPassed(kind === 'pass');
    setReviewNote(presetMessage(kind, answer?.profileName || answer?.studentName || ''));
    setNoteTouched(true);
  };

  const handlePickCheckedPdf = async () => {
    try {
      const picked = await pickAnswerPdf();
      if (!picked) return;
      setPickingPdf(true);
      const url = await uploadPdfToCloudinary(picked.uri, picked.name);
      setCheckedPdfUrl(url);
      setCheckedPdfName(picked.name);
    } catch {
      showToast('Could not upload the checked PDF. Please try again.', 'error');
    } finally {
      setPickingPdf(false);
    }
  };

  const handleConfirmedUpdate = async () => {
    if (!id || !canSave) return;
    setConfirmVisible(false);
    setSaving(true);
    try {
      await reviewExamAnswer(id, {
        score,
        fullMarks,
        passed: passed ?? false,
        reviewNote: reviewNote.trim(),
        ...(checkedPdfUrl ? { checkedPdfUrl } : {}),
      });

      showToast('Submission graded and updated.', 'success');
      router.back();
    } catch {
      showToast('Could not save the grade. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SubpageHeader title="Answer Update" showThemeToggle={false} />
        <PageLoaderOverlay visible label="Loading…" />
      </View>
    );
  }

  if (notFound || !answer) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SubpageHeader title="Answer Update" showThemeToggle={false} />
        <DataNotFound title="Submission not found" description="This answer may have been removed." onRetry={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubpageHeader title="Answer Update" showThemeToggle={false} />
      <ScrollView contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        {/* Student details */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.lg, borderColor: colors.border }]}>
          <Text variant="h3" weight="bold">{displayName || 'Unnamed student'}</Text>
          {answer.email ? <Text variant="bodySmall" secondary>{answer.email}</Text> : null}
          <Text variant="bodySmall" secondary>{[answer.courseName, answer.subcourseName].filter(Boolean).join(' · ')}</Text>
          <Text variant="caption" secondary>{answer.examSetTitle || 'Untitled paper'}</Text>

          {answer.message ? (
            <View style={{ marginTop: spacing.sm }}>
              <Text variant="bodySmall" weight="semiBold">Student's message</Text>
              <Text variant="bodySmall" secondary>{answer.message}</Text>
            </View>
          ) : null}
        </View>

        {/* Score */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <FloatingLabelField label="Score" value={scoreText} onChangeText={setScoreText} keyboardType="numeric" containerStyle={{ flex: 1 }} />
          <FloatingLabelField label="Full Marks" value={fullMarksText} onChangeText={setFullMarksText} keyboardType="numeric" containerStyle={{ flex: 1 }} />
        </View>

        {/* Custom message + Pass/Fail presets */}
        <View>
          <Text variant="bodySmall" weight="semiBold" style={{ marginBottom: spacing.xs }}>
            Custom message to student
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
            <Button label="Pass" variant={passed === true ? 'primary' : 'secondary'} onPress={() => applyPreset('pass')} style={{ flex: 1 }} />
            <Button label="Fail" variant={passed === false ? 'danger' : 'secondary'} onPress={() => applyPreset('fail')} style={{ flex: 1 }} />
          </View>
          <FloatingLabelField
            label="Message"
            value={reviewNote}
            onChangeText={(v) => {
              setReviewNote(v);
              setNoteTouched(true);
            }}
            multiline
            numberOfLines={4}
            style={{ minHeight: 100, textAlignVertical: 'top' }}
          />
        </View>

        {/* Submitted PDF: link as a copyable code box + preview + fullscreen */}
        <View>
          <Text variant="bodySmall" weight="semiBold" style={{ marginBottom: spacing.xs }}>
            Submitted PDF
          </Text>
          <LinkCodeBox url={answer.pdfUrl} />
          {/* fullscreenSubmitted only toggles this card's height/chrome — the
             PdfViewer below is the ONE AND ONLY instance for this file. A
             second WebView mounted in a Modal would force pdf.js to
             re-download and re-render the same document from scratch. */}
          <View style={[styles.pdfCard, { borderColor: colors.border, borderRadius: radius.lg, marginTop: spacing.sm }, fullscreenSubmitted ? styles.pdfCardFullscreen : null]}>
            <View style={{ flex: 1 }}>
              <PdfViewer uri={answer.pdfUrl} />
            </View>
            {!fullscreenSubmitted ? (
              <Button
                label="Fullscreen"
                variant="secondary"
                icon={<Ionicons name="expand-outline" size={16} color={colors.primary} />}
                onPress={() => setFullscreenSubmitted(true)}
                style={{ margin: spacing.sm }}
              />
            ) : (
              <Pressable onPress={() => setFullscreenSubmitted(false)} style={[styles.closeButton, { top: insets.top + 12 }]} accessibilityLabel="Close fullscreen">
                <Ionicons name="close" size={22} color="#FFF" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Teacher's checked/marked copy — this is the file the student downloads once reviewed. */}
        <View>
          <Text variant="bodySmall" weight="semiBold" style={{ marginBottom: spacing.xs }}>
            Checked PDF
          </Text>
          <Text variant="caption" secondary style={{ marginBottom: spacing.xs }}>
            Upload your checked/marked copy of the student's answer sheet. This is what the student will download.
          </Text>
          <Button
            label={pickingPdf ? 'Uploading…' : checkedPdfUrl ? 'Change file' : 'Upload Checked PDF'}
            variant="secondary"
            icon={<Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />}
            onPress={handlePickCheckedPdf}
            disabled={saving || pickingPdf}
            loading={pickingPdf}
          />
          {checkedPdfName ? (
            <View style={[styles.filePill, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}>
              <Ionicons name="document-outline" size={16} color={colors.primary} />
              <Text variant="bodySmall" numberOfLines={1} style={{ flex: 1 }}>{checkedPdfName}</Text>
            </View>
          ) : null}
          {checkedPdfUrl ? (
            <View style={[styles.pdfCard, { borderColor: colors.border, borderRadius: radius.lg, marginTop: spacing.sm }, fullscreenChecked ? styles.pdfCardFullscreen : null]}>
              <View style={{ flex: 1 }}>
                <PdfViewer uri={checkedPdfUrl} />
              </View>
              {!fullscreenChecked ? (
                <Button
                  label="Fullscreen"
                  variant="secondary"
                  icon={<Ionicons name="expand-outline" size={16} color={colors.primary} />}
                  onPress={() => setFullscreenChecked(true)}
                  style={{ margin: spacing.sm }}
                />
              ) : (
                <Pressable onPress={() => setFullscreenChecked(false)} style={[styles.closeButton, { top: insets.top + 12 }]} accessibilityLabel="Close fullscreen">
                  <Ionicons name="close" size={22} color="#FFF" />
                </Pressable>
              )}
            </View>
          ) : null}
        </View>

        <Button
          label={saving ? 'Saving…' : 'Update'}
          onPress={() => setConfirmVisible(true)}
          disabled={!canSave || saving}
          loading={saving}
        />
      </ScrollView>

      <ConfirmDialog
        visible={confirmVisible}
        title="Confirm Update"
        message={`This will mark the submission as reviewed and notify the student's status has changed. Score: ${scoreText || 0}/${fullMarksText || 0}, Result: ${passed ? 'Pass' : 'Fail'}.`}
        confirmLabel="Update"
        cancelLabel="Cancel"
        onConfirm={handleConfirmedUpdate}
        onCancel={() => setConfirmVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 4 },
  pdfCard: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', height: 360 },
  pdfCardFullscreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    height: undefined,
    zIndex: 50,
    borderWidth: 0,
    borderRadius: 0,
    margin: 0,
  },
  filePill: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, marginTop: 10 },
  linkBox: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 8 },
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
});
