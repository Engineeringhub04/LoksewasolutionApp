// Contribution-grid heatmap: weeks as columns, weekdays as rows.
//
// A year of study reduced to a shape you can read in a second — the gaps are as
// informative as the streaks, which is why empty days are drawn rather than
// skipped.
import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { FadeIn } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';

import { Text } from '@/src/components/misc/Text';
import { useTheme } from '@/src/core/theme';

export interface HeatmapDay {
  /** `YYYY-MM-DD`. */
  key: string;
  value: number;
  /** Backfilled estimate rather than a recorded day. */
  seeded?: boolean;
}

export interface HeatmapProps {
  days: HeatmapDay[];
  color: string;
  /** Seven entries, Sunday first, in the active language. */
  weekdayLabels: string[];
  /** Returns a short month label for the first day of a column, or null. */
  monthLabelFor?: (dayKey: string) => string;
  cellSize?: number;
  selectedKey?: string | null;
  onSelect?: (day: HeatmapDay) => void;
  emptyLabel?: string;
}

/** Level 0 is "nothing", so it gets the track colour rather than a faint tint. */
const LEVEL_OPACITY = [0, 0.22, 0.45, 0.7, 1];
const CELL_GAP = 3;
/** Only every other weekday is labelled; seven labels in a 11 px grid collide. */
const LABELLED_WEEKDAYS = [1, 3, 5];

interface Column {
  /** Seven slots, Sunday..Saturday. `null` pads the first and last weeks. */
  cells: (HeatmapDay | null)[];
  firstKey: string;
}

/**
 * Weekday of a `YYYY-MM-DD` key, read in UTC.
 *
 * Local parsing would shift the whole grid by a day for anyone whose device is
 * behind UTC, because the keys are already Kathmandu dates and must not be
 * re-interpreted in another zone.
 */
function weekdayOf(key: string): number {
  const time = Date.parse(`${key}T00:00:00Z`);
  return Number.isNaN(time) ? 0 : new Date(time).getUTCDay();
}

/**
 * Four ascending thresholds over the non-zero values.
 *
 * Quantiles rather than fixed cutoffs: a user doing 5 questions a day and one
 * doing 200 should both see a readable spread instead of a uniformly pale or
 * uniformly saturated grid.
 */
function buildThresholds(values: number[]): number[] {
  const active = values.filter((value) => value > 0).sort((a, b) => a - b);
  if (!active.length) return [1, 2, 3, 4];
  const at = (ratio: number) => active[Math.min(active.length - 1, Math.floor(active.length * ratio))];
  const raw = [at(0.25), at(0.5), at(0.75), at(0.95)];
  // Force strictly increasing steps so a low-variance history still bands.
  return raw.map((value, index) => Math.max(value, index + 1));
}

function levelOf(value: number, thresholds: number[]): number {
  if (value <= 0) return 0;
  if (value <= thresholds[0]) return 1;
  if (value <= thresholds[1]) return 2;
  if (value <= thresholds[2]) return 3;
  return 4;
}

export function Heatmap({
  days,
  color,
  weekdayLabels,
  monthLabelFor,
  cellSize = 13,
  selectedKey = null,
  onSelect,
  emptyLabel,
}: HeatmapProps) {
  const { colors, spacing, radius } = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  const { columns, thresholds } = useMemo(() => {
    const cols: Column[] = [];
    let current: (HeatmapDay | null)[] = [];

    days.forEach((day, index) => {
      const weekday = weekdayOf(day.key);
      if (index === 0) current = Array.from({ length: weekday }, () => null);
      current.push(day);
      if (weekday === 6) {
        cols.push({ cells: current, firstKey: (current.find(Boolean) as HeatmapDay).key });
        current = [];
      }
    });

    if (current.length) {
      const firstReal = current.find(Boolean) as HeatmapDay | undefined;
      while (current.length < 7) current.push(null);
      if (firstReal) cols.push({ cells: current, firstKey: firstReal.key });
    }

    return { columns: cols, thresholds: buildThresholds(days.map((day) => day.value)) };
  }, [days]);

  // Today lives at the right-hand edge, which is off-screen on a long range.
  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 60);
    return () => clearTimeout(timer);
  }, [columns.length]);

  if (!days.length) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="bodySmall" secondary>
          {emptyLabel}
        </Text>
      </View>
    );
  }

  const step = cellSize + CELL_GAP;
  let lastMonthLabel = '';

  return (
    <View style={{ flexDirection: 'row', gap: spacing.xs }}>
      {/* Weekday gutter stays put while the weeks scroll under it. */}
      <View style={{ paddingTop: 16, gap: CELL_GAP }}>
        {weekdayLabels.map((label, index) => (
          <View key={index} style={{ height: cellSize, justifyContent: 'center' }}>
            <Text variant="caption" color={colors.textDisabled} style={{ fontSize: 9, lineHeight: 11 }}>
              {LABELLED_WEEKDAYS.includes(index) ? label : ''}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: CELL_GAP }}
      >
        {columns.map((column, columnIndex) => {
          const monthLabel = monthLabelFor?.(column.firstKey) ?? '';
          const showMonth = monthLabel !== '' && monthLabel !== lastMonthLabel;
          if (showMonth) lastMonthLabel = monthLabel;

          return (
            <Animated.View
              key={column.firstKey}
              // Capped stagger: the sweep should suggest time passing, not make
              // the user wait for it.
              entering={FadeIn.delay(Math.min(columnIndex * 12, 300)).duration(220)}
              style={{ gap: CELL_GAP }}
            >
              <View style={{ height: 14, width: cellSize, justifyContent: 'flex-end' }}>
                <Text
                  numberOfLines={1}
                  variant="caption"
                  color={colors.textDisabled}
                  style={{ fontSize: 9, lineHeight: 10, width: step * 3 }}
                >
                  {showMonth ? monthLabel : ''}
                </Text>
              </View>

              {column.cells.map((cell, cellIndex) => {
                if (!cell) {
                  return <View key={cellIndex} style={{ width: cellSize, height: cellSize }} />;
                }

                const level = levelOf(cell.value, thresholds);
                const selected = selectedKey === cell.key;

                return (
                  <Pressable
                    key={cell.key}
                    onPress={onSelect ? () => onSelect(cell) : undefined}
                    disabled={!onSelect}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      borderRadius: Math.min(4, radius.sm),
                      backgroundColor: level === 0 ? colors.surfaceAlt : color,
                      opacity: level === 0 ? 1 : LEVEL_OPACITY[level] * (cell.seeded ? 0.5 : 1),
                      borderWidth: selected ? 1.5 : 0,
                      borderColor: colors.textPrimary,
                    }}
                  />
                );
              })}
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** The "less → more" key that sits under the grid. */
export function HeatmapLegend({
  color,
  lessLabel,
  moreLabel,
  cellSize = 10,
}: {
  color: string;
  lessLabel: string;
  moreLabel: string;
  cellSize?: number;
}) {
  const { colors, spacing, radius } = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <Text variant="caption" secondary>
        {lessLabel}
      </Text>
      {LEVEL_OPACITY.map((opacity, index) => (
        <View
          key={index}
          style={{
            width: cellSize,
            height: cellSize,
            borderRadius: Math.min(3, radius.sm),
            backgroundColor: index === 0 ? colors.surfaceAlt : color,
            opacity: index === 0 ? 1 : opacity,
          }}
        />
      ))}
      <Text variant="caption" secondary>
        {moreLabel}
      </Text>
    </View>
  );
}
