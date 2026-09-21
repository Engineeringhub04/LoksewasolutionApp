// Individual notice detail page — opened from Home's Recent Notices or the
// full Notices list. Firestore-backed (fetchNotice, one direct read, usually
// zero because the list warmed the cache). Renders the notice's ordered
// content blocks — text with clickable links and **bold** spans, images
// tappable into the shared full-screen viewer — and, when the admin enabled
// it, a download call-to-action that OPENS the stored link (never a raw
// file download). The header keeps its theme toggle; the download action
// lives in the body, styled with the notice's highlight colour.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchNotice, type NoticeBlock } from '@/src/core/firebase/services/notices';
import { openExternalUrl } from '@/src/core/services/externalLink';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { Text } from '@/src/components/misc/Text';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { Preloading } from '@/src/components/Preloading';
import { useManualRefresh } from '@/src/core/hooks/useManualRefresh';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { HeroBand, SectionCard, StatusPill, useTones } from '@/src/components/premium';
import { noticeVisual } from '@/src/components/notice/noticeVisuals';
import { ImageViewer } from '@/src/components/media/ImageViewer';

const DEFAULT_ASPECT = 1.6;
/** Inline-image token pattern the admin editor places inside paragraph text. */
const IMG_TOKEN = /\[img:([A-Za-z0-9_-]+)\]/g;

/**
 * A content image. Aspect ratio follows the natural size once loaded, same
 * recipe as Gorkhapatra's ArticleImage. (Image numbering exists only as an
 * admin-side pick for the push notification — the app deliberately does NOT
 * paint a #1/#2 tag on the image itself.)
 */
function NoticeImage({
  url,
  caption,
  radius,
  onPress,
}: {
  url: string;
  caption?: string;
  radius: number;
  onPress?: (url: string) => void;
}) {
  const [ratio, setRatio] = React.useState<number | null>(null);
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

const URL_PATTERN = /(https?:\/\/[^\s<>()]+)/g;

/**
 * One paragraph with **bold** spans and plain-text URLs turned into tappable
 * links. Rendering is deliberately split into runs so RN's Text nesting keeps
 * every piece on the same line flow — no webview, no link library.
 */
function RichParagraph({ text, linkColor }: { text: string; linkColor: string }) {
  // Split on bold markers first, then linkify each segment.
  const parts: React.ReactNode[] = [];
  const boldSegments = text.split(/(\*\*[^*]+\*\*)/g);
  boldSegments.forEach((segment, si) => {
    if (!segment) return;
    const bold = si % 2 === 1 && segment.startsWith('**') && segment.endsWith('**');
    const content = bold ? segment.slice(2, -2) : segment;
    const runs = content.split(URL_PATTERN);
    runs.forEach((run, ri) => {
      if (!run) return;
      const isUrl = ri % 2 === 1 && /^https?:\/\//.test(run);
      if (isUrl) {
        parts.push(
          <Text
            key={`${si}-${ri}`}
            variant="body"
            weight="semiBold"
            onPress={() => void openExternalUrl(run)}
            style={{ color: linkColor, textDecorationLine: 'underline' }}
          >
            {run}
          </Text>,
        );
      } else if (bold) {
        parts.push(<Text key={`${si}-${ri}`} variant="body" weight="bold">{content}</Text>);
      } else {
        parts.push(<Text key={`${si}-${ri}`} variant="body">{run}</Text>);
      }
    });
  });
  return <Text variant="body" style={styles.paragraph}>{parts}</Text>;
}

/** Renders the ordered body blocks. */
function NoticeBlocks({ blocks, onImagePress }: { blocks: NoticeBlock[]; onImagePress: (url: string) => void }) {
  const { spacing } = useTheme();
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      {blocks.map((block, index) => {
        if (block.type === 'image' && block.url) {
          return (
            <NoticeImage
              key={index}
              url={block.url}
              caption={block.caption}
              radius={12}
              onPress={onImagePress}
            />
          );
        }
        if (block.type === 'heading' && block.text) {
          return <Text key={index} variant="h3" weight="bold">{block.text}</Text>;
        }
        if (block.type === 'text' && block.text) {
          return (
            <TextBlock
              key={index}
              block={block}
              linkColor={colors.primary}
              onImagePress={onImagePress}
            />
          );
        }
        return null;
      })}
    </View>
  );
}

/**
 * A text block. Its `[img:KEY]` tokens (placed by the admin editor) split the
 * paragraph: the text before the token renders as a normal rich paragraph,
 * then the inline image appears in the flow, then the remaining text carries
 * on below it.
 */
