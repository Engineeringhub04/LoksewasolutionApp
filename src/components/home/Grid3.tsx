// Responsive 3-column grid used by Home's "Additional Feature" and "App Guide"
// sections.
//
// Why this exists: the tiles used to compute their own fixed width from
// Dimensions.get('window') minus a HARDCODED horizontal padding. On any device
// whose real content width didn't match that assumption (narrower Android
// phones, different safe-area/padding, split-screen), the computed width was
// slightly too wide and the 3rd tile wrapped onto its own row — the grid ended
// up 2-per-row and looked broken, while it happened to fit on the iPhone the
// constants were tuned against.
//
// Instead this measures the ACTUAL container width via onLayout and derives the
// tile width from it, so 3 columns always fit exactly on every screen size.
import React, { useCallback, useState } from 'react';
import { View, Dimensions, StyleSheet, type LayoutChangeEvent } from 'react-native';

const COLUMNS = 3;

interface Grid3Props<T> {
  items: T[];
  keyExtractor: (item: T) => string;
  /** Receives the exact width each tile must render at to fit 3 per row. */
  renderItem: (item: T, width: number) => React.ReactNode;
  gap?: number;
}

export function Grid3<T>({ items, keyExtractor, renderItem, gap = 10 }: Grid3Props<T>) {
  // Rendered at an estimate on the very first frame (so there's no blank flash),
  // then corrected to the measured value — which is what every later frame uses.
  const [measuredWidth, setMeasuredWidth] = useState(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    setMeasuredWidth((prev) => (Math.abs(prev - next) > 0.5 ? next : prev));
  }, []);

  const containerWidth = measuredWidth > 0 ? measuredWidth : Dimensions.get('window').width - 32;
  // Math.floor matters: sub-pixel rounding on Android is exactly what pushed the
  // 3rd column onto the next row before.
  const tileWidth = Math.floor((containerWidth - gap * (COLUMNS - 1)) / COLUMNS);

  return (
    <View onLayout={onLayout} style={[styles.grid, { gap }]}>
      {items.map((item) => (
        <React.Fragment key={keyExtractor(item)}>{renderItem(item, tileWidth)}</React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
