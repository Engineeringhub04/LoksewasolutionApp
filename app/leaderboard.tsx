// Main leaderboard — one ranking per subcourse, built from every scored and
// unscored activity in the app (see services/mainLeaderboard).
//
// Like the exam ranking this screen is FIXED to its own dark palette rather than
// following the app theme: the podium is a designed surface and re-tinting the
// medals per theme would wreck their contrast. It shares the podium component
// with the exam ranking so both read as the same product, but everything below
// the podium is deliberately different — this board ranks on two numbers
// (percent AND points) where an exam has only a score, so the standing card
// carries three stats and a gap-to-next line, and the rows are glass rather than
// the exam's solid white.
//
// LAYOUT: the podium is pinned above the list, so the top three stay visible
// while the rankings scroll underneath.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { FadeIn, FadeInDown } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { useRefreshOnFocus } from '@/src/core/hooks/useRefreshOnFocus';
import { hasActivePremium, writeUserStats } from '@/src/core/firebase/services/profile';
import {
  fetchMainLeaderboardCached,
  invalidateMainLeaderboardCache,
  publishMainLeaderboardScore,
  resetMainLeaderboardThrottle,
  shouldPublishMainLeaderboardScore,
  type MainLeaderboardRow,
} from '@/src/core/services/mainLeaderboard';
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

const ME_ACCENT = PLACE_THEMES[1].ring;

/** "2h 15m" / "45m" / "3m" — compact enough for a stat cell. */
function formatStudyTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return '0m';
}

/** Trims a trailing ".0" so whole percentages don't read as false precision. */
function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

