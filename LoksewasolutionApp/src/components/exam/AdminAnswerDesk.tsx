// Admin "Answer Update" desk — rendered inline on the Exam Hub tab in place of
// the normal exam-set card list whenever an admin is viewing a Theory-kind
// board (see app/(tabs)/exam.tsx). Track tabs let the admin narrow the list to
// a specific desk; each card opens the full grading screen.
import React, { useCallback, useMemo, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useRefreshOnFocus } from '@/src/core/hooks/useRefreshOnFocus';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { Text } from '@/src/components/misc/Text';
import { Avatar } from '@/src/components/misc/Avatar';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { fetchAllExamAnswers, type ExamAnswer } from '@/src/core/firebase/services/examAnswers';

type Track = 'all' | 'theory' | 'pastqns' | 'other';

const TRACKS: { id: Track; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'theory', label: 'Theory Desk' },
  { id: 'pastqns', label: 'Past Qns Desk' },
  { id: 'other', label: 'Other' },
];

function classifyTrack(sectionName: string): Track {
  const n = sectionName.toLowerCase();
  if (n.includes('theory')) return 'theory';
  if (n.includes('past')) return 'pastqns';
  return 'other';
}

function timeAgo(millis: number | null): string {
  if (!millis) return '';
  const diffMin = Math.max(0, Math.round((Date.now() - millis) / 60000));
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

/** Fresh enough that the admin hasn't likely seen it yet — drives the "New" tag. */
const NEW_WINDOW_MS = 24 * 60 * 60 * 1000;

export function AdminAnswerDesk() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();

  const [track, setTrack] = useState<Track>('all');
  const answers = useAsyncData(() => fetchAllExamAnswers(), []);
  useRefreshOnFocus(answers.refresh);

  const counts = useMemo(() => {
    const list = answers.data ?? [];
    const c: Record<Track, number> = { all: list.length, theory: 0, pastqns: 0, other: 0 };
    for (const a of list) c[classifyTrack(a.sectionName)]++;
    return c;
  }, [answers.data]);

  const filtered = useMemo(() => {
    const list = answers.data ?? [];
    if (track === 'all') return list;
    return list.filter((a) => classifyTrack(a.sectionName) === track);
  }, [answers.data, track]);

  const pendingCount = useMemo(() => filtered.filter((a) => a.status === 'pending').length, [filtered]);

  const openDetail = useCallback(
    (a: ExamAnswer) => router.push({ pathname: '/admin/exam-answer/[id]', params: { id: a.id } } as never),
    [router]
  );

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
        {TRACKS.map((t) => {
          const active = track === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTrack(t.id)}
              style={[
                styles.trackChip,
                { backgroundColor: active ? colors.primary : colors.surfaceAlt, borderRadius: 999 },
              ]}
            >
              <Text variant="bodySmall" weight="semiBold" style={{ color: active ? colors.onPrimary : colors.textPrimary }}>
                {t.label}
              </Text>
              {counts[t.id] > 0 ? (
                <View style={[styles.countBubble, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : colors.background }]}>
                  <Text variant="caption" weight="bold" style={{ color: active ? colors.onPrimary : colors.textSecondary }}>
                    {counts[t.id]}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {pendingCount > 0 ? (
        <View style={[styles.pendingBanner, { backgroundColor: '#D9770618', borderRadius: radius.md }]}>
          <Ionicons name="time-outline" size={15} color="#D97706" />
          <Text variant="bodySmall" weight="semiBold" style={{ color: '#D97706' }}>
            {pendingCount} submission{pendingCount === 1 ? '' : 's'} waiting for review
          </Text>
        </View>
      ) : null}

      {answers.loading ? (
        <PageLoaderOverlay visible label="Loading submissions…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title="No submissions"
          description="Answers submitted from this track will show up here."
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {filtered.map((a) => {
            const isNew = a.status === 'pending' && a.createdAt && Date.now() - a.createdAt.toMillis() < NEW_WINDOW_MS;
            // If the student typed a different name than their profile at
            // submission time, show both: "As-submitted (Real Name)" — the
            // admin always needs to know who's really behind a card.
            const nameLabel =
              a.profileName && a.profileName !== a.studentName
                ? `${a.studentName} (${a.profileName})`
                : a.studentName || a.profileName || 'Unnamed student';

            return (
              <Pressable
                key={a.id}
                onPress={() => openDetail(a)}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}
              >
                <Avatar uri={a.photoURL} name={a.profileName || a.studentName} size={44} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text variant="bodySmall" weight="bold" numberOfLines={1} style={{ flex: 1 }}>{nameLabel}</Text>
                    {isNew ? (
                      <View style={[styles.newTag, { backgroundColor: colors.primary }]}>
                        <Text variant="caption" weight="bold" style={{ color: colors.onPrimary }}>New</Text>
                      </View>
                    ) : null}
                  </View>
                  {a.email ? <Text variant="caption" secondary numberOfLines={1}>{a.email}</Text> : null}
                  <Text variant="caption" secondary numberOfLines={1}>{a.examSetTitle || 'Untitled paper'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  {a.status === 'reviewed' ? (
                    <View style={[styles.statusBadge, { backgroundColor: (a.passed ? colors.success : colors.error) + '22' }]}>
                      <Text variant="caption" weight="bold" style={{ color: a.passed ? colors.success : colors.error }}>
                        {a.score}/{a.fullMarks}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.statusBadge, { backgroundColor: '#D9770622' }]}>
                      <Text variant="caption" weight="bold" style={{ color: '#D97706' }}>Pending</Text>
                    </View>
                  )}
                  <Text variant="caption" secondary>{timeAgo(a.createdAt?.toMillis() ?? null)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  trackChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  countBubble: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  pendingBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth },
  newTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
});
