// Auto-scrolling banner carousel (PRD §16.2): swipeable, auto-advances, pauses on interaction.
import React, { useRef, useState, useEffect } from 'react';
import { View, FlatList, Image, useWindowDimensions, type ViewToken } from 'react-native';
import { useTheme } from '@/src/core/theme';

export interface CarouselItem {
  id: string;
  imageUri: string;
}

export interface CarouselProps {
  items: CarouselItem[];
  autoAdvanceMs?: number;
  onItemPress?: (item: CarouselItem) => void;
}

export function Carousel({ items, autoAdvanceMs = 4000 }: CarouselProps) {
  const { spacing, radius } = useTheme();
  const { width } = useWindowDimensions();
  const itemWidth = width - spacing.screenPadding * 2;
  const listRef = useRef<FlatList<CarouselItem>>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || items.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % items.length;
        listRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, autoAdvanceMs);
    return () => clearInterval(timer);
  }, [paused, items.length, autoAdvanceMs]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index !== null && viewableItems[0]?.index !== undefined) {
      setIndex(viewableItems[0].index);
    }
  }).current;

  if (items.length === 0) return null;

  return (
    <View>
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => setPaused(true)}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item.imageUri }}
            style={{ width: itemWidth, height: 140, borderRadius: radius.md }}
            resizeMode="cover"
          />
        )}
      />
      {items.length > 1 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: spacing.sm }}>
          {items.map((_, i) => (
            <View
              key={i}
              style={{ width: i === index ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? '#00000099' : '#00000033' }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
