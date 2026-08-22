import React, { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { addBookmark, fetchBookmarks, removeBookmark } from '@/src/core/firebase/services/bookmarks';
import { fetchCurrentAffair, fetchCurrentAffairsQuestions, markArticleRead } from '@/src/core/firebase/services/currentAffairs';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { ThemeToggleButton } from '@/src/components/misc/ThemeToggleButton';
import { Text } from '@/src/components/misc/Text';
import { Chip } from '@/src/components/misc/Chip';
import { Card } from '@/src/components/cards/Card';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';

function formatDate(value: unknown): string {
  if (!value || typeof value !== 'object' || !('toDate' in value)) return value instanceof Date ? value.toLocaleDateString('ne-NP') : '';
  return (value as { toDate: () => Date }).toDate().toLocaleDateString('ne-NP', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function CurrentAffairDetailScreen() {
  const { colors, effective, setMode, spacing } = useTheme();
  const router = useRouter();
  const { articleId } = useLocalSearchParams<{ articleId?: string | string[] }>();
  const id = Array.isArray(articleId) ? articleId[0] : articleId;
  const user = useAuthStore((state) => state.user);
  const [bookmarked, setBookmarked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const article = useAsyncData(() => id ? fetchCurrentAffair(id) : Promise.resolve(null), [id]);
  const related = useAsyncData(() => id ? fetchCurrentAffairsQuestions({ limit: 100 }).then((items) => items.filter((item) => item.articleId === id)) : Promise.resolve([]), [id]);

  useEffect(() => {
    let active = true;
    if (user?.uid && id) {
      void fetchBookmarks(user.uid).then((items) => {
        if (active) setBookmarked(items.some((item) => item.type === 'currentAffairs' && item.refId === id));
      }).catch(() => undefined);
      void markArticleRead(user.uid, id).catch(() => undefined);
    }
    return () => { active = false; };
  }, [id, user?.uid]);

  const item = article.data;
  const toggleTheme = () => setMode(effective === 'dark' ? 'light' : 'dark');

  const toggleBookmark = async () => {
    if (!user?.uid || !item) return;
    try {
      if (bookmarked) {
        await removeBookmark(user.uid, `currentAffairs_${item.id}`);
        setBookmarked(false);
      } else {
        await addBookmark(user.uid, 'currentAffairs', item.id, item.titleNp, item.summaryNp);
        setBookmarked(true);
      }
    } catch {
      setMessage('Bookmark save गर्न सकिएन');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopAppBar
        title="Current Affairs"
        actions={<View style={styles.headerActions}><Pressable onPress={() => void toggleBookmark()} style={styles.headerIcon}><Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={20} color="#FFF" /></Pressable><ThemeToggleButton isDark={effective === 'dark'} onToggle={toggleTheme} size={36} /></View>}
      />
      <PageLoaderOverlay visible={article.loading || related.loading} label="Loading Current Affairs..." />
      {article.error ? <DataNotFound onRetry={article.refetch} /> : !item ? <EmptyState title="Current Affairs भेटिएन" /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing.xxl * 2 }}>
          <Image source={{ uri: item.imageUrl }} style={styles.heroImage} />
          <View style={styles.categoryRow}><Chip label={item.category} /><Text variant="caption" secondary>{formatDate(item.publishedAt)}</Text></View>
          <Text variant="h2" weight="bold" style={styles.title}>{item.titleNp}</Text>
          <Text variant="bodyLarge" secondary style={styles.summary}>{item.summaryNp}</Text>
          <View style={[styles.sourceRow, { backgroundColor: colors.surfaceAlt }]}><Ionicons name="shield-checkmark-outline" size={17} color={colors.primary} /><Text variant="caption" secondary style={{ flex: 1 }}>स्रोत: {item.sourceName}</Text><Pressable onPress={() => void Linking.openURL(item.sourceUrl)}><Text variant="caption" weight="bold" style={{ color: colors.primary }}>Source</Text></Pressable></View>

          <Card style={styles.sectionCard}><Text variant="h3" weight="bold">के भयो?</Text><Text variant="body" secondary style={styles.bodyText}>{item.contentNp}</Text></Card>
          <Card style={[styles.sectionCard, { borderLeftWidth: 4, borderLeftColor: '#059669' }]}><Text variant="h3" weight="bold">लोकसेवाका लागि किन महत्वपूर्ण?</Text><Text variant="body" secondary style={styles.bodyText}>{item.examRelevanceNp}</Text></Card>
          <Card style={styles.sectionCard}><Text variant="h3" weight="bold">मुख्य तथ्यहरू</Text><View style={styles.factList}>{item.keyFactsNp.map((fact) => <View key={fact} style={styles.factRow}><Ionicons name="checkmark-circle" size={17} color="#059669" /><Text variant="body" style={{ flex: 1 }}>{fact}</Text></View>)}</View></Card>

          <View style={styles.sectionHeading}><Text variant="h3" weight="bold">सम्बन्धित प्रश्नहरू</Text><Text variant="caption" secondary>{related.data?.length ?? 0} questions</Text></View>
          {related.data?.length ? related.data.map((question) => <Card key={question.id} style={styles.questionCard}><Text variant="body" weight="semiBold">{question.questionNp}</Text><Text variant="caption" secondary style={{ marginTop: 5 }}>Daily Quiz मा अभ्यास गर्नुहोस्</Text></Card>) : <EmptyState title="सम्बन्धित प्रश्न छैन" />}
          {message ? <Text variant="bodySmall" style={{ color: colors.primary, marginTop: 10 }}>{message}</Text> : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroImage: { width: '100%', height: 170, borderRadius: 18, backgroundColor: '#E5E7EB', marginBottom: 14 },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { marginTop: 14, lineHeight: 30 },
  summary: { marginTop: 10, lineHeight: 24 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 11, borderRadius: 12, marginTop: 14 },
  sectionCard: { marginTop: 14, gap: 9 },
  bodyText: { lineHeight: 24 },
  factList: { gap: 10, marginTop: 3 },
  factRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 8 },
  questionCard: { marginBottom: 8 },
});
