// "My Answer Submissions" — every Theory answer this student has ever
// uploaded, newest first, with a Pending/Reviewed badge. Tapping one opens its
// details screen (score, reviewer note, edit-window re-upload).
//
// UI only — the fetch, the focus refresh and the detail route are unchanged.
// The screen used to be a bare FlatList of flat rows with hex-suffixed badges
// (`colors.warning + '22'`); it now opens with a summary band and uses the
// shared tone system, so the badges stay legible in both themes. Copy stays in
// English here on purpose: the whole exam-answer feature is untranslated, and a
// half-Nepali flow would read worse than a consistently English one.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useRefreshOnFocus } from '@/src/core/hooks/useRefreshOnFocus';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { Preloading } from '@/src/components/Preloading';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { HeroBand, StatusPill, StatTile, useTones, type Tone } from '@/src/components/premium';
import { fetchMyExamAnswers, type ExamAnswer } from '@/src/core/firebase/services/examAnswers';

function timeAgo(millis: number | null): string {
  if (!millis) return '';
  const diffMin = Math.max(0, Math.round((Date.now() - millis) / 60000));
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

export default function MyExamAnswersScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [answers, setAnswers] = useState<ExamAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (opts?: { refresh?: boolean }) => {
      if (!user?.uid) return;
      if (opts?.refresh) setRefreshing(true);
      else setLoading(true);
      try {
        const list = await fetchMyExamAnswers(user.uid);
        setAnswers(list);
      } catch {
        showToast('Could not load your submissions.', 'error');
      } finally {
        setHasLoadedOnce(true);
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.uid]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useRefreshOnFocus(useCallback(() => void load({ refresh: true }), [load]));

  // Presentational only — counted from the list already on screen.
  const tally = useMemo(() => {
    const reviewed = answers.filter((a) => a.status === 'reviewed');
    return {
      total: answers.length,
      pending: answers.length - reviewed.length,
      passed: reviewed.filter((a) => a.passed).length,
    };
  }, [answers]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubpageHeader title="My Submissions" />

      {!hasLoadedOnce ? (
        <Preloading tinted={false} label="Loading…" hint={t("loadHints.submissions")} />
      ) : (
      <FlatList
        data={answers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.md, paddingBottom: spacing.xxl, flexGrow: 1 }}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => void load({ refresh: true })} />}
        ListHeaderComponent={
          <HeroBand
            icon="cloud-done"
            title="My Submissions"
            subtitle="Every Theory answer you have uploaded, newest first."
            tone="primary"
            footer={
              <>
                <StatTile value={tally.total} label="Submitted" icon="documents-outline" grow />
                <StatTile value={tally.pending} label="Pending" icon="time-outline" tone="warning" grow />
                <StatTile value={tally.passed} label="Passed" icon="trophy-outline" tone="success" grow />
              </>
            }
          />
        }
        renderItem={({ item }) => <SubmissionCard answer={item} onPress={() => router.push({ pathname: '/exam-answer/[id]', params: { id: item.id } } as never)} />}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon="cloud-upload-outline"
              title="No submissions yet"
              description="Answers you upload for Theory Desk papers will appear here."
            />
          )
        }
      />
      )}
    </View>
  );
}

function SubmissionCard({ answer, onPress }: { answer: ExamAnswer; onPress: () => void }) {
  const { colors, spacing, radius } = useTheme();
  const tones = useTones();
  const reviewed = answer.status === 'reviewed';
  const tone: Tone = reviewed ? (answer.passed ? 'success' : 'danger') : 'warning';
  const kind = tones[tone];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? kind.bg : colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: spacing.md,
        },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.icon, { backgroundColor: kind.bg, borderColor: kind.border, borderRadius: radius.md }]}>
          <Ionicons name={reviewed ? (answer.passed ? 'checkmark-done' : 'alert-circle-outline') : 'hourglass-outline'} size={20} color={kind.fg} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="bodyLarge" weight="bold" numberOfLines={2}>{answer.examSetTitle || 'Theory Answer'}</Text>
          <Text variant="caption" secondary numberOfLines={1}>
            {[answer.courseName, answer.subcourseName].filter(Boolean).join(' · ') || '—'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.badgeRow}>
          <StatusPill
            label={reviewed ? (answer.passed ? 'Passed' : 'Not passed') : 'Pending'}
            tone={tone}
            icon={reviewed ? (answer.passed ? 'checkmark-circle' : 'close-circle') : 'time'}
            size="sm"
          />
          {reviewed ? <StatusPill label={`${answer.score}/${answer.fullMarks}`} tone={tone} icon="ribbon-outline" size="sm" /> : null}
        </View>
        <Text variant="caption" secondary numberOfLines={1}>{timeAgo(answer.createdAt?.toMillis() ?? null)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, gap: 11 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  icon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
});
