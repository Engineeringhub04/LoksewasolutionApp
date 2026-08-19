import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import Ionicons from '@expo/vector-icons/Ionicons';

import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { ThemeToggleButton } from '@/src/components/misc/ThemeToggleButton';
import { Text } from '@/src/components/misc/Text';
import { getOfflineAccessState, downloadAllAdditionalFeatureQuestionBanks, loadAdditionalFeaturePage, type AdditionalFeatureId, type AdditionalFeaturePage, type AdditionalFeatureTopic } from '@/src/core/services/additionalFeatures';
import { showToast } from '@/src/core/store/toastStore';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';

function isTopicSummary(value: unknown): value is AdditionalFeatureTopic {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<AdditionalFeatureTopic>;
  return typeof item.topicId === 'string' && typeof item.titleEn === 'string' && typeof item.titleNp === 'string' && typeof item.order === 'number';
}

function topicIcon(topic: AdditionalFeatureTopic): keyof typeof Ionicons.glyphMap {
  const text = `${topic.slug ?? ''} ${topic.titleEn}`.toLowerCase();
  if (text.includes('geograph')) return 'globe-outline';
  if (text.includes('history') || text.includes('histor')) return 'time-outline';
  if (text.includes('science') || text.includes('technology')) return 'flask-outline';
  if (text.includes('constitution') || text.includes('law')) return 'shield-checkmark-outline';
  if (text.includes('econom')) return 'trending-up-outline';
  if (text.includes('environment') || text.includes('climate')) return 'leaf-outline';
  if (text.includes('administr') || text.includes('govern')) return 'business-outline';
  if (text.includes('management') || text.includes('leadership')) return 'briefcase-outline';
  if (text.includes('planning') || text.includes('development')) return 'map-outline';
  if (text.includes('finance') || text.includes('budget')) return 'wallet-outline';
  if (text.includes('service') || text.includes('delivery')) return 'people-outline';
  return 'sparkles-outline';
}

