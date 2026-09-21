// §34.1 Bookmark details — renders the SAVED SNAPSHOT, never the live source.
//
// This page deliberately does NOT redirect into the exam / subject / article it
// came from. The user asked for the bookmark itself to open, and a snapshot also
// keeps working after the source question is edited, unpublished, or the attempt
// window closes. Everything shown here comes from `bookmark.payload`, which was
// written at save time; the page issues no reads of its own.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FadeIn, FadeInDown } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useBookmarkStore } from '@/src/core/store/bookmarkStore';
import { showToast } from '@/src/core/store/toastStore';
import { type Bookmark, type BookmarkContext } from '@/src/core/firebase/services/bookmarks';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { ThemeToggleButton } from '@/src/components/misc/ThemeToggleButton';
import { Text } from '@/src/components/misc/Text';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { Preloading } from '@/src/components/Preloading';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';

const CONTEXT_STYLE: Record<BookmarkContext, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  exam: { icon: 'school-outline', color: '#2563EB' },
  read: { icon: 'book-outline', color: '#0D9488' },
  practice: { icon: 'barbell-outline', color: '#EA580C' },
  'daily-test': { icon: 'today-outline', color: '#7C3AED' },
  qotd: { icon: 'sunny-outline', color: '#D97706' },
  quiz: { icon: 'help-circle-outline', color: '#DB2777' },
  discussion: { icon: 'chatbubbles-outline', color: '#4F46E5' },
  article: { icon: 'newspaper-outline', color: '#059669' },
  note: { icon: 'document-text-outline', color: '#475569' },
  chapter: { icon: 'layers-outline', color: '#0891B2' },
  other: { icon: 'bookmark-outline', color: '#64748B' },
};

