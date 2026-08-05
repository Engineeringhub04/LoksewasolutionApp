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
import React, { useMemo, useState } from 'react';
import { View, FlatList, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { useRefreshOnFocus } from '@/src/core/hooks/useRefreshOnFocus';
import {
  fetchExamSet,
  fetchExamRanking,
  areResultsUnlocked,
  type RankingRow,
} from '@/src/core/firebase/services/examHub';
import { Text } from '@/src/components/misc/Text';
import { Avatar } from '@/src/components/misc/Avatar';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';

// Fixed palette — intentionally not from the theme (see file header).
const BG_TOP = '#1E3A8A';
const BG_BOTTOM = '#1D4ED8';
const CARD = 'rgba(255,255,255,0.10)';
const CARD_BORDER = 'rgba(255,255,255,0.18)';
const TEXT = '#FFFFFF';
const TEXT_DIM = 'rgba(255,255,255,0.72)';

const PODIUM = [
  { place: 2, ring: '#E2E8F0', glow: 'rgba(226,232,240,0.55)', height: 92 },
  { place: 1, ring: '#FBBF24', glow: 'rgba(251,191,36,0.75)', height: 124 },
  { place: 3, ring: '#FDBA8C', glow: 'rgba(253,186,140,0.6)', height: 74 },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Podium slot — renders a placeholder when nobody holds that place yet. */
function PodiumSlot({ row, place, ring, glow, height }: { row?: RankingRow; place: number; ring: string; glow: string; height: number }) {
  const filled = Boolean(row);
  const size = place === 1 ? 84 : 70;

  return (
    <View style={styles.podiumSlot}>
      {place === 1 && filled ? <Ionicons name="ribbon" size={20} color="#FBBF24" style={{ marginBottom: 2 }} /> : null}

      <View
        style={[
          styles.podiumAvatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: filled ? ring : 'rgba(255,255,255,0.25)',
            backgroundColor: filled ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)',
            shadowColor: glow,
            shadowOpacity: filled ? 1 : 0,
          },
        ]}
      >
        {filled && row?.photoURL ? (
          <Avatar uri={row.photoURL} name={row.name} size={size - 10} />
        ) : (
          <Text variant="h3" weight="bold" style={{ color: filled ? TEXT : TEXT_DIM }}>
            {filled ? initials(row!.name) : '—'}
          </Text>
        )}
        <View style={[styles.placeBadge, { backgroundColor: filled ? ring : 'rgba(255,255,255,0.25)' }]}>
          <Text variant="caption" weight="bold" style={{ color: filled ? '#1E293B' : TEXT }}>{place}</Text>
        </View>
      </View>

      <Text variant="bodySmall" weight="bold" style={{ color: TEXT, marginTop: 8 }} numberOfLines={1}>
        {filled ? row!.name : 'Not found'}
      </Text>
      <View style={[styles.scorePill, { backgroundColor: filled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)' }]}>
        <Text variant="caption" weight="bold" style={{ color: filled ? TEXT : TEXT_DIM }}>
          {filled ? `${row!.score}%` : '--'}
        </Text>
      </View>

      <View style={[styles.podiumBlock, { height, backgroundColor: filled ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.07)' }]}>
        <Text variant="h2" weight="bold" style={{ color: 'rgba(255,255,255,0.5)' }}>#{place}</Text>
      </View>
    </View>
  );
}

export default function ExamRankingScreen() {
  const { setId } = useLocalSearchParams<{ setId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [now] = useState(() => Date.now());

  const examSet = useAsyncData(() => (setId ? fetchExamSet(setId) : Promise.resolve(null)), [setId]);
  const ranking = useAsyncData(() => (setId ? fetchExamRanking(setId) : Promise.resolve([])), [setId]);

  const reload = () => {
    ranking.refresh();
    examSet.refresh();
  };
  useRefreshOnFocus(reload);

  const set = examSet.data;
  const rows = ranking.data ?? [];
  const loading = examSet.loading || ranking.loading;

  const myEntry = useMemo(() => {
    if (!user) return null;
    const index = rows.findIndex((row) => row.uid === user.uid);
    return index >= 0 ? { position: index + 1, row: rows[index] } : null;
  }, [rows, user]);

  const top3 = [rows[1], rows[0], rows[2]]; // display order: 2nd, 1st, 3rd
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
      <Pressable onPress={reload} style={styles.headerIcon} accessibilityLabel="Refresh ranking">
        <Ionicons name="refresh" size={19} color={TEXT} />
      </Pressable>
    </View>
  );

  if (examSet.error || (!loading && !set)) {
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

      <FlatList
        data={rest}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 10 }}
        refreshControl={<AppRefreshControl refreshing={ranking.refreshing} onRefresh={reload} />}
        ListHeaderComponent={
          <View style={{ gap: 18, marginBottom: 8 }}>
            {/* Podium — always renders three slots so the layout holds even with
                a single participant, with "Not found" placeholders. */}
            <Animated.View entering={FadeIn.duration(320)} style={styles.podiumRow}>
              {PODIUM.map((slot, i) => (
                <PodiumSlot
                  key={slot.place}
                  row={top3[i]}
                  place={slot.place}
                  ring={slot.ring}
                  glow={slot.glow}
                  height={slot.height}
                />
              ))}
            </Animated.View>

            {/* Your position */}
            <View style={[styles.myCard, { backgroundColor: CARD, borderColor: CARD_BORDER }]}>
              {myEntry ? (
                <>
                  <View style={styles.myTopRow}>
                    <View style={styles.myRankBadge}>
                      <Text variant="body" weight="bold" style={{ color: TEXT }}>#{myEntry.position}</Text>
                    </View>
                    <Avatar uri={myEntry.row.photoURL} name={myEntry.row.name} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text variant="caption" style={{ color: TEXT_DIM }}>Your Position</Text>
                      <Text variant="bodyLarge" weight="bold" style={{ color: TEXT }} numberOfLines={1}>
                        {myEntry.row.name}
                      </Text>
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
                    borderColor: isMe ? '#FBBF24' : 'transparent',
                  },
                ]}
              >
                <View style={styles.rowRank}>
                  <Text variant="bodySmall" weight="bold" style={{ color: isMe ? TEXT : '#334155' }}>{position}</Text>
                </View>
                <Avatar uri={item.photoURL} name={item.name} size={38} />
                <View style={{ flex: 1 }}>
                  <Text
                    variant="body"
                    weight="bold"
                    style={{ color: isMe ? TEXT : '#0F172A' }}
                    numberOfLines={1}
                  >
                    {item.name}{isMe ? ' (You)' : ''}
                  </Text>
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

      <PageLoaderOverlay visible={loading} label="Loading Ranking…" />
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
  podiumRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 },
  podiumSlot: { flex: 1, alignItems: 'center' },
  podiumAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  placeBadge: {
    position: 'absolute',
    bottom: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scorePill: { marginTop: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  podiumBlock: {
    marginTop: 10,
    width: '100%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