export function AdditionalFeatureScreen({ featureId }: { featureId: AdditionalFeatureId }) {
  const { colors, spacing, radius, effective, setMode } = useTheme();
  const { language } = useTranslation();
  const [page, setPage] = useState<AdditionalFeaturePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offlineComplete, setOfflineComplete] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const labels = language === 'ne' ? {
    loading: 'विषयहरू लोड हुँदैछन्...',
    offline: 'अफलाइन पहुँच',
    downloaded: 'अफलाइनका लागि सुरक्षित भयो',
    downloadFailed: 'अफलाइन डेटा डाउनलोड हुन सकेन। इन्टरनेट जाँच गरेर फेरि प्रयास गर्नुहोस्।',
    info: 'यो पेज अफलाइनमा हेर्न Offline Access एकपटक थिच्नुहोस्। नयाँ डेटा हरेक राति १२ बजेपछि अपडेट हुन सक्छ; अपडेटेड डेटा अफलाइनमा पाउन इन्टरनेट जोडेर फेरि थिच्नुहोस्।',
    questions: 'प्रश्नहरू',
    noTopics: 'अहिलेसम्म कुनै विषय अपलोड गरिएको छैन।',
    unable: 'फिचरका विषयहरू लोड गर्न सकिएन।',
  } : {
    loading: 'Loading topics...',
    offline: 'Offline Access',
    downloaded: 'Saved for offline access',
    downloadFailed: 'Offline data could not be downloaded. Check your internet connection and try again.',
    info: 'To view this page offline, tap Offline Access once. New data may update after 12 AM daily; reconnect to the internet and tap again to get the updated data offline.',
    questions: 'questions',
    noTopics: 'No topics uploaded yet.',
    unable: 'Unable to load feature topics.',
  };

  const title = featureId === 'gk' ? 'General Knowledge' : 'Public Management';
  const titleNp = featureId === 'gk' ? 'सामान्य ज्ञान' : 'सार्वजनिक व्यवस्थापन';

  const topics = useMemo(
    () => (page?.topics ?? []).filter(isTopicSummary).filter((topic) => topic.isPublished !== false).sort((a, b) => a.order - b.order),
    [page?.topics],
  );

  const loadPage = useCallback(async (showLoader: boolean, forceRemote = false) => {
    if (showLoader) setLoading(true);
    try {
      const [result, offlineState] = await Promise.all([
        loadAdditionalFeaturePage(featureId, { forceRemote }),
        getOfflineAccessState(featureId),
      ]);
      setPage(result.page);
      setOfflineComplete(offlineState.complete);
    } catch {
      showToast(labels.unable, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [featureId, labels.unable]);

  useEffect(() => {
    void loadPage(true);
  }, [loadPage]);

  const handleRefresh = () => {
    setRefreshing(true);
    void loadPage(false, true);
  };

  const handleOfflineAccess = async () => {
    if (downloading || offlineComplete || topics.length === 0) return;
    setDownloading(true);
    try {
      await downloadAllAdditionalFeatureQuestionBanks(featureId, topics);
      setOfflineComplete(true);
      showToast(labels.downloaded, 'success');
    } catch {
      showToast(labels.downloadFailed, 'error');
    } finally {
      setDownloading(false);
    }
  };

  const openTopic = (topic: AdditionalFeatureTopic) => {
    router.push({
      pathname: '/additional-features/[featureId]/[topicId]',
      params: { featureId, topicId: topic.topicId, topicTitleEn: topic.titleEn, topicTitleNp: topic.titleNp, questionBankId: topic.questionBankId ?? '' },
    });
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>

      <SubpageHeader
        title={featureId === 'gk' ? 'GK' : 'PM'}
        showBack
        rightSlot={<ThemeToggleButton isDark={effective === 'dark'} onToggle={() => setMode(effective === 'dark' ? 'light' : 'dark')} size={36} />}
      />

      <ScrollView contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing.lg * 2 }} refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.divider, borderRadius: radius.lg }]}>

          <View style={styles.heroRow}>
            <View style={[styles.heroIcon, { backgroundColor: `${colors.primary}16` }]}><Ionicons name={featureId === 'gk' ? 'earth-outline' : 'business-outline'} size={28} color={colors.primary} /></View>
            <View style={styles.heroText}>
              <Text variant="caption" weight="bold" style={{ color: colors.primary, letterSpacing: 1 }}>{featureId.toUpperCase()}</Text>
              <Text variant="h2" weight="bold" style={{ color: colors.textPrimary, marginTop: spacing.xs }}>{language === 'ne' ? titleNp : title}</Text>
              <Text variant="caption" secondary style={{ marginTop: 3 }}>{language === 'ne' ? title : titleNp}</Text>
            </View>
            <View style={[styles.topicCountBadge, { backgroundColor: `${colors.primary}12` }]}><Text variant="h3" weight="bold" style={{ color: colors.primary }}>{topics.length}</Text><Text variant="caption" secondary>{language === 'ne' ? 'विषय' : 'Topics'}</Text></View>
          </View>
          <Pressable onPress={handleOfflineAccess} disabled={downloading || offlineComplete || topics.length === 0} accessibilityRole="button" accessibilityLabel={labels.offline} style={({ pressed }) => [styles.offlineButton, { backgroundColor: offlineComplete ? `${colors.success}15` : colors.primary, borderColor: offlineComplete ? `${colors.success}55` : colors.primary, opacity: pressed && !offlineComplete ? 0.88 : 1 }]}>
            {downloading ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name={offlineComplete ? 'checkmark-circle-outline' : 'download-outline'} size={19} color={offlineComplete ? colors.success : '#FFF'} />}
            <Text variant="bodySmall" weight="bold" style={{ color: offlineComplete ? colors.success : '#FFF' }}>{offlineComplete ? labels.downloaded : labels.offline}</Text>
            {!offlineComplete && !downloading ? <Ionicons name="arrow-forward" size={17} color="#FFF" /> : null}
          </Pressable>
        </View>

        <View style={[styles.infoCard, { backgroundColor: `${colors.primary}0C`, borderColor: `${colors.primary}35`, borderRadius: radius.lg, marginTop: spacing.md }]}>

          <View style={[styles.infoIcon, { backgroundColor: `${colors.primary}18` }]}><Ionicons name="information-circle-outline" size={22} color={colors.primary} /></View>
          <Text variant="caption" style={{ flex: 1, lineHeight: 19, color: colors.textPrimary }}>{labels.info}</Text>
        </View>

        {loading ? (
          <View style={styles.centerState}><ActivityIndicator color={colors.primary} /><Text variant="body" secondary style={{ marginTop: spacing.sm }}>{labels.loading}</Text></View>
        ) : topics.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.divider, borderRadius: radius.lg, marginTop: spacing.lg }]}><Ionicons name="folder-open-outline" size={36} color={colors.accent} /><Text variant="body" weight="bold" style={{ color: colors.textPrimary, marginTop: spacing.sm }}>{labels.noTopics}</Text></View>
        ) : (
          <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
            {topics.map((topic) => (
              <Pressable key={topic.topicId} onPress={() => openTopic(topic)} accessibilityRole="button" accessibilityLabel={`${topic.titleEn} ${topic.titleNp}`} style={({ pressed }) => [styles.topicCard, { backgroundColor: colors.surface, borderColor: colors.divider, borderRadius: radius.lg, opacity: pressed ? 0.84 : 1 }]}>
                <View style={[styles.topicGlow, { backgroundColor: `${colors.primary}09` }]} />
                <View style={[styles.topicIcon, { backgroundColor: `${colors.primary}16` }]}><Ionicons name={topicIcon(topic)} size={23} color={colors.primary} /></View>
                <View style={styles.topicText}>
                  <View style={styles.topicHeadingRow}><Text variant="caption" weight="bold" style={{ color: colors.primary, letterSpacing: 1 }}>TOPIC {String(topic.order).padStart(2, '0')}</Text><View style={[styles.questionPill, { backgroundColor: `${colors.primary}10` }]}><Text variant="caption" weight="bold" style={{ color: colors.primary }}>{topic.questionCount} {labels.questions}</Text></View></View>
                  <Text variant="body" weight="bold" style={{ color: colors.textPrimary, marginTop: spacing.xs }} numberOfLines={2}>{language === 'ne' ? topic.titleNp : topic.titleEn}</Text>
                  <Text variant="caption" secondary style={{ marginTop: 3 }} numberOfLines={1}>{language === 'ne' ? topic.titleEn : topic.titleNp}</Text>
                </View>
                <View style={[styles.arrowCircle, { backgroundColor: `${colors.primary}12` }]}><Ionicons name="arrow-forward" size={18} color={colors.primary} /></View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  heroCard: { padding: 18, borderWidth: 1, elevation: 2 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  heroText: { flex: 1, minWidth: 0 },
  topicCountBadge: { minWidth: 48, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 14, alignItems: 'center' },
  offlineButton: { minHeight: 47, marginTop: 17, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  infoCard: { padding: 13, borderWidth: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  centerState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyCard: { alignItems: 'center', padding: 28, borderWidth: 1 },
  topicCard: { minHeight: 104, padding: 15, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden', elevation: 2 },
  topicGlow: { position: 'absolute', width: 140, height: 140, borderRadius: 70, right: -55, top: -35 },
  topicIcon: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  topicText: { flex: 1, minWidth: 0 },
  topicHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  questionPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexShrink: 1 },
  arrowCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
