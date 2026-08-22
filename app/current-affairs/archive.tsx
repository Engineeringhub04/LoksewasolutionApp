import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { cacheCurrentAffairsOffline, fetchCurrentAffairs, fetchCurrentAffairsQuestions, fetchCurrentAffairsPacks, type CurrentAffairsPack } from '@/src/core/firebase/services/currentAffairs';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { ThemeToggleButton } from '@/src/components/misc/ThemeToggleButton';
import { Text } from '@/src/components/misc/Text';
import { Chip } from '@/src/components/misc/Chip';
import { Card } from '@/src/components/cards/Card';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';

const MONTHS = ['सबै', 'अगस्ट २०२६', 'जुलाई २०२६', 'जुन २०२६', 'मे २०२६', 'अप्रिल २०२६'];

function PackCard({ pack, onPress, onDownload }: { pack: CurrentAffairsPack; onPress: () => void; onDownload: () => void }) {
  const { colors } = useTheme();
  const icon = pack.packType === 'monthly' ? 'calendar' : pack.packType === 'weekly' ? 'calendar-outline' : 'today-outline';
  const label = pack.packType === 'monthly' ? 'Monthly Archive' : pack.packType === 'weekly' ? 'This Week' : 'Today';
  return (
    <Card style={styles.packCard}>
      <Pressable onPress={onPress} style={styles.packMain}>
        <View style={[styles.packIcon, { backgroundColor: colors.surfaceAlt }]}><Ionicons name={icon} size={24} color={pack.packType === 'monthly' ? '#EA580C' : colors.primary} /></View>
        <View style={{ flex: 1 }}><Text variant="bodyLarge" weight="bold">{pack.titleNp}</Text><Text variant="caption" secondary style={{ marginTop: 4 }}>{label} · {pack.articleCount} articles · {pack.questionCount} questions</Text></View>
        <Ionicons name="chevron-forward" size={19} color={colors.textSecondary} />
      </Pressable>
      <Pressable onPress={onDownload} style={[styles.downloadButton, { borderColor: colors.border }]}><Ionicons name="download-outline" size={16} color={colors.primary} /><Text variant="caption" weight="semiBold" style={{ color: colors.primary }}>Offline save</Text></Pressable>
    </Card>
  );
}

export default function CurrentAffairsArchiveScreen() {
  const { colors, effective, setMode, spacing } = useTheme();
  const router = useRouter();
  const [month, setMonth] = useState('सबै');
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const articles = useAsyncData(() => fetchCurrentAffairs({ limit: 100 }), []);
  const questions = useAsyncData(() => fetchCurrentAffairsQuestions({ limit: 100 }), []);
  const packs = useAsyncData(() => fetchCurrentAffairsPacks(), []);
  const visiblePacks = useMemo(() => {
    if (month === 'सबै') return packs.data ?? [];
    const monthKey = month === 'अगस्ट २०२६' ? '2026-08' : month === 'जुलाई २०२६' ? '2026-07' : month === 'जुन २०२६' ? '2026-06' : month === 'मे २०२६' ? '2026-05' : '2026-04';
    return (packs.data ?? []).filter((pack) => pack.monthKey === monthKey);
  }, [month, packs.data]);

  const toggleTheme = () => setMode(effective === 'dark' ? 'light' : 'dark');
  const saveOffline = async (pack: CurrentAffairsPack) => {
    setDownloadLoading(true);
    try {
      const articleItems = (articles.data ?? []).filter((article) => pack.articleIds.includes(article.id));
      const questionItems = (questions.data ?? []).filter((question) => pack.questionIds.includes(question.id));
      await cacheCurrentAffairsOffline(articleItems, questionItems);
      setMessage(`${pack.titleNp} offline का लागि save भयो`);
    } catch {
      setMessage('Offline save गर्न सकिएन');
    } finally {
      setDownloadLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopAppBar title="Archive" actions={<ThemeToggleButton isDark={effective === 'dark'} onToggle={toggleTheme} size={36} />} />
      <PageLoaderOverlay visible={articles.loading || questions.loading || packs.loading || downloadLoading} label={downloadLoading ? 'Saving Offline...' : 'Loading Archive...'} />
      {packs.error ? <DataNotFound onRetry={packs.refetch} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing.xxl * 2 }}>
          <Text variant="bodyLarge" weight="bold">समयअनुसार revision</Text>
          <Text variant="bodySmall" secondary style={{ marginTop: 4 }}>आजका update देखि पुराना monthly pack सम्म revise गर्नुहोस्।</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 14 }}>{MONTHS.map((item) => <Chip key={item} label={item} selected={month === item} onPress={() => setMonth(item)} />)}</ScrollView>
          {message ? <View style={[styles.message, { backgroundColor: colors.surfaceAlt }]}><Ionicons name="checkmark-circle-outline" size={18} color="#059669" /><Text variant="bodySmall" style={{ color: '#059669', flex: 1 }}>{message}</Text></View> : null}
          {visiblePacks.length === 0 ? <EmptyState title="यो महिनाको archive उपलब्ध छैन" /> : visiblePacks.map((pack) => <PackCard key={pack.id} pack={pack} onPress={() => { const firstArticle = (articles.data ?? []).find((article) => pack.articleIds.includes(article.id)); if (firstArticle) router.push({ pathname: '/current-affairs/[articleId]', params: { articleId: firstArticle.id } } as never); }} onDownload={() => void saveOffline(pack)} />)}
          <View style={styles.sectionHeading}><Text variant="h3" weight="bold">यस archive का articles</Text><Text variant="caption" secondary>{articles.data?.length ?? 0} items</Text></View>
          {(articles.data ?? []).slice(0, 30).map((article) => <Pressable key={article.id} onPress={() => router.push({ pathname: '/current-affairs/[articleId]', params: { articleId: article.id } } as never)} style={[styles.articleRow, { borderBottomColor: colors.border }]}><View style={[styles.dot, { backgroundColor: colors.primary }]} /><View style={{ flex: 1 }}><Text variant="body" weight="semiBold" numberOfLines={2}>{article.titleNp}</Text><Text variant="caption" secondary style={{ marginTop: 3 }}>{article.category}</Text></View><Ionicons name="chevron-forward" size={17} color={colors.textSecondary} /></Pressable>)}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  packCard: { marginBottom: 10 },
  packMain: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  packIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  downloadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderTopWidth: 1, marginTop: 12 },
  message: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 11, borderRadius: 12, marginBottom: 12 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 8 },
  articleRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 12, borderBottomWidth: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
