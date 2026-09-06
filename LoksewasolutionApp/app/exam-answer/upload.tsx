// Theory Answer Upload — student picks a PDF of their written answer and
// submits it for admin review. Reached from the "Upload your Answer" footer on
// the View Question (pdf/[id]) screen for Theory Desk papers.
//
// Multiple attempts are not allowed: this screen re-checks for an existing
// submission for this examSetId right before showing the form (not just
// relying on the Exam Hub card already having routed submitted students
// elsewhere), so a stale card or a direct deep-link can't bypass the rule.
import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { FloatingLabelField } from '@/src/components/inputs/FloatingLabelField';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
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
  const router = useRouter();

  const user = useAuthStore((s) => s.user);
  const { profile, courseInfo } = useProfileStore();

  const [fullName, setFullName] = useState(profile?.name ?? user?.displayName ?? '');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<PickedPdf | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [successVisible, setSuccessVisible] = useState(false);
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

  const canSubmit = !!file && fullName.trim().length > 0 && !!examSetId && !submitting;

  const handlePickFile = async () => {
    try {
      const picked = await pickAnswerPdf();
      if (!picked) return; // user cancelled
      if (picked.size !== null && picked.size > MAX_ANSWER_PDF_BYTES) {
        showToast('That PDF is larger than 8 MB. Please choose a smaller file.', 'error');
        return;
      }
      setFile(picked);
    } catch {
      showToast('Could not open the file picker. Please try again.', 'error');
    }
  };

  const handleSubmit = async () => {
    if (!file || !user?.uid || !examSetId) return;

    setSubmitting(true);
    setProgress(0);
    try {
      const pdfUrl = await uploadPdfToCloudinary(file.uri, file.name, setProgress);

      if (isEdit && editId) {
        // Re-upload during the edit window — only file/message change; status,
        // score and reviewedAt stay whatever the admin already set (see
        // updateMyExamAnswer's doc comment and firebase.rules).
        await updateMyExamAnswer(editId, { pdfUrl, message: message.trim() });
        showToast('Submission updated.', 'success');
        router.back();
        return;
      }

      await submitExamAnswer({
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
            label={file ? 'Change file' : 'Choose PDF'}
            variant="secondary"
            icon={<Ionicons name="document-attach-outline" size={18} color={colors.primary} />}
            onPress={handlePickFile}
            disabled={submitting}
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
        </View>

        {submitting ? (
          <View style={[styles.progressTrack, { backgroundColor: colors.surfaceAlt }]}>
            <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${Math.round(progress * 100)}%` }]} />
          </View>
        ) : null}

        <Button
          label={submitting ? 'Uploading…' : isEdit ? 'Save Changes' : 'Submit Answer'}
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

      <ConfirmDialog
        visible={successVisible}
        title="Answer Submitted / जवाफ पेश भयो"
        message={
          "Hjr ko Answer PDF file hamro team sanga submit vaisakeko cha. Hjrle ab kehi din wait garnus (upto 7 days). Hami hjr ko answer sheet teacher sanga check garera hjr lai yehi exam card ko View Details page ma upload garidinxau, hjr download garna sakinu huncha.\n\n" +
          "Your answer PDF has been submitted to our team. Please wait a few days (up to 7 days) — once a teacher has checked your answer sheet, the result will appear on this exam's View Details page, where you can download it."
        }
        confirmLabel="View Details"
        cancelLabel="OK"
        onConfirm={() => {
          setSuccessVisible(false);
          router.back();
        }}
        onCancel={() => {
          setSuccessVisible(false);
          router.back();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  examBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  readonlyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  filePill: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, marginTop: 10 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
});
