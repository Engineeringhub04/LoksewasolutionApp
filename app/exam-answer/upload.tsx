// Theory Answer Upload — student picks a PDF of their written answer and
// submits it for admin review. Reached from the "Upload your Answer" footer on
// the View Question (pdf/[id]) screen for Theory Desk papers.
//
// Multiple attempts are not allowed: this screen re-checks for an existing
// submission for this examSetId right before showing the form (not just
// relying on the Exam Hub card already having routed submitted students
// elsewhere), so a stale card or a direct deep-link can't bypass the rule.
import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { FloatingLabelField } from '@/src/components/inputs/FloatingLabelField';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { PdfViewer } from '@/src/components/media/PdfViewer';
import { pickAnswerPdf, MAX_ANSWER_PDF_BYTES, type PickedPdf } from '@/src/core/media/pdfPicker';
import { uploadPdfToCloudinary } from '@/src/core/media/cloudinary';
import { submitExamAnswer, updateMyExamAnswer, fetchMyExamAnswersBySet } from '@/src/core/firebase/services/examAnswers';
import { notifyExamAnswerSubmitted } from '@/src/core/messaging/examAnswerNotify';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ExamAnswerUploadScreen() {
  const { examSetId, examSetTitle, sectionName, editId } = useLocalSearchParams<{
    examSetId?: string;
    examSetTitle?: string;
    sectionName?: string;
    editId?: string;
  }>();
  const isEdit = !!editId;
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const user = useAuthStore((s) => s.user);
  const { profile, courseInfo } = useProfileStore();

  const [fullName, setFullName] = useState(profile?.name ?? user?.displayName ?? '');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<PickedPdf | null>(null);
  const [picking, setPicking] = useState(false);
  // Uploaded to Cloudinary the moment it's picked (not deferred to Submit) so
  // the preview below can render a real HTTPS URL through PdfViewer, same
  // reasoning as the admin screen's Checked PDF preview.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [successVisible, setSuccessVisible] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(!isEdit);

  // Guards against a direct deep-link or stale card letting a student open
  // Upload for a set they've already submitted an answer for.
  useEffect(() => {
    if (isEdit || !user?.uid || !examSetId) {
      setCheckingExisting(false);
      return;
    }
    let cancelled = false;
    fetchMyExamAnswersBySet(user.uid)
      .then((map) => {
        if (!cancelled && map[examSetId]) setAlreadySubmitted(true);
      })
      .finally(() => {
        if (!cancelled) setCheckingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit, user?.uid, examSetId]);

  const courseLabel = useMemo(() => {
    const parts = [courseInfo?.courseName, courseInfo?.subcourseName].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Course not set up';
  }, [courseInfo]);

  const canSubmit = !!previewUrl && fullName.trim().length > 0 && !!examSetId && !submitting && !picking;

  const handlePickFile = async () => {
    try {
      const picked = await pickAnswerPdf();
      if (!picked) return; // user cancelled
      if (picked.size !== null && picked.size > MAX_ANSWER_PDF_BYTES) {
        showToast('That PDF is larger than 8 MB. Please choose a smaller file.', 'error');
        return;
      }
      setFile(picked);
      setPicking(true);
      const url = await uploadPdfToCloudinary(picked.uri, picked.name, setProgress);
      setPreviewUrl(url);
    } catch {
      showToast('Could not upload the PDF. Please try again.', 'error');
      setFile(null);
    } finally {
      setPicking(false);
    }
  };

  const handleSubmit = async () => {
    if (!previewUrl || !user?.uid || !examSetId) return;
    const pdfUrl = previewUrl;

    setSubmitting(true);
    try {
      if (isEdit && editId) {
        // Re-upload during the edit window — only file/message change; status,
        // score and reviewedAt stay whatever the admin already set (see
        // updateMyExamAnswer's doc comment and firebase.rules).
        await updateMyExamAnswer(editId, { pdfUrl, message: message.trim() });
        showToast('Submission updated.', 'success');
        router.back();
        return;
      }

      const newId = await submitExamAnswer({
        uid: user.uid,
        studentName: fullName.trim(),
        profileName: profile?.name ?? user?.displayName ?? fullName.trim(),
        photoURL: profile?.photoURL ?? null,
        email: profile?.email ?? user?.email ?? null,
        courseId: courseInfo?.courseId ?? '',
        courseName: courseInfo?.courseName ?? '',
        subcourseId: courseInfo?.subcourseId ?? '',
        subcourseName: courseInfo?.subcourseName ?? '',
        examSetId,
        examSetTitle: examSetTitle ?? '',
        sectionName: sectionName ?? '',
        message: message.trim(),
        pdfUrl,
      });
      setSubmittedId(newId);

      // Best-effort — a failed Discord ping must never fail the submission itself.
      notifyExamAnswerSubmitted({
        studentName: fullName.trim(),
        courseName: courseInfo?.courseName ?? '',
        subcourseName: courseInfo?.subcourseName ?? '',
        examSetTitle: examSetTitle ?? '',
        message: message.trim(),
        pdfUrl,
      }).catch(() => {});

      setSuccessVisible(true);
    } catch {
      showToast('Upload failed. Check your connection and try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Both "View Details" and hardware/gesture back after a successful submit
  // go to the real details page (replacing this screen in history) instead of
  // back to the question paper — landing back on Upload from the paper screen
  // would let a student submit a second answer for the same set.
  const goToDetails = () => {
    setSuccessVisible(false);
    if (submittedId) {
      router.replace({ pathname: '/exam-answer/[id]', params: { id: submittedId } } as never);
    } else {
      router.back();
    }
  };

  if (checkingExisting) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SubpageHeader title="Upload your Answer" />
        <PageLoaderOverlay visible label="Checking…" />
      </View>
    );
  }

  if (alreadySubmitted) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SubpageHeader title="Upload your Answer" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.screenPadding, gap: spacing.sm }}>
          <Ionicons name="checkmark-done-circle-outline" size={48} color={colors.textSecondary} />
          <Text variant="bodyLarge" weight="bold" style={{ textAlign: 'center' }}>
            You've already submitted an answer for this paper
          </Text>
          <Text variant="bodySmall" secondary style={{ textAlign: 'center' }}>
            Only one submission is allowed per paper. You can view or edit your existing submission from its details page.
          </Text>
          <Button label="View my Submission" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  if (successVisible) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SubpageHeader title="Answer Submitted" showBack={false} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.screenPadding, gap: spacing.md }}>
          <Ionicons name="checkmark-done-circle" size={56} color={colors.success} />
          <Text variant="h3" weight="bold" style={{ textAlign: 'center' }}>Answer Submitted</Text>
          <Text variant="bodySmall" secondary style={{ textAlign: 'center' }}>
            Your answer PDF has been submitted to our team. Please wait a few days (up to 7 days) — once a teacher has checked your answer, the result will appear on this exam's details page, where you can download it.
          </Text>
          <Button label="View Details" onPress={goToDetails} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubpageHeader title={isEdit ? 'Edit your Answer' : 'Upload your Answer'} />

      <ScrollView contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        {examSetTitle ? (
          <View style={[styles.examBadge, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}>
            <Ionicons name="document-text-outline" size={16} color={colors.primary} />
            <Text variant="bodySmall" weight="semiBold" numberOfLines={1} style={{ flex: 1 }}>
              {examSetTitle}
            </Text>
          </View>
        ) : null}

        <FloatingLabelField label="Full Name" value={fullName} onChangeText={setFullName} leftIcon="person-outline" />

        <View style={[styles.readonlyRow, { borderColor: colors.border, borderRadius: radius.md }]}>
          <Ionicons name="school-outline" size={16} color={colors.textSecondary} />
          <Text variant="bodySmall" secondary>{courseLabel}</Text>
        </View>

        <FloatingLabelField
          label="Message (optional)"
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={3}
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />

        <View>
          <Text variant="bodySmall" weight="semiBold" style={{ marginBottom: spacing.xs }}>
            Answer PDF
          </Text>
          <Button
            label={picking ? 'Uploading…' : file ? 'Change file' : 'Choose PDF'}
            variant="secondary"
            icon={<Ionicons name="document-attach-outline" size={18} color={colors.primary} />}
            onPress={handlePickFile}
            disabled={submitting || picking}
            loading={picking}
          />
          {file ? (
            <View style={[styles.filePill, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}>
              <Ionicons name="document-outline" size={16} color={colors.primary} />
              <Text variant="bodySmall" numberOfLines={1} style={{ flex: 1 }}>{file.name}</Text>
              {file.size !== null ? (
                <Text variant="caption" secondary>{formatBytes(file.size)}</Text>
              ) : null}
            </View>
          ) : (
            <Text variant="caption" secondary style={{ marginTop: spacing.xs }}>
              PDF only, up to 8 MB.
            </Text>
          )}

          {picking ? (
            <View style={[styles.progressTrack, { backgroundColor: colors.surfaceAlt, marginTop: spacing.sm }]}>
              <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${Math.round(progress * 100)}%` }]} />
            </View>
          ) : null}

          {previewUrl ? (
            <View style={[styles.pdfCard, { borderColor: colors.border, borderRadius: radius.lg, marginTop: spacing.sm }, fullscreen ? styles.pdfCardFullscreen : null]}>
              <View style={{ flex: 1 }}>
                <PdfViewer uri={previewUrl} />
              </View>
              {!fullscreen ? (
                <Button
                  label="Fullscreen"
                  variant="secondary"
                  icon={<Ionicons name="expand-outline" size={16} color={colors.primary} />}
                  onPress={() => setFullscreen(true)}
                  style={{ margin: spacing.sm }}
                />
              ) : (
                <Pressable onPress={() => setFullscreen(false)} style={[styles.closeButton, { top: insets.top + 12 }]} accessibilityLabel="Close fullscreen">
                  <Ionicons name="close" size={22} color="#FFF" />
                </Pressable>
              )}
            </View>
          ) : null}
        </View>

        <Button
          label={submitting ? 'Submitting…' : isEdit ? 'Save Changes' : 'Submit Answer'}
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={submitting}
        />

        {!isEdit ? (
          <Text variant="caption" secondary style={{ textAlign: 'center' }}>
            You can re-upload or edit this submission for 1 hour after submitting. Only one submission is allowed per paper.
          </Text>
        ) : (
          <Text variant="caption" secondary style={{ textAlign: 'center' }}>
            Editing is only possible within 1 hour of your original submission.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  examBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  readonlyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  filePill: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, marginTop: 10 },
  pdfCard: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', height: 300 },
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
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
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