function savedDate(item: Bookmark): string {
  try {
    const date = item.createdAt?.toDate?.();
    if (!date) return '';
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function BookmarkDetailScreen() {
  const { colors, spacing, radius, elevation, effective, setMode } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = rawId ? decodeURIComponent(rawId) : '';

  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const items = useBookmarkStore((s) => s.items);
  const loading = useBookmarkStore((s) => s.loading);
  const loadedUid = useBookmarkStore((s) => s.loadedUid);

  const [revealed, setRevealed] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (uid) void useBookmarkStore.getState().load(uid);
  }, [uid]);

  const item = useMemo(() => items.find((entry) => entry.id === id) ?? null, [id, items]);
  const style = item ? CONTEXT_STYLE[item.context] ?? CONTEXT_STYLE.other : CONTEXT_STYLE.other;
  const payload = item?.payload ?? null;

  const answerIndex = payload?.answerIndex;
  const hasAnswer = typeof answerIndex === 'number' && answerIndex >= 0 && Boolean(payload?.options?.length);
  const questionText = payload?.question || item?.title || '';
  const body = payload?.body?.trim() ?? '';
  const hasContent = Boolean(payload?.question || body || payload?.options?.length || payload?.explanation);

  const remove = async () => {
    setConfirmRemove(false);
    if (!item || !uid) return;
    const ok = await useBookmarkStore.getState().remove(uid, item.id);
    if (ok) {
      showToast(t('bookmarks.removedToast'), 'info');
      router.back();
    } else {
      showToast(t('common.somethingWentWrong'), 'error');
    }
  };

  // Only a genuinely unknown id is "not found" — while the store is still
  // loading its first page we show the loader instead.
  const stillLoading = loading && loadedUid !== uid;

  if (!item) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SubpageHeader title={t('bookmarks.detailTitle')} />
        {stillLoading ? (
          <Preloading tinted={false} label={t('common.loading')} hint={t('loadHints.common')} />
        ) : (
          <DataNotFound title={t('bookmarks.notFound')} description={t('bookmarks.notFoundBody')} />
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubpageHeader
        title={t('bookmarks.detailTitle')}
        rightSlot={
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => setConfirmRemove(true)}
              hitSlop={8}
              accessibilityLabel={t('bookmarks.removeAction')}
              style={styles.headerAction}
            >
              <Ionicons name="trash-outline" size={17} color="#FFF" />
            </Pressable>
            <ThemeToggleButton isDark={effective === 'dark'} onToggle={() => setMode(effective === 'dark' ? 'light' : 'dark')} size={36} />
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing.xxl * 2, gap: 13 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Origin card — where this came from, kept as saved. */}
        <Animated.View
          entering={FadeInDown.duration(320)}
          style={[styles.originCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }, elevation[1]]}
        >
          <View style={[styles.originIcon, { backgroundColor: `${style.color}${effective === 'dark' ? '26' : '14'}` }]}>
            <Ionicons name={style.icon} size={21} color={style.color} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text variant="overline" weight="bold" style={{ color: style.color, letterSpacing: 1 }}>
              {(item.sourceLabel || t(`bookmarks.ctx.${item.context}`)).toUpperCase()}
            </Text>
            {savedDate(item) ? (
              <Text variant="caption" style={{ color: colors.textDisabled }}>
                {t('bookmarks.savedOn', { date: savedDate(item) })}
              </Text>
            ) : null}
          </View>
        </Animated.View>

        {/* Saved meta rows — Subject / Chapter / Set, whatever the source supplied. */}
        {payload?.meta?.length ? (
          <Animated.View
            entering={FadeInDown.delay(60).duration(320)}
            style={[styles.metaCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderRadius: radius.md }]}
          >
            {payload.meta.map((row, index) => (
              <View key={`${row.label}-${index}`} style={styles.metaRow}>
                <Text variant="caption" secondary style={{ flex: 1 }}>{row.label}</Text>
                <Text variant="caption" weight="semiBold" style={{ flex: 2, textAlign: 'right' }}>{row.value}</Text>
              </View>
            ))}
          </Animated.View>
        ) : null}

        {!hasContent ? (
          <Animated.View
            entering={FadeInDown.delay(80).duration(320)}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }, elevation[1]]}
          >
            <Text variant="h3" weight="bold">{item.title}</Text>
            {item.preview ? <Text variant="body" secondary style={{ marginTop: 8, lineHeight: 22 }}>{item.preview}</Text> : null}
            <View style={[styles.noteBox, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}>
              <Ionicons name="information-circle-outline" size={17} color={colors.textSecondary} />
              <Text variant="caption" secondary style={{ flex: 1, lineHeight: 18 }}>{t('bookmarks.noContent')}</Text>
            </View>
          </Animated.View>
        ) : (
          <>
            {/* Question / title block */}
            <Animated.View
              entering={FadeInDown.delay(80).duration(320)}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }, elevation[1]]}
            >
              <Text variant="h3" weight="bold" style={{ lineHeight: 26 }}>{questionText}</Text>
            </Animated.View>

            {/* Options — the correct one is only tinted once revealed, so a saved
                question can still be re-attempted mentally before checking. */}
            {payload?.options?.length ? (
              <Animated.View entering={FadeInDown.delay(120).duration(320)} style={{ gap: 9 }}>
                {payload.options.map((option, index) => {
                  const isCorrect = hasAnswer && index === answerIndex;
                  const show = revealed && isCorrect;
                  return (
                    <View
                      key={`${option}-${index}`}
                      style={[
                        styles.option,
                        {
                          backgroundColor: show ? (effective === 'dark' ? '#153526' : '#ECFDF5') : colors.surface,
                          borderColor: show ? '#22C55E' : colors.border,
                          borderRadius: radius.md,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.optionLetter,
                          {
                            backgroundColor: show ? '#22C55E' : colors.surfaceAlt,
                            borderColor: show ? '#22C55E' : colors.border,
                          },
                        ]}
                      >
                        <Text variant="caption" weight="bold" style={{ color: show ? '#FFF' : colors.textSecondary }}>
                          {String.fromCharCode(65 + index)}
                        </Text>
                      </View>
                      <Text variant="body" style={{ flex: 1, lineHeight: 21 }}>{option}</Text>
                      {show ? <Ionicons name="checkmark-circle" size={20} color="#16A34A" /> : null}
                    </View>
                  );
                })}

                {hasAnswer ? (
                  <Pressable
                    onPress={() => setRevealed((value) => !value)}
                    style={({ pressed }) => [
                      styles.revealBtn,
                      {
                        backgroundColor: revealed ? colors.surfaceAlt : `${style.color}${effective === 'dark' ? '26' : '14'}`,
                        borderColor: revealed ? colors.border : `${style.color}55`,
                        borderRadius: radius.md,
                        opacity: pressed ? 0.88 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={revealed ? 'eye-off-outline' : 'eye-outline'}
                      size={17}
                      color={revealed ? colors.textSecondary : style.color}
                    />
                    <Text variant="bodySmall" weight="bold" style={{ color: revealed ? colors.textSecondary : style.color }}>
                      {revealed ? t('bookmarks.hideAnswer') : t('bookmarks.revealAnswer')}
                    </Text>
                  </Pressable>
                ) : null}
              </Animated.View>
            ) : null}

            {/* Explanation — gated behind the same reveal as the answer. */}
            {payload?.explanation && (revealed || !hasAnswer) ? (
              <Animated.View
                entering={FadeIn.duration(260)}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }, elevation[1]]}
              >
                <View style={styles.sectionHead}>
                  <Ionicons name="bulb-outline" size={17} color={style.color} />
                  <Text variant="bodySmall" weight="bold" style={{ color: style.color }}>{t('bookmarks.explanationLabel')}</Text>
                </View>
                <Text variant="body" secondary style={{ lineHeight: 22 }}>{payload.explanation}</Text>
              </Animated.View>
            ) : null}

            {/* Long-form saved content (read mode, articles, constitution parts). */}
            {body ? (
              <Animated.View
                entering={FadeInDown.delay(150).duration(320)}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }, elevation[1]]}
              >
                <View style={styles.sectionHead}>
                  <Ionicons name="reader-outline" size={17} color={style.color} />
                  <Text variant="bodySmall" weight="bold" style={{ color: style.color }}>{t('bookmarks.contentLabel')}</Text>
                </View>
                <Text selectable variant="body" style={{ lineHeight: 23 }}>{body}</Text>
              </Animated.View>
            ) : null}
          </>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={confirmRemove}
        icon="bookmark-outline"
        title={t('bookmarks.removeTitle')}
        subtitle={item.title}
        message={t('bookmarks.removeBody')}
        confirmLabel={t('bookmarks.removeConfirm')}
        destructive
        onConfirm={() => void remove()}
        onCancel={() => setConfirmRemove(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerAction: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  originCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1 },
  originIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  metaCard: { borderWidth: 1, paddingHorizontal: 13, paddingVertical: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  card: { padding: 16, borderWidth: 1 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 9 },
  noteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 11, marginTop: 13 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, borderWidth: 1.3 },
  optionLetter: { width: 28, height: 28, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  revealBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, borderWidth: 1, marginTop: 2 },
});
