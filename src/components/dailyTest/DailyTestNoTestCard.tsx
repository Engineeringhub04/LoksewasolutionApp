// "No test today" notice — a slim strip, NOT a card.
//
// Shown above the model strip when no Daily Test document carries today's date.
// It is not an error and should not feel like one: the point is to say plainly
// that today is clear and exactly when the next test lands, so the user does not
// keep pulling to refresh. When something IS scheduled ahead, a live countdown
// ticks down to that day's local midnight.
//
// It used to be a full-size gradient slide inside the carousel. That cost one of
// the four card slots — on a rest day the strip would show this instead of a
// recent result — so it was flattened into a one-line bar that sits above the
// cards and takes almost no room. Same information, no slot spent.
import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import {
  dateFromKey,
  formatDateKeyShort,
  relativeDayLabel,
} from '@/src/core/firebase/services/dailyTest';

interface DailyTestNoTestCardProps {
  /** Release date of the next scheduled model, or null when nothing is queued. */
  nextDateKey: string | null;
  /** Today's key, so the label can say "Tomorrow" rather than a bare date. */
  todayKey: string;
}

/** "08h 42m 15s" — a countdown the user can act on, not a raw duration. */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

export function DailyTestNoTestCard({ nextDateKey, todayKey }: DailyTestNoTestCardProps) {
  const { colors, radius } = useTheme();

  // Target is LOCAL midnight of the release date — the same instant the schedule
  // itself flips, so the countdown reaching zero and the test appearing are the
  // same event rather than two that nearly agree.
  const targetMs = useMemo(() => {
    const date = nextDateKey ? dateFromKey(nextDateKey) : null;
    return date ? date.getTime() : null;
  }, [nextDateKey]);

  const [remaining, setRemaining] = useState(() =>
    targetMs === null ? 0 : targetMs - Date.now(),
  );

  useEffect(() => {
    if (targetMs === null) return;
    setRemaining(targetMs - Date.now());
    // One second is fine: the tick re-renders only this strip, and it stops
    // itself the moment it hits zero.
    const id = setInterval(() => {
      const left = targetMs - Date.now();
      setRemaining(left);
      if (left <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  const relative = nextDateKey ? relativeDayLabel(nextDateKey, todayKey) : '';

  return (
    <View
      style={[
        styles.strip,
        {
          backgroundColor: `${colors.info}0F`,
          borderColor: `${colors.info}33`,
          borderRadius: radius.md,
        },
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: `${colors.info}1F` }]}>
        <Ionicons name="cafe-outline" size={17} color={colors.info} />
      </View>

      <View style={styles.textCol}>
        <Text variant="bodySmall" weight="bold">
          No test today
        </Text>
        <Text variant="caption" secondary numberOfLines={1}>
          {nextDateKey
            ? `Next test unlocks ${relative.toLowerCase()} · ${formatDateKeyShort(nextDateKey)}`
            : 'New Daily Tests are added regularly — check back soon.'}
        </Text>
      </View>

      {nextDateKey ? (
        <View style={[styles.countdown, { backgroundColor: `${colors.info}1A` }]}>
          <Ionicons name="hourglass-outline" size={11} color={colors.info} />
          <Text variant="caption" weight="bold" style={{ color: colors.info }}>
            {remaining > 0 ? formatCountdown(remaining) : 'Any moment now'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconBox: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  textCol: { flex: 1, gap: 1 },
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
});
