import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { addBookmark, fetchBookmarks, removeBookmark, type Bookmark } from '@/src/core/firebase/services/bookmarks';
import {
  cacheCurrentAffairsOffline,
  dailyQuestionLimit,
  fetchCurrentAffairs,
  fetchCurrentAffairsQuestions,
  fetchCurrentAffairsPacks,
  getOfflineCurrentAffairs,
  seedCurrentAffairs,
  type CurrentAffairsArticle,
} from '@/src/core/firebase/services/currentAffairs';
import { CURRENT_AFFAIRS_SEED_ARTICLES, CURRENT_AFFAIRS_SEED_QUESTIONS } from '@/src/core/firebase/currentAffairsSeedData';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { ThemeToggleButton } from '@/src/components/misc/ThemeToggleButton';
import { Text } from '@/src/components/misc/Text';
import { Chip } from '@/src/components/misc/Chip';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { Card } from '@/src/components/cards/Card';

const CATEGORIES = ['सबै', 'नेपाल', 'राजनीति तथा शासन', 'अर्थतन्त्र', 'अन्तर्राष्ट्रिय', 'विज्ञान तथा प्रविधि', 'वातावरण', 'नियुक्ति तथा पुरस्कार', 'खेलकुद तथा संस्कृति', 'प्रतिवेदन तथा सूचकांक', 'महत्वपूर्ण दिवस'];
const DEFAULT_IMAGE = 'https://i.ibb.co/JjCgHCzS/64-DB30-AA-F477-4850-AC45-851-AE68450-DD.jpg';

function formatDate(value: CurrentAffairsArticle['publishedAt']): string {
  if (!value) return '';
  const date = value instanceof Date ? value : value.toDate();
  return date.toLocaleDateString('ne-NP', { year: 'numeric', month: 'short', day: 'numeric' });
}

function BookmarkButton({ article, bookmarked, onToggle }: { article: CurrentAffairsArticle; bookmarked: boolean; onToggle: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onToggle} accessibilityLabel={bookmarked ? 'Bookmark हटाउनुहोस्' : 'Bookmark गर्नुहोस्'} style={styles.bookmarkButton}>
      <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={20} color={bookmarked ? colors.primary : colors.textSecondary} />
    </Pressable>
  );
}

function ArticleCard({ article, bookmarked, onOpen, onToggleBookmark }: { article: CurrentAffairsArticle; bookmarked: boolean; onOpen: () => void; onToggleBookmark: () => void }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
      <Card>
        <View style={styles.articleTopRow}>
          <Chip label={article.category} />
          <BookmarkButton article={article} bookmarked={bookmarked} onToggle={onToggleBookmark} />
        </View>
        <View style={styles.articleBodyRow}>
          <View style={styles.articleTextColumn}>
            <Text variant="bodyLarge" weight="bold" numberOfLines={3}>{article.titleNp}</Text>
            <Text variant="body" secondary numberOfLines={3} style={{ marginTop: spacing.xs }}>{article.summaryNp}</Text>
            <View style={[styles.metaRow, { marginTop: spacing.sm }]}>
              <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
              <Text variant="caption" secondary>{formatDate(article.publishedAt)}</Text>
              <Text variant="caption" secondary>·</Text>
              <Text variant="caption" secondary numberOfLines={1}>{article.sourceName}</Text>
            </View>
          </View>
          <Image source={{ uri: article.imageUrl || DEFAULT_IMAGE }} style={[styles.articleImage, { borderRadius: radius.md }]} />
        </View>
        <View style={[styles.readMoreRow, { marginTop: spacing.sm }]}>
          <Text variant="bodySmall" weight="semiBold" style={{ color: colors.primary }}>पूरा पढ्नुहोस्</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.primary} />
        </View>
      </Card>
    </Pressable>
  );
}

