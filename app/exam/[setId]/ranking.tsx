// Leaderboard for a single exam set.
//
// Built from app_exam_rankings (one public row per attempt) because per-user
// attempt subcollections can't be queried across users. Only each user's BEST
// attempt counts, ties broken by the faster time.
//
// This screen is deliberately FIXED to its own dark-blue palette and does not
// follow the app theme: the podium is a designed surface, and re-tinting it per
// theme would wreck the contrast of the medals and glow. It also has no theme
// toggle — the header action is a refresh instead, since a leaderboard is the one
// place users want to re-pull on demand.
//
// LAYOUT: the podium is pinned above the list rather than sitting in
// ListHeaderComponent, so the top three stay visible while the rankings scroll.
// The podium itself is shared with the main leaderboard (components/leaderboard).
import React, { useMemo, useState } from 'react';
import { View, FlatList, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { FadeIn, FadeInDown } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { useRefreshOnFocus } from '@/src/core/hooks/useRefreshOnFocus';
import {
  fetchExamSet,
  fetchExamRanking,
  areResultsUnlocked,
} from '@/src/core/firebase/services/examHub';
import { Text } from '@/src/components/misc/Text';
import { Avatar } from '@/src/components/misc/Avatar';
import { NameWithTick } from '@/src/components/misc/NameWithTick';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import {
  Podium,
  PLACE_THEMES,
  LEADERBOARD_BG_TOP as BG_TOP,
  LEADERBOARD_BG_BOTTOM as BG_BOTTOM,
  LEADERBOARD_CARD as CARD,
  LEADERBOARD_CARD_BORDER as CARD_BORDER,
  LEADERBOARD_TEXT as TEXT,
  LEADERBOARD_TEXT_DIM as TEXT_DIM,
  type PodiumEntry,
} from '@/src/components/leaderboard/Podium';
import { Preloading } from '@/src/components/Preloading';

/** Highlight colour for the signed-in user's own row — matches first place. */
const ME_ACCENT = PLACE_THEMES[1].ring;

export default function ExamRankingScreen() {
  const { setId } = useLocalSearchParams<{ setId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [now] = useState(() => Date.now());

  const examSet = useAsyncData(() => (setId ? fetchExamSet(setId) : Promise.resolve(null)), [setId], {
    // See the ranking hook below — both are held back until there is a real
    // setId, so `settled` can only become true after an actual read.
    enabled: !!setId,
  });
  const ranking = useAsyncData(() => (setId ? fetchExamRanking(setId) : Promise.resolve([])), [setId], {
    enabled: !!setId,
  });

  const reload = () => {
    ranking.refresh();
    examSet.refresh();
  };
  useRefreshOnFocus(reload);

  // The header's refresh button is a FULL reload — the body steps aside for the
  // glow-ring while fresh data is fetched. Pull-to-refresh keeps the board up.
  const [hardRefreshing, setHardRefreshing] = useState(false);
  const hardReload = () => {
    if (hardRefreshing) return;
    setHardRefreshing(true);
    void (async () => {
      await Promise.all([ranking.refresh(), examSet.refresh()]);
      setHardRefreshing(false);
    })();
  };

  const set = examSet.data;
  const rows = ranking.data ?? [];
  const loading = examSet.loading || ranking.loading;
  // Both reads must land before anything is drawn — a podium half-filled with
  // empty stands while the ranking is still in flight was exactly the problem.
  // `settled` rather than `loading`: a pull-to-refresh never re-hides a board
  // that is already on screen. `hardRefreshing` re-runs it for the header button.
  const ready = examSet.settled && ranking.settled && !hardRefreshing;

  const myEntry = useMemo(() => {
    if (!user) return null;
    const index = rows.findIndex((row) => row.uid === user.uid);
    return index >= 0 ? { position: index + 1, row: rows[index] } : null;
  }, [rows, user]);

  // Display order is 2nd, 1st, 3rd — the Podium component expects that order.
  const podiumEntries = useMemo<(PodiumEntry | undefined)[]>(
    () =>
      [rows[1], rows[0], rows[2]].map((row) =>
        row
          ? {
              uid: row.uid,
              name: row.name,
              photoURL: row.photoURL,
              isPro: row.isPro,
              primaryLabel: `${row.score}%`,
            }
          : undefined,
      ),
    [rows],
  );

  const rest = rows.slice(3);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <Pressable onPress={() => router.back()} style={styles.headerIcon} accessibilityLabel="Back">
        <Ionicons name="arrow-back" size={20} color={TEXT} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text variant="h3" weight="bold" style={{ color: TEXT }} numberOfLines={1}>Overall Leaderboard</Text>
        <Text variant="caption" style={{ color: TEXT_DIM }} numberOfLines={2}>
          {set?.title ?? 'Loading exam…'}
        </Text>
      </View>
      {/* Refresh instead of a theme toggle — see file header. */}
      <Pressable onPress={hardReload} style={styles.headerIcon} accessibilityLabel="Refresh ranking">
        <Ionicons name="refresh" size={19} color={TEXT} />
      </Pressable>
    </View>
  );

  if (examSet.error || (examSet.settled && !set)) {
    return (
      <LinearGradient colors={[BG_TOP, BG_BOTTOM]} style={{ flex: 1 }}>
        {header}
        <DataNotFound title="Exam not found" onRetry={() => examSet.refetch()} />
      </LinearGradient>
    );
  }

  // Same unlock gate as the summary and review screens.
  if (set && !areResultsUnlocked(set, now)) {
    return (
      <LinearGradient colors={[BG_TOP, BG_BOTTOM]} style={{ flex: 1 }}>
        {header}
        <DataNotFound
          title="Ranking is locked"
          description="Rankings unlock after the exam window closes, so results stay fair for everyone taking it."
          onRetry={() => router.back()}
        />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[BG_TOP, BG_BOTTOM]} style={{ flex: 1 }}>
      {header}

      {!ready ? (
        // Same gate as the main leaderboard: until BOTH reads have landed the
        // body is replaced wholesale, so the empty podium stands and the "you
        // have not appeared" card never flash as fake content.
        <Preloading label="Loading Ranking..." hint="Fetching the fastest attempts first" />
      ) : (
        <>
      {/* FIXED podium — deliberately OUTSIDE the FlatList so it stays put while
          the rankings scroll underneath it. */}
      <Animated.View entering={FadeIn.duration(320)} style={styles.podiumWrap}>
        <Podium entries={podiumEntries} />
      </Animated.View>

      <FlatList
        data={rest}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 10 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={ranking.refreshing} onRefresh={reload} />}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 4 }}>
            {/* Your position */}
            <View style={[styles.myCard, { backgroundColor: CARD, borderColor: CARD_BORDER }]}>
              {myEntry ? (
                <>
                  <View style={styles.myTopRow}>
                    <View style={styles.myRankBadge}>
                      <Text variant="body" weight="bold" style={{ color: TEXT }}>#{myEntry.position}</Text>
                    </View>
                    <Avatar
                      uri={myEntry.row.photoURL}
                      name={myEntry.row.name}
                      size={44}
                      pro={myEntry.row.isPro}
                    />
                    <View style={{ flex: 1 }}>
                      <Text variant="caption" style={{ color: TEXT_DIM }}>Your Position</Text>
                      <NameWithTick
                        name={myEntry.row.name}
                        pro={myEntry.row.isPro}
                        variant="bodyLarge"
                        style={{ color: TEXT }}
                      />
                    </View>
                    <View style={styles.myScoreBox}>
                      <Text variant="body" weight="bold" style={{ color: TEXT }}>{myEntry.row.score}%</Text>
                      <Text variant="caption" style={{ color: TEXT_DIM }}>score</Text>
                    </View>
                  </View>

                  <View style={styles.mySplit}>
                    <View style={styles.mySplitItem}>
                      <Text variant="bodyLarge" weight="bold" style={{ color: TEXT }}>
                        {myEntry.row.score} / 100
                      </Text>
                      <Text variant="caption" style={{ color: TEXT_DIM }}>Marks</Text>
                    </View>
                    <View style={styles.mySplitDivider} />
                    <View style={styles.mySplitItem}>
                      <Text variant="bodyLarge" weight="bold" style={{ color: TEXT }}>{myEntry.row.score}%</Text>
                      <Text variant="caption" style={{ color: TEXT_DIM }}>Percentage</Text>
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.myEmpty}>
                  <Ionicons name="person-add-outline" size={22} color={TEXT_DIM} />
                  <Text variant="bodySmall" style={{ color: TEXT_DIM, flex: 1 }}>
                    You have not appeared in this exam yet — attempt it to claim a rank.
                  </Text>
                </View>
              )}
            </View>

            <Text variant="bodyLarge" weight="bold" style={{ color: TEXT }}>Rankings</Text>
          </View>
        }
        ListEmptyComponent={
          loading || rows.length > 0 ? null : (
            <View style={[styles.emptyRow, { backgroundColor: CARD, borderColor: CARD_BORDER }]}>
              <Ionicons name="trophy-outline" size={20} color={TEXT_DIM} />
              <Text variant="bodySmall" style={{ color: TEXT_DIM, flex: 1 }}>
                No results yet. Be the first to complete this exam.
              </Text>
            </View>
          )
        }
        renderItem={({ item, index }) => {
          const position = index + 4;
          const isMe = user?.uid === item.uid;
          return (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 40).duration(240)}>
              <View
                style={[
                  styles.row,
                  {
                    backgroundColor: isMe ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.96)',
                    borderColor: isMe ? ME_ACCENT : 'transparent',
                  },
                ]}
              >
                <View style={styles.rowRank}>
                  <Text variant="bodySmall" weight="bold" style={{ color: isMe ? TEXT : '#334155' }}>{position}</Text>
                </View>
                <Avatar uri={item.photoURL} name={item.name} size={38} pro={item.isPro} />
                <View style={{ flex: 1 }}>
                  <NameWithTick
                    name={isMe ? `${item.name} (You)` : item.name}
                    pro={item.isPro}
                    variant="body"
                    style={{ color: isMe ? TEXT : '#0F172A' }}
                  />
                  <Text variant="caption" style={{ color: isMe ? TEXT_DIM : '#64748B' }}>Rank #{position}</Text>
                </View>
                <View style={[styles.rowScore, { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : '#DCFCE7' }]}>
                  <Text variant="bodySmall" weight="bold" style={{ color: isMe ? TEXT : '#15803D' }}>{item.score}%</Text>
                </View>
              </View>
            </Animated.View>
          );
        }}
      />
        </>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 12 },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumWrap: { paddingHorizontal: 16, paddingBottom: 14 },
  // flex:1 is what actually makes only this region scroll; the rounded, slightly
  // darker sheet makes the boundary between fixed podium and scrolling list read
  // as intentional rather than as content sliding under a gap.
  list: {
    flex: 1,
    backgroundColor: 'rgba(8,20,54,0.28)',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
  },
  myCard: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 12 },
  myTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  myRankBadge: {
    minWidth: 48,
    paddingHorizontal: 10,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  myScoreBox: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  mySplit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    paddingVertical: 12,
  },
  mySplitItem: { flex: 1, alignItems: 'center' },
  mySplitDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.25)' },
  myEmpty: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1.5, padding: 12 },
  rowRank: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(148,163,184,0.25)', alignItems: 'center', justifyContent: 'center' },
  rowScore: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
});
