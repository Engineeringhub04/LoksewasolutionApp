// Leaderboard for a single exam set.
//
// Built from app_exam_rankings (one public row per attempt) because per-user
// attempt subcollections can't be queried across users. Only each user's BEST
// attempt counts, ties broken by the faster time.
import React, { useMemo, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchExamSet, fetchExamRanking, areResultsUnlocked } from '@/src/core/firebase/services/examHub';
import { Text } from '@/src/components/misc/Text';
import { Avatar } from '@/src/components/misc/Avatar';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';

const MEDALS = ['#F59E0B', '#94A3B8', '#B45309'];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function ExamRankingScreen() {
  const { setId } = useLocalSearchParams<{ setId: string }>();
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [now] = useState(() => Date.now());

  const examSet = useAsyncData(() => (setId ? fetchExamSet(setId) : Promise.resolve(null)), [setId]);
  const ranking = useAsyncData(() => (setId ? fetchExamRanking(setId) : Promise.resolve([])), [setId]);

  const set = examSet.data;
  const rows = ranking.data ?? [];
  const loading = examSet.loading || ranking.loading;

  const myRank = useMemo(() => {
    if (!user) return null;
    const index = rows.findIndex((row) => row.uid === user.uid);
    return index >= 0 ? { position: index + 1, row: rows[index] } : null;
  }, [rows, user]);

  if (examSet.error || (!loading && !set)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SubpageHeader title="Ranking" />
        <DataNotFound title="Exam not found" onRetry={() => examSet.refetch()} />
      </View>
    );
  }

  // Same unlock gate as the summary and review screens.
  if (set && !areResultsUnlocked(set, now)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SubpageHeader title="Ranking" />
        <DataNotFound
          title="Ranking is locked"
          description="Rankings unlock after the exam window closes, so results stay fair for everyone taking it."
          onRetry={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubpageHeader title="Ranking" />

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.sm }}
        refreshControl={
          <AppRefreshControl
            refreshing={ranking.refreshing}
            onRefresh={() => {
              ranking.refresh();
              examSet.refresh();
            }}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
            {/* Your position */}
            <LinearGradient
              colors={['#1D4ED8', '#2563EB']}
              style={[styles.myCard, { borderRadius: radius.lg, padding: spacing.md }]}
            >
              <View style={styles.myCardHead}>
                <Ionicons name="trophy" size={20} color="#FBBF24" />
                <Text variant="bodySmall" weight="bold" style={{ color: '#FFF', flex: 1 }} numberOfLines={1}>
                  {set?.title ?? 'Exam'}
                </Text>
              </View>
              {myRank ? (
                <View style={styles.myCardStats}>
                  <View style={styles.myStat}>
                    <Text variant="h2" weight="bold" style={{ color: '#FFF' }}>#{myRank.position}</Text>
                    <Text variant="caption" style={styles.myLabel}>Your rank</Text>
                  </View>
                  <View style={styles.myStat}>
                    <Text variant="h2" weight="bold" style={{ color: '#FFF' }}>{myRank.row.score}%</Text>
                    <Text variant="caption" style={styles.myLabel}>Best score</Text>
                  </View>
                  <View style={styles.myStat}>
                    <Text variant="h2" weight="bold" style={{ color: '#FFF' }}>{rows.length}</Text>
                    <Text variant="caption" style={styles.myLabel}>Total students</Text>
                  </View>
                </View>
              ) : (
                <Text variant="bodySmall" style={styles.myLabel}>
                  You have not appeared in this exam yet — attempt it to claim a rank.
                </Text>
              )}
            </LinearGradient>

            <Text variant="bodyLarge" weight="bold">Leaderboard</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon="trophy-outline"
              title="No results yet"
              description="Be the first to complete this exam and top the leaderboard."
            />
          )
        }
        renderItem={({ item, index }) => {
          const isMe = user?.uid === item.uid;
          const medal = index < 3 ? MEDALS[index] : null;

          return (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 40).duration(240)}>
              <View
                style={[
                  styles.row,
                  {
                    backgroundColor: isMe ? `${colors.primary}12` : colors.surface,
                    borderColor: isMe ? colors.primary : colors.border,
                    borderRadius: radius.md,
                    padding: spacing.md,
                  },
                ]}
              >
                <View
                  style={[
                    styles.rankBadge,
                    { backgroundColor: medal ?? colors.surfaceAlt },
                  ]}
                >
                  {medal ? (
                    <Ionicons name="medal" size={15} color="#FFF" />
                  ) : (
                    <Text variant="caption" weight="bold" secondary>{index + 1}</Text>
                  )}
                </View>

                <Avatar uri={item.photoURL} name={item.name} size={38} />

                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="body" weight={isMe ? 'bold' : 'semiBold'} numberOfLines={1}>
                    {item.name}{isMe ? ' (You)' : ''}
                  </Text>
                  <Text variant="caption" secondary>{formatDuration(item.timeTakenSeconds)}</Text>
                </View>

                <Text variant="bodyLarge" weight="bold" style={{ color: isMe ? colors.primary : colors.textPrimary }}>
                  {item.score}%
                </Text>
              </View>
            </Animated.View>
          );
        }}
      />

      <PageLoaderOverlay visible={loading} label="Loading Ranking…" />
    </View>
  );
}

const styles = StyleSheet.create({
  myCard: { gap: 12 },
  myCardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  myCardStats: { flexDirection: 'row', justifyContent: 'space-between' },
  myStat: { alignItems: 'center', flex: 1 },
  myLabel: { color: 'rgba(255,255,255,0.85)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5 },
  rankBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
