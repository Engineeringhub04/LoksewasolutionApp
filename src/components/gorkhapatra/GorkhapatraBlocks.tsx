// Native renderer for a Gorkhapatra post body. It reconstructs the article from
// ordered blocks (headings, paragraphs, images) as real React Native views —
// deliberately NOT an iframe/webview. Images are the app's Cloudinary re-hosts
// and are tappable to open the full-screen ImageViewer.
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import type { GorkhapatraBlock } from '@/src/core/firebase/services/content';

// Only used until the real image ratio is known; a gentle landscape so the
// placeholder box isn't jarring. Because contentFit is "contain", nothing is ever
// cropped even before the natural size loads.
const DEFAULT_ASPECT = 1.6;

/**
 * A single article image. Manual posts don't carry pixel dimensions, which used
 * to force a fixed, cover-cropped box (tall images showed as a tiny sliver). We
 * now render full-width and let the image tell us its natural aspect ratio via
 * expo-image's onLoad, then size the box to match — so the whole image is always
 * visible, no matter how tall. Tapping opens the pinch-to-zoom viewer.
 */
function ArticleImage({
  url,
  caption,
  width,
  height,
  radius,
  onPress,
}: {
  url: string;
  caption?: string;
  width?: number;
  height?: number;
  radius: number;
  onPress?: (url: string) => void;
}) {
  const known = width && height ? width / height : null;
  const [ratio, setRatio] = useState<number | null>(known);

  const handleLoad = (e: { source?: { width?: number; height?: number } | null }) => {
    if (ratio) return;
    const w = e.source?.width;
    const h = e.source?.height;
    if (w && h) setRatio(w / h);
  };

  return (
    <View>
      <Pressable onPress={() => onPress?.(url)} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
        <Image
          source={{ uri: url }}
          style={{ width: '100%', aspectRatio: ratio ?? DEFAULT_ASPECT, borderRadius: radius, backgroundColor: '#E5E7EB' }}
          contentFit="contain"
          onLoad={handleLoad}
          cachePolicy="disk"
          transition={200}
        />
      </Pressable>
      {caption ? (
        <Text variant="caption" secondary style={styles.caption}>{caption}</Text>
      ) : null}
    </View>
  );
}

export interface GorkhapatraBlocksProps {
  blocks: GorkhapatraBlock[];
  onImagePress?: (url: string) => void;
}

export function GorkhapatraBlocks({ blocks, onImagePress }: GorkhapatraBlocksProps) {
  const { spacing, radius } = useTheme();

  return (
    <View style={{ gap: spacing.md }}>
      {blocks.map((block, index) => {
        if (block.type === 'image' && block.url) {
          return (
            <ArticleImage
              key={index}
              url={block.url}
              caption={block.caption}
              width={block.width}
              height={block.height}
              radius={radius.md}
              onPress={onImagePress}
            />
          );
        }

        if (block.type === 'heading' && block.text) {
          return (
            <Text key={index} variant="h3" weight="bold">{block.text}</Text>
          );
        }

        if (block.type === 'text' && block.text) {
          return (
            <Text key={index} variant="body" style={styles.paragraph}>{block.text}</Text>
          );
        }

        return null;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  paragraph: { lineHeight: 25 },
  caption: { marginTop: 5, textAlign: 'center' },
});