function TextBlock({
  block,
  linkColor,
  onImagePress,
}: {
  block: NoticeBlock;
  linkColor: string;
  onImagePress: (url: string) => void;
}) {
  const { spacing, radius } = useTheme();
  const text = block.text ?? '';
  const inlineImages = block.images ?? null;

  // No tokens (or none that resolve) → one plain paragraph, as before.
  const tokens = [...text.matchAll(IMG_TOKEN)];
  const resolved = tokens.filter(([, key]) => !!inlineImages?.[key]?.url);
  if (tokens.length === 0 || resolved.length === 0) {
    return <RichParagraph text={text} linkColor={linkColor} />;
  }

  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  tokens.forEach((match, ti) => {
    const [full, key] = match;
    const start = match.index ?? 0;
    if (start > cursor) {
      pieces.push(<RichParagraph key={`t-${ti}`} text={text.slice(cursor, start)} linkColor={linkColor} />);
    }
    const image = inlineImages?.[key];
    if (image?.url) {
      pieces.push(
        <NoticeImage
          key={`i-${ti}`}
          url={image.url}
          caption={image.caption}
          radius={radius.md}
          onPress={onImagePress}
        />,
      );
    } else {
      // Unknown key — drop the token silently rather than leaking markup.
    }
    cursor = start + full.length;
  });
  if (cursor < text.length) {
    pieces.push(<RichParagraph key="t-end" text={text.slice(cursor)} linkColor={linkColor} />);
  }
  return <View style={{ gap: spacing.md }}>{pieces}</View>;
}

function formatDate(millis: number | null): string {
  if (!millis) return '';
  try {
    return new Date(millis).toLocaleDateString('ne-NP', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export default function NoticeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const tones = useTones();
  const { refreshing, onRefresh } = useManualRefresh();
  const notice = useAsyncData(
    (isRefresh) => (id ? fetchNotice(id, { force: isRefresh }) : Promise.resolve(null)),
    [id],
  );
  const [viewerUri, setViewerUri] = React.useState<string | null>(null);
  const item = notice.data;
  const visual = noticeVisual(item?.kind ?? undefined);
  const tone = tones[visual.tone];
  // The admin authors the call-to-action label (e.g. "View official site",
  // "Click here"); the generic word falls back only when they left it blank.
  const downloadLabel = item?.downloadLabel?.trim() || t('notices.download');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Theme toggle stays — the download action lives in the body, not here. */}
      <SubpageHeader title={t('notices.title')} showThemeToggle />
      {!notice.settled ? (
        <Preloading tinted={false} label={t('common.loading')} hint={t('loadHints.common')} />
      ) : notice.error ? (
        <DataNotFound onRetry={notice.refetch} />
      ) : !item ? (
        <DataNotFound
          title={t('notices.notFound')}
          description={t('notices.notFoundDesc')}
        />
      ) : item ? (
        <ScrollView
          contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.md }}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <HeroBand
            icon={visual.icon}
            title={item.title}
            tone={visual.tone}
            footer={
              <>
                <StatusPill label={visual.label} tone={visual.tone} size="sm" />
                <StatusPill
                  // Admin-typed Nepali date wins; blank falls back to the
                  // (English-formatted) publish instant.
                  label={item.dateLabel?.trim() || formatDate(item.publishedAt?.toMillis?.() ?? null)}
                  tone="neutral"
                  icon="time-outline"
                  size="sm"
                />
              </>
            }
          />

          {item.downloadEnabled && item.downloadUrl ? (
            <Pressable
              // Through the normalizer, NOT Linking.openURL directly: this
              // address is whatever the admin typed into the notice editor, and
              // a scheme-less one ("kbr.com.np") is read by iOS as a path
              // inside the app bundle.
              onPress={() => void openExternalUrl(item.downloadUrl)}
              style={({ pressed }) => [
                styles.downloadRow,
                {
                  backgroundColor: pressed ? tone.border : tone.bg,
                  borderColor: tone.border,
                  borderRadius: radius.lg,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              <Ionicons name="open-outline" size={17} color={tone.fg} />
              <Text variant="bodySmall" weight="semiBold" style={{ color: tone.fg, flex: 1 }}>{downloadLabel}</Text>
              <Ionicons name="chevron-forward" size={16} color={tone.fg} />
            </Pressable>
          ) : null}

          <SectionCard icon="document-text-outline" title={t('notices.details')} tone={visual.tone}>
            <NoticeBlocks blocks={item.blocks ?? []} onImagePress={(url) => setViewerUri(url)} />
          </SectionCard>
        </ScrollView>
      ) : null}

      <ImageViewer visible={viewerUri !== null} uri={viewerUri ?? ''} onClose={() => setViewerUri(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  paragraph: { lineHeight: 25 },
  caption: { marginTop: 5, textAlign: 'center' },
  downloadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 13,
    borderWidth: 1,
  },
});