export default function CurrentAffairsScreen() {
  const { colors, spacing, effective, setMode } = useTheme();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const profile = useProfileStore((state) => state.profile);
  const [category, setCategory] = useState('सबै');
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [offlineAvailable, setOfflineAvailable] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);

  const data = useAsyncData(
    () => fetchCurrentAffairs({ category, limit: 100 }),
    [category],
  );
  const packs = useAsyncData(() => fetchCurrentAffairsPacks(), []);
  const isAdmin = profile?.isAdmin === true;

  React.useEffect(() => {
    let active = true;
    void getOfflineCurrentAffairs().then((offline) => {
      if (active) setOfflineAvailable(Boolean(offline?.articles.length || offline?.questions.length));
    });
    if (user?.uid) {
      void fetchBookmarks(user.uid).then((items) => {
        if (active) setBookmarkedIds(items.filter((item) => item.type === 'currentAffairs').map((item) => item.refId));
      }).catch(() => undefined);
    }
    return () => { active = false; };
  }, [user?.uid]);

  const articles = data.data ?? [];
  const todayCount = articles.filter((article) => {
    const date = article.publishedAt instanceof Date ? article.publishedAt : article.publishedAt?.toDate();
    return date ? date.toDateString() === new Date().toDateString() : false;
  }).length;
  const monthPack = packs.data?.find((pack) => pack.packType === 'monthly');
  const totalQuestions = monthPack?.questionCount ?? 0;
  const dailyCount = dailyQuestionLimit(totalQuestions || articles.length * 3);
  const latestArticle = articles[0];

  const toggleTheme = () => setMode(effective === 'dark' ? 'light' : 'dark');

  const performSeed = async () => {
    if (!isAdmin || seedLoading) return;
    setSeedLoading(true);
    setSeedMessage(null);
    try {
      const result = await seedCurrentAffairs();
      await Promise.all([data.refresh(), packs.refresh()]);
      const successMessage = `${result.articleCount} articles, ${result.questionCount} questions र ${result.packCount} packs सफलतापूर्वक seed भयो।`;
      setSeedMessage(successMessage);
      Alert.alert('Seed सफल भयो', `${successMessage}\n\nअब Current Affairs का सबै data देखिनुपर्छ।`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown error';
      const errorMessage = `Seed असफल भयो।\n\n${detail}\n\nFirebase rules deploy भएको छ र तपाईंको account को users profile मा role = admin छ कि जाँच्नुहोस्।`;
      setSeedMessage(errorMessage);
      Alert.alert('Seed हुन सकेन', errorMessage);
    } finally {
      setSeedLoading(false);
    }
  };

  const handleSeed = () => {
    if (!isAdmin || seedLoading) return;
    const categories = Array.from(new Set(CURRENT_AFFAIRS_SEED_ARTICLES.map((article) => article.category))).join(', ');
    Alert.alert(
      'Current Affairs Seed All',
      `यसले database मा यी सबै data राख्नेछ:\n\n• ${CURRENT_AFFAIRS_SEED_ARTICLES.length} verified Nepali articles\n• ${CURRENT_AFFAIRS_SEED_QUESTIONS.length} MCQ questions\n• 3 daily/weekly/monthly packs\n• Categories: ${categories}\n• सबै article मा shared image\n• Daily quiz limit: maximum 15\n• Course mapping: all\n\nExisting seed IDs update हुन्छन्; duplicate data बन्ने छैन। अगाडि बढ्ने?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Seed All', onPress: () => { void performSeed(); } },
      ],
    );
  };

  const handleDownload = async () => {
    if (downloadLoading) return;
    setDownloadLoading(true);
    try {
      const [allArticles, allQuestions] = await Promise.all([
        fetchCurrentAffairs({ limit: 100 }),
        fetchCurrentAffairsQuestions({ limit: 100 }),
      ]);
      await cacheCurrentAffairsOffline(allArticles, allQuestions);
      setOfflineAvailable(true);
      setSeedMessage('Current Affairs offline का लागि save भयो');
    } catch {
      setSeedMessage('Offline save गर्न internet connection चाहिन्छ');
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleBookmark = async (article: CurrentAffairsArticle) => {
    if (!user?.uid) return;
    const exists = bookmarkedIds.includes(article.id);
    try {
      if (exists) {
        await removeBookmark(user.uid, `currentAffairs_${article.id}`);
        setBookmarkedIds((ids) => ids.filter((id) => id !== article.id));
      } else {
        await addBookmark(user.uid, 'currentAffairs', article.id, article.titleNp, article.summaryNp);
        setBookmarkedIds((ids) => [...ids, article.id]);
      }
    } catch {
      setSeedMessage('Bookmark save गर्न सकिएन');
    }
  };

  const headerActions = (
    <View style={styles.headerActions}>
      {isAdmin ? (
        <Pressable onPress={handleSeed} disabled={seedLoading} style={styles.seedButton}>
          {seedLoading ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="cloud-upload-outline" size={17} color="#FFF" />}
          <Text variant="caption" weight="bold" style={styles.seedButtonText}>Seed All</Text>
        </Pressable>
      ) : null}
      <ThemeToggleButton isDark={effective === 'dark'} onToggle={toggleTheme} size={36} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopAppBar title="समसामयिक" actions={headerActions} />
      <PageLoaderOverlay visible={data.loading || packs.loading} opaque label="Loading Current Affairs..." />
      {data.error && !data.data ? <DataNotFound onRetry={data.refetch} /> : (
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing.xxl * 2 }}
          refreshControl={<AppRefreshControl refreshing={data.refreshing} onRefresh={() => { void data.refresh(); void packs.refresh(); }} />}
        >
          <Card style={[styles.summaryCard, { backgroundColor: effective === 'dark' ? '#123B3B' : '#ECFDF5' }]}>
            <View style={styles.summaryIcon}><Ionicons name="newspaper" size={26} color="#059669" /></View>
            <View style={styles.summaryContent}>
              <Text variant="h3" weight="bold">आजका समसामयिक विषय</Text>
              <Text variant="bodySmall" secondary style={{ marginTop: 3 }}>{todayCount || articles.length} नयाँ update · {dailyCount} सम्म practice questions</Text>
              <View style={styles.summaryButtons}>
                <Pressable onPress={() => latestArticle ? router.push({ pathname: '/current-affairs/[articleId]', params: { articleId: latestArticle.id } } as never) : undefined} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
                  <Text variant="bodySmall" weight="bold" style={{ color: colors.onPrimary }}>आज पढ्नुहोस्</Text>
                </Pressable>
                <Pressable onPress={() => router.push('/current-affairs/quiz' as never)} style={[styles.secondaryButton, { borderColor: colors.primary }]}>
                  <Text variant="bodySmall" weight="bold" style={{ color: colors.primary }}>Daily Quiz</Text>
                </Pressable>
              </View>
            </View>
          </Card>

          <View style={styles.quickStatsRow}>
            <View style={[styles.quickStat, { backgroundColor: colors.surface }]}><Text variant="h3" weight="bold" style={{ color: colors.primary }}>{articles.length}</Text><Text variant="caption" secondary>Articles</Text></View>
            <View style={[styles.quickStat, { backgroundColor: colors.surface }]}><Text variant="h3" weight="bold" style={{ color: '#059669' }}>{dailyCount}</Text><Text variant="caption" secondary>Daily Quiz</Text></View>
            <View style={[styles.quickStat, { backgroundColor: colors.surface }]}><Text variant="h3" weight="bold" style={{ color: '#EA580C' }}>{monthPack ? 1 : 0}</Text><Text variant="caption" secondary>Monthly Pack</Text></View>
          </View>

          <View style={styles.sectionHeader}>
            <Text variant="h3" weight="bold">विषयअनुसार पढ्नुहोस्</Text>
            <Pressable onPress={() => router.push('/current-affairs/archive' as never)}><Text variant="bodySmall" weight="semiBold" style={{ color: colors.primary }}>Archive</Text></Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.sm }}>
            {CATEGORIES.map((item) => <Chip key={item} label={item} selected={category === item} onPress={() => setCategory(item)} />)}
          </ScrollView>

          {seedMessage ? <View style={[styles.messageBox, { backgroundColor: colors.surfaceAlt }]}><Ionicons name="information-circle-outline" size={18} color={colors.primary} /><Text variant="bodySmall" style={{ color: colors.primary, flex: 1 }}>{seedMessage}</Text></View> : null}

          <View style={styles.sectionHeader}><Text variant="h3" weight="bold">नयाँ update</Text><Text variant="caption" secondary>{articles.length} items</Text></View>
          {articles.length === 0 ? <EmptyState title="आजका लागि नयाँ Current Affairs उपलब्ध छैन" /> : articles.map((article) => (
            <ArticleCard key={article.id} article={article} bookmarked={bookmarkedIds.includes(article.id)} onOpen={() => router.push({ pathname: '/current-affairs/[articleId]', params: { articleId: article.id } } as never)} onToggleBookmark={() => void handleBookmark(article)} />
          ))}

          <View style={styles.sectionHeader}><Text variant="h3" weight="bold">Revision र Offline</Text></View>
          <View style={styles.actionGrid}>
            <Pressable onPress={() => router.push('/current-affairs/archive' as never)} style={[styles.actionCard, { backgroundColor: colors.surface }]}><Ionicons name="calendar-outline" size={24} color="#EA580C" /><Text variant="bodySmall" weight="semiBold" style={styles.actionText}>Monthly Archive</Text><Text variant="caption" secondary>पुराना update revise</Text></Pressable>
            <Pressable onPress={handleDownload} disabled={downloadLoading} style={[styles.actionCard, { backgroundColor: colors.surface }]}>{downloadLoading ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="download-outline" size={24} color="#059669" />}<Text variant="bodySmall" weight="semiBold" style={styles.actionText}>{offlineAvailable ? 'Offline Saved' : 'Download Offline'}</Text><Text variant="caption" secondary>internet बिना पढ्नुहोस्</Text></Pressable>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  seedButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 10, paddingHorizontal: 9, height: 36 },
  seedButtonText: { color: '#FFF' },
  summaryCard: { flexDirection: 'row', padding: 16, borderWidth: 0 },
  summaryIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(5,150,105,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  summaryContent: { flex: 1 },
  summaryButtons: { flexDirection: 'row', gap: 8, marginTop: 14 },
  primaryButton: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 10 },
  secondaryButton: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  quickStatsRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  quickStat: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  articleTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  articleBodyRow: { flexDirection: 'row', marginTop: 10 },
  articleTextColumn: { flex: 1, paddingRight: 10 },
  articleImage: { width: 78, height: 78, backgroundColor: '#E5E7EB' },
  bookmarkButton: { padding: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  readMoreRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  messageBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, marginTop: 14 },
  actionGrid: { flexDirection: 'row', gap: 10 },
  actionCard: { flex: 1, borderRadius: 16, padding: 14, gap: 5 },
  actionText: { marginTop: 2 },
});
