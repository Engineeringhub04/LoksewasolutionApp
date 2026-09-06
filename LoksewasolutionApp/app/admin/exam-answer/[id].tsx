// Admin grading screen for a single Theory answer submission.
//
// Layout follows the spec exactly: student details (name/course/subcourse) ->
// their message -> Score input -> a custom reviewer message with Pass/Fail
// presets that auto-fill a professional, name-tagged note -> the PDF link ->
// an embedded PDF viewer (with a fullscreen modal) -> a re-upload slot for a
// corrected/annotated PDF -> Update, gated behind a confirmation dialog.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, Modal, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
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

export default function AdminExamAnswerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
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
  const [fullscreen, setFullscreen] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  // A freshly-picked replacement PDF, already uploaded to Cloudinary the
  // moment it's picked (not deferred to Update) — this gives it a real HTTPS
  // URL so the preview below can render through the same PdfViewer used
  // everywhere else, instead of trying to preview an unfetchable local
  // file:// URI.
  const [newPdfUrl, setNewPdfUrl] = useState<string | null>(null);
  const [newPdfName, setNewPdfName] = useState<string | null>(null);
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

  const handlePickNewPdf = async () => {
    try {
      const picked = await pickAnswerPdf();
      if (!picked) return;
      setPickingPdf(true);
      const url = await uploadPdfToCloudinary(picked.uri, picked.name);
      setNewPdfUrl(url);
      setNewPdfName(picked.name);
    } catch {
      showToast('Could not upload the new PDF. Please try again.', 'error');
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
        ...(newPdfUrl ? { pdfUrl: newPdfUrl } : {}),
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
        <SubpageHeader title="Answer Update" />
        <PageLoaderOverlay visible label="Loading…" />
      </View>
    );
  }

  if (notFound || !answer) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SubpageHeader title="Answer Update" />
        <DataNotFound title="Submission not found" description="This answer may have been removed." onRetry={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubpageHeader title="Answer Update" />
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

        {/* Existing PDF link + viewer */}
        <View>
          <Text variant="bodySmall" weight="semiBold" style={{ marginBottom: spacing.xs }}>
            Submitted PDF
          </Text>
          <Text variant="caption" secondary numberOfLines={1} style={{ marginBottom: spacing.xs }}>
            {answer.pdfUrl}
          </Text>
          <View style={[styles.pdfCard, { borderColor: colors.border, borderRadius: radius.lg }]}>
            <View style={{ height: 360 }}>
              <PdfViewer uri={answer.pdfUrl} />
            </View>
            <Button
              label="Fullscreen"
              variant="secondary"
              icon={<Ionicons name="expand-outline" size={16} color={colors.primary} />}
              onPress={() => setFullscreen(true)}
              style={{ margin: spacing.sm }}
            />
          </View>
        </View>

        {/* Re-upload a corrected/annotated PDF */}
        <View>
          <Text variant="bodySmall" weight="semiBold" style={{ marginBottom: spacing.xs }}>
            Replace PDF (optional)
          </Text>
          <Button
            label={pickingPdf ? 'Uploading…' : newPdfUrl ? 'Change file' : 'Upload a new PDF'}
            variant="secondary"
            icon={<Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />}
            onPress={handlePickNewPdf}
            disabled={saving || pickingPdf}
            loading={pickingPdf}
          />
          {newPdfName ? (
            <View style={[styles.filePill, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}>
              <Ionicons name="document-outline" size={16} color={colors.primary} />
              <Text variant="bodySmall" numberOfLines={1} style={{ flex: 1 }}>{newPdfName}</Text>
            </View>
          ) : null}
          {newPdfUrl ? (
            <View style={[styles.pdfCard, { borderColor: colors.border, borderRadius: radius.lg, marginTop: spacing.sm }]}>
              <View style={{ height: 260 }}>
                <PdfViewer uri={newPdfUrl} />
              </View>
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

      <Modal visible={fullscreen} animationType="slide" onRequestClose={() => setFullscreen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <SubpageHeader title={displayName || 'Answer PDF'} onBackPress={() => setFullscreen(false)} />
          <PdfViewer uri={answer.pdfUrl} />
        </View>
      </Modal>

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
  pdfCard: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  filePill: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, marginTop: 10 },
});
