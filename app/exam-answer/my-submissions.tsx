// "My Answer Submissions" — every Theory answer this student has ever
// uploaded, newest first, with a Pending/Reviewed badge. Tapping one opens its
// details screen (score, reviewer note, edit-window re-upload).
import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useAuthStore } from '@/src/core/store/authStore';
import { useRefreshOnFocus } from '@/src/core/hooks/useRefreshOnFocus';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { EmptyState } from '@/src/components/feedback/EmptyState';
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
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [answers, setAnswers] = useState<ExamAnswer[]>([]);
  const [loading, setLoading] = useState(true);
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubpageHeader title="My Submissions" />

      <FlatList
        data={answers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.sm, flexGrow: 1 }}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => void load({ refresh: true })} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/exam-answer/[id]', params: { id: item.id } } as never)}
            style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.lg, borderColor: colors.border, padding: spacing.md }]}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyLarge" weight="semiBold" numberOfLines={1}>{item.examSetTitle || 'Theory Answer'}</Text>
              <Text variant="caption" secondary numberOfLines={1}>
                {[item.courseName, item.subcourseName].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              {item.status === 'reviewed' ? (
                <View style={[styles.badge, { backgroundColor: (item.passed ? colors.success : colors.error) + '22' }]}>
                  <Text variant="caption" weight="bold" style={{ color: item.passed ? colors.success : colors.error }}>
                    {item.score}/{item.fullMarks}
                  </Text>
                </View>
              ) : (
                <View style={[styles.badge, { backgroundColor: colors.warning + '22' }]}>
                  <Text variant="caption" weight="bold" style={{ color: colors.warning }}>Pending</Text>
                </View>
              )}
              <Text variant="caption" secondary>{timeAgo(item.createdAt?.toMillis() ?? null)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        )}
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

      <PageLoaderOverlay visible={loading && !refreshing} label="Loading…" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
});
