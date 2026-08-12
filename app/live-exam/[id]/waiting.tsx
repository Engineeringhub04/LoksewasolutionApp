// §26 Live Exam — pre-exam waiting room (countdown + participant count) → auto-start.
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchLiveExam } from '@/src/core/firebase/services/exams';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { Text } from '@/src/components/misc/Text';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { Spinner } from '@/src/components/feedback/Spinner';

export default function LiveExamWaitingRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const { data: exam, loading, error, refetch } = useAsyncData(() => fetchLiveExam(id), [id]);
  const [showJoinConfirm, setShowJoinConfirm] = useState(true);
  const [joined, setJoined] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!exam?.scheduledStart || !joined) return;
    const target = exam.scheduledStart.toMillis();

    const tick = () => {
      const remaining = Math.max(0, Math.round((target - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) router.replace(`/mock-test/${id}/attempt`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [exam?.scheduledStart, joined, id, router]);

  if (loading) return <Spinner fullScreen />;
  if (error || !exam) return <ErrorState onRetry={refetch} />;

  const hasStarted = exam.scheduledStart ? exam.scheduledStart.toMillis() < Date.now() : false;

  if (hasStarted && !joined) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <TopAppBar title={t('liveExam.waitingRoom')} />
        <ErrorState message={t('liveExam.lateJoinBlocked')} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={t('liveExam.waitingRoom')} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl }}>
        <Text variant="h2" weight="bold">{exam.title}</Text>
        {joined ? (
          <>
            <Text variant="body" secondary>{t('liveExam.startsIn')}</Text>
            <Text variant="display" weight="bold" style={{ color: colors.primary }}>
              {countdown !== null ? `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}` : '--:--'}
            </Text>
          </>
        ) : null}
      </View>

      <ConfirmDialog
        visible={showJoinConfirm}
        title={t('liveExam.confirmJoin')}
        onConfirm={() => {
          setShowJoinConfirm(false);
          setJoined(true);
        }}
        onCancel={() => {
          setShowJoinConfirm(false);
          router.back();
        }}
      />
    </View>
  );
}