export default function LeaderboardScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const profile = useProfileStore((s) => s.profile);
  const courseInfo = useProfileStore((s) => s.courseInfo);
  const profileLoadedUid = useProfileStore((s) => s.loadedUid);
  const profileError = useProfileStore((s) => s.error);

  const uid = user?.uid ?? '';
  const courseId = courseInfo?.courseId ?? '';
  const subcourseId = courseInfo?.subcourseId ?? '';

  /**
   * True once the profile store has actually FINISHED a load for this user —
   * which is not the same as "courseInfo is still falsy". On a cold start the
   * two differ for about a second, and this screen used to spend that second
   * telling an enrolled user to "choose a course" before flipping to the real
   * board. Waiting for the store to settle removes that flash entirely; an
   * error counts as settled so a failed profile load can't hang the screen.
   */
  const courseKnown = !!uid && (profileLoadedUid === uid || profileError);

  const board = useAsyncData<MainLeaderboardRow[]>(async (isRefresh) => {
    if (!uid || !subcourseId) return [];

    // A deliberate pull-to-refresh has to mean something: both the publish
    // throttle and the ten-minute board cache would otherwise hand back exactly
    // what is already on screen.
    if (isRefresh) {
      resetMainLeaderboardThrottle(uid, subcourseId);
      invalidateMainLeaderboardCache(subcourseId);
    }

    // Publish first so the user's own row is current before the board is read —
    // otherwise their fresh score would only appear on the NEXT visit. Failure
    // is non-fatal: publishMainLeaderboardScore never throws, and a stale own
    // row still lets the rest of the board render.
    //
    // The throttle lives in the service, not here, because the analytics screen
    // and the once-a-day trigger on app open publish too — a per-screen throttle
    // would let each of them recompute independently.
    if (shouldPublishMainLeaderboardScore(uid, subcourseId)) {
      const published = await publishMainLeaderboardScore(uid, courseId, subcourseId, {
        name: profile?.name || user?.displayName || 'Anonymous',
        photoURL: profile?.photoURL ?? user?.photoURL ?? null,
        // Published with the row so everyone else's device can draw this user's
        // verified tick without reading their profile.
        isPro: hasActivePremium(profile),
      });
      // The Profile stats card shows this same aggregate. Handing the recomputed
      // copy over keeps the card in step with the row the user is looking at
      // here, and costs nothing — the numbers are already in hand.
      if (published) useProfileStore.getState().setScore(published);
      // The board we are about to read now contains a row this publish just
      // changed, so any cached copy is stale by definition.
      invalidateMainLeaderboardCache(subcourseId);
    }

    // Cached rather than raw: the analytics cohort section reads the same board,
    // so bouncing between the two screens costs one read, not two.
    return fetchMainLeaderboardCached(subcourseId);
  }, [uid, courseId, subcourseId], {
    // Not merely an optimisation — it is what lets `settled` mean something.
    //
    // `courseInfo` is warmed by the root layout, but on a cold start it can land
    // a beat AFTER this screen mounts, so `subcourseId` is '' on the first
    // render. Without this gate the fetcher ran anyway, short-circuited to an
    // empty array, and `settled` flipped true on a board that was never read —
    // which is precisely what painted three "Open spot" stands before the real
    // rows arrived. Held back until there is a subcourse, `settled` can only
    // become true once a genuine board has come back.
    enabled: !!uid && !!subcourseId,
  });

  // Depend on `refresh` alone, not the whole result object — useAsyncData
  // returns a new object each render, which would give this a new identity every
  // time and defeat the point of the useCallback.
  const refreshBoard = board.refresh;
  const reload = useCallback(() => {
    void refreshBoard();
  }, [refreshBoard]);
  useRefreshOnFocus(reload);

  // The header's refresh button is a FULL reload, not a silent one: the body
  // steps aside for the glow-ring while a fresh board is fetched, then the
  // finished result replaces it in one step. Pull-to-refresh deliberately does
  // NOT do this — the list stays put under the native spinner there.
  const [hardRefreshing, setHardRefreshing] = useState(false);
  const hardReload = useCallback(() => {
    if (hardRefreshing) return;
    setHardRefreshing(true);
    void (async () => {
      await refreshBoard();
      setHardRefreshing(false);
    })();
  }, [hardRefreshing, refreshBoard]);

  const rows = useMemo(() => board.data ?? [], [board.data]);

  const myIndex = useMemo(
    () => (uid ? rows.findIndex((row) => row.uid === uid) : -1),
    [rows, uid],
  );
  const myRow = myIndex >= 0 ? rows[myIndex] : null;

  // This screen is the ONLY place in the app that holds a sorted board, so it is
  // the only place that can answer "what number am I?" without paying for up to
  // 300 document reads. Mirror it onto users/{uid}.stats so the Profile card can
  // print a rank from a document it already loads at launch.
  //
  // writeUserStats skips the write when the position has not moved, so leaving
  // and re-entering this screen is free.
  useEffect(() => {
    if (!uid || myIndex < 0) return;
    void (async () => {
      const stats = await writeUserStats(uid, { rank: myIndex + 1 });
      if (!stats) return;
      // Push it straight into the shared store too — otherwise the card would
      // keep showing the old rank until the next cold start. The uid re-check is
      // for the case where an account switch finished while the write above was
      // still in flight: the store would already hold the new profile, and
      // patching this rank onto it would show one user another user's position.
      const store = useProfileStore.getState();
      if (store.loadedUid === uid) store.applyLocalPatch({ stats });
    })();
  }, [uid, myIndex]);

  /** How far ahead the person directly above is — the most motivating number here. */
  const pointsToNext = useMemo(() => {
    if (myIndex <= 0) return null;
    return Math.max(0, rows[myIndex - 1].points - rows[myIndex].points);
  }, [rows, myIndex]);

  // Display order is 2nd, 1st, 3rd — the Podium expects that order.
  const podiumEntries = useMemo<(PodiumEntry | undefined)[]>(
    () =>
      [rows[1], rows[0], rows[2]].map((row) =>
        row
          ? {
              uid: row.uid,
              name: row.name,
              photoURL: row.photoURL,
              isPro: row.isPro,
              primaryLabel: formatPercent(row.percent),
              secondaryLabel: `${row.points} ${t('leaderboard.pts')}`,
            }
          : undefined,
      ),
    [rows, t],
  );

  const rest = rows.slice(3);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <Pressable onPress={() => router.back()} style={styles.headerIcon} accessibilityLabel="Back">
        <Ionicons name="arrow-back" size={20} color={TEXT} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text variant="h3" weight="bold" style={{ color: TEXT }} numberOfLines={1}>
          {t('leaderboard.title')}
        </Text>
        <Text variant="caption" style={{ color: TEXT_DIM }} numberOfLines={1}>
          {courseInfo?.subcourseName ?? courseInfo?.courseName ?? ''}
        </Text>
      </View>
      <Pressable onPress={hardReload} style={styles.headerIcon} accessibilityLabel="Refresh leaderboard">
        <Ionicons name="refresh" size={19} color={TEXT} />
      </Pressable>
    </View>
  );

  // Ranking is compared within a subcourse, so without one there is nothing to
  // compare against. `courseKnown` is what keeps this from flashing: it is only
  // true once the profile store has actually finished loading, so an enrolled
  // user on a cold start sees the loader instead of a bogus "choose a course".
  if (courseKnown && (!uid || !subcourseId)) {
    return (
      <LinearGradient colors={[BG_TOP, BG_BOTTOM]} style={{ flex: 1 }}>
        {header}
        <DataNotFound
          title={t('leaderboard.title')}
          description={t('leaderboard.noCourse')}
          onRetry={() => router.back()}
        />
      </LinearGradient>
    );
  }

  if (board.error) {
    return (
      <LinearGradient colors={[BG_TOP, BG_BOTTOM]} style={{ flex: 1 }}>
        {header}
        <DataNotFound onRetry={board.refetch} />
      </LinearGradient>
    );
  }

  // The one gate the whole body hangs on. `settled` (not `loading`) is used so
  // a refresh never re-hides a board that is already on screen: `loading` goes
  // true again on every refetch, while `settled` flips once and stays true. With
  // the `enabled` gate above, `settled` can only be true if a REAL board came
  // back — an empty short-circuit can no longer flip it. `hardRefreshing` is the
  // header button's explicit full reload, which DOES step the body aside.
  const ready = board.settled && !hardRefreshing;


  return (
    <LinearGradient colors={[BG_TOP, BG_BOTTOM]} style={{ flex: 1 }}>
      {header}

      {!ready ? (
        // Everything below the header is replaced, not overlaid: the empty
        // podium stands ("Open spot", "--" pills) and the "Unranked" card used
        // to sit behind the old loader reading exactly like demo data.
        <Preloading
          label={t('leaderboard.loading')}
          hint={t('leaderboard.loadingHint')}
        />
      ) : (
        <>
      {/* FIXED podium — outside the FlatList so it stays put while ranks scroll. */}
      <Animated.View entering={FadeIn.duration(320)} style={styles.podiumWrap}>
        <Podium entries={podiumEntries} emptyLabel={t('leaderboard.openSpot')} />
      </Animated.View>

      <FlatList
        data={rest}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 10 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={board.refreshing} onRefresh={reload} />}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 4 }}>
            {/* Your standing. Deliberately richer than the exam version: a green
                rail, a circular rank, three stats, and the gap to the next rank. */}
            <View style={styles.myCard}>
              <LinearGradient
                colors={['rgba(52,211,153,0.30)', 'rgba(52,211,153,0.05)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.myRail, { backgroundColor: ME_ACCENT }]} />

              {myRow ? (
                <>
                  <View style={styles.myTopRow}>
                    <View style={[styles.myRankCircle, { borderColor: ME_ACCENT }]}>
                      <Text variant="h3" weight="bold" style={{ color: TEXT }}>
                        {myIndex + 1}
                      </Text>
                    </View>
                    <Avatar uri={myRow.photoURL} name={myRow.name} size={44} pro={myRow.isPro} />
                    <View style={{ flex: 1 }}>
                      <Text variant="caption" style={{ color: TEXT_DIM }}>
                        {t('leaderboard.yourStanding')}
                      </Text>
                      <NameWithTick
                        name={myRow.name}
                        pro={myRow.isPro}
                        variant="bodyLarge"
                        style={{ color: TEXT }}
                      />
                    </View>
                  </View>

                  <View style={styles.myStats}>
                    <View style={styles.myStatItem}>
                      <Text variant="bodyLarge" weight="bold" style={{ color: ME_ACCENT }}>
                        {formatPercent(myRow.percent)}
                      </Text>
                      <Text variant="caption" style={{ color: TEXT_DIM }}>
                        {t('leaderboard.percent')}
                      </Text>
                    </View>
                    <View style={styles.myStatDivider} />
                    <View style={styles.myStatItem}>
                      <Text variant="bodyLarge" weight="bold" style={{ color: TEXT }}>
                        {myRow.points}
                      </Text>
                      <Text variant="caption" style={{ color: TEXT_DIM }}>
                        {t('leaderboard.points')}
                      </Text>
                    </View>
                    <View style={styles.myStatDivider} />
                    <View style={styles.myStatItem}>
                      <Text variant="bodyLarge" weight="bold" style={{ color: TEXT }}>
                        {formatStudyTime(myRow.usageSeconds)}
                      </Text>
                      <Text variant="caption" style={{ color: TEXT_DIM }}>
                        {t('leaderboard.studyTime')}
                      </Text>
                    </View>
                  </View>

                  {pointsToNext !== null ? (
                    <View style={styles.myGap}>
                      <Ionicons name="trending-up" size={14} color={ME_ACCENT} />
                      <Text variant="caption" style={{ color: TEXT_DIM, flex: 1 }}>
                        {pointsToNext} {t('leaderboard.pts')} → #{myIndex}
                      </Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <View style={styles.myEmpty}>
                  <Ionicons name="rocket-outline" size={22} color={TEXT_DIM} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodySmall" weight="bold" style={{ color: TEXT }}>
                      {t('leaderboard.unranked')}
                    </Text>
                    <Text variant="caption" style={{ color: TEXT_DIM }}>
                      {t('leaderboard.notRankedYet')}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <Text variant="bodyLarge" weight="bold" style={{ color: TEXT }}>
              {t('leaderboard.rankings')}
            </Text>
          </View>
        }
        ListEmptyComponent={
          board.loading || rows.length > 0 ? null : (
            <View style={[styles.emptyRow, { backgroundColor: CARD, borderColor: CARD_BORDER }]}>
              <Ionicons name="trophy-outline" size={20} color={TEXT_DIM} />
              <Text variant="bodySmall" style={{ color: TEXT_DIM, flex: 1 }}>
                {t('leaderboard.emptyBoard')}
              </Text>
            </View>
          )
        }
        renderItem={({ item, index }) => {
          const position = index + 4;
          const isMe = uid === item.uid;
          return (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 40).duration(240)}>
              <View
                style={[
                  styles.row,
                  {
                    backgroundColor: isMe ? 'rgba(52,211,153,0.18)' : CARD,
                    borderColor: isMe ? ME_ACCENT : CARD_BORDER,
                  },
                ]}
              >
                <View style={[styles.rowRank, isMe && { backgroundColor: 'rgba(52,211,153,0.30)' }]}>
                  <Text variant="bodySmall" weight="bold" style={{ color: TEXT }}>
                    {position}
                  </Text>
                </View>
                <Avatar uri={item.photoURL} name={item.name} size={38} pro={item.isPro} />
                <View style={{ flex: 1 }}>
                  <NameWithTick
                    name={isMe ? `${item.name} (${t('leaderboard.you')})` : item.name}
                    pro={item.isPro}
                    variant="body"
                    style={{ color: TEXT }}
                  />
                  <Text variant="caption" style={{ color: TEXT_DIM }} numberOfLines={1}>
                    {item.points} {t('leaderboard.pts')} · {formatStudyTime(item.usageSeconds)}
                  </Text>
                </View>
                <View style={[styles.rowScore, { backgroundColor: isMe ? 'rgba(52,211,153,0.35)' : 'rgba(255,255,255,0.16)' }]}>
                  <Text variant="bodySmall" weight="bold" style={{ color: TEXT }}>
                    {formatPercent(item.percent)}
                  </Text>
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
  // flex:1 is what confines scrolling to this region; the rounded darker sheet
  // makes the seam between fixed podium and moving list read as intentional.
  list: {
    flex: 1,
    backgroundColor: 'rgba(8,20,54,0.28)',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
  },
  myCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.45)',
    padding: 14,
    paddingLeft: 18,
    gap: 12,
    overflow: 'hidden',
  },
  myRail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  myTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  myRankCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  myStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    paddingVertical: 12,
  },
  myStatItem: { flex: 1, alignItems: 'center' },
  myStatDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.25)' },
  myGap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  myEmpty: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12 },
  rowRank: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowScore: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
});
