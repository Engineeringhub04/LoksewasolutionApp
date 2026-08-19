import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import Ionicons from '@expo/vector-icons/Ionicons';

import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { ThemeToggleButton } from '@/src/components/misc/ThemeToggleButton';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { getDocument } from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';
import { seedAdditionalFeatures } from '@/src/core/firebase/seedAdditionalFeatures';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { showToast } from '@/src/core/store/toastStore';
import { useTheme } from '@/src/core/theme';

export type AdditionalFeatureScreenId = 'gk' | 'pm';

type TopicSummary = {
  topicId: string;
  order: number;
  titleEn: string;
  titleNp: string;
  questionCount: number;
  isPublished: boolean;
};

type PageDocument = {
  titleEn?: string;
  titleNp?: string;
  topics?: TopicSummary[];
};

function isTopicSummary(value: unknown): value is TopicSummary {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<TopicSummary>;
  return typeof item.topicId === 'string' && typeof item.titleEn === 'string' && typeof item.titleNp === 'string';
}

export function AdditionalFeatureScreen({ featureId }: { featureId: AdditionalFeatureScreenId }) {
  const { colors, spacing, radius, effective, setMode } = useTheme();
  const user = useAuthStore((state) => state.user);
  const profile = useProfileStore((state) => state.profile);
  const [page, setPage] = useState<PageDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const pagePath = `${Collections.additionalFeaturePages}/${featureId}__all__all`;
  const isAdmin = Boolean(user && profile?.isAdmin === true);
  const title = featureId === 'gk' ? 'General Knowledge' : 'Public Management';
  const titleNp = featureId === 'gk' ? 'सामान्य ज्ञान' : 'सार्वजनिक व्यवस्थापन';

  const loadPage = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const document = await getDocument(pagePath);
      setPage((document as PageDocument | null) ?? null);
    } catch {
      showToast('Unable to load feature topics.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pagePath]);

  useEffect(() => {
    void loadPage(true);
  }, [loadPage]);

  const handleRefresh = () => {
    setRefreshing(true);
    void loadPage(false);
  };

  const handleSeed = async () => {
    if (!isAdmin || seeding) return;
    setSeeding(true);
    try {
      const result = await seedAdditionalFeatures();
      await loadPage(false);
      showToast(`Seeded ${result.topicCount} topics and ${result.questionCount} questions for GK and PM.`, 'success');
    } catch {
      showToast('GK/PM seed failed. Check admin access and Firebase rules.', 'error');
    } finally {
      setSeeding(false);
    }
  };

  const topics = (page?.topics ?? []).filter(isTopicSummary).sort((a, b) => a.order - b.order);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SubpageHeader
        title={featureId === 'gk' ? 'GK' : 'PM'}
        showBack
        rightSlot={(
          <View style={styles.headerActions}>
            {featureId === 'gk' && isAdmin ? (
              <Pressable
                onPress={handleSeed}
                disabled={seeding}
                accessibilityRole="button"
                accessibilityLabel="Seed GK and PM data"
                style={[styles.seedHeaderButton, { backgroundColor: 'rgba(255,255,255,0.2)', opacity: seeding ? 0.55 : 1 }]}
              >
                {seeding ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="cloud-upload-outline" size={18} color="#FFF" />}
                <Text variant="caption" weight="bold" style={styles.headerButtonText}>Seed</Text>
              </Pressable>
            ) : null}
            <ThemeToggleButton
              isDark={effective === 'dark'}
              onToggle={() => setMode(effective === 'dark' ? 'light' : 'dark')}
              size={36}
            />
          </View>
        )}
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.screenPadding, paddingBottom: spacing.xl * 2 }}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={[styles.titleCard, { backgroundColor: colors.surface, borderColor: colors.divider, borderRadius: radius.lg }]}>
          <Text variant="caption" secondary>{featureId.toUpperCase()}</Text>
          <Text variant="h2" weight="bold" style={{ color: colors.textPrimary, marginTop: spacing.xs }}>{titleNp}</Text>
          <Text variant="body" secondary style={{ marginTop: spacing.xs }}>{title}</Text>
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.primary} />
            <Text variant="body" secondary style={{ marginTop: spacing.sm }}>Loading topics...</Text>
          </View>
        ) : topics.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.divider, borderRadius: radius.lg }]}>
            <Ionicons name="folder-open-outline" size={36} color={colors.accent} />
            <Text variant="body" weight="bold" style={{ color: colors.textPrimary, marginTop: spacing.sm }}>No topics uploaded yet.</Text>
            {featureId === 'gk' && isAdmin ? (
              <Button label="Seed GK and PM" onPress={handleSeed} loading={seeding} fullWidth={false} style={{ marginTop: spacing.md }} />
            ) : null}
          </View>
        ) : (
          <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
            {topics.map((topic) => (
              <Pressable
                key={topic.topicId}
                onPress={() => showToast('Topic details will be added in the next phase.', 'info')}
                style={({ pressed }) => [styles.topicCard, { backgroundColor: colors.surface, borderColor: colors.divider, borderRadius: radius.lg, opacity: pressed ? 0.8 : 1 }]}
              >
                <View style={[styles.topicIcon, { backgroundColor: colors.surfaceAlt }]}>
                  <Text variant="body" weight="bold" style={{ color: colors.primary }}>{String(topic.order).padStart(2, '0')}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight="bold" style={{ color: colors.textPrimary }}>{topic.titleNp}</Text>
                  <Text variant="caption" secondary style={{ marginTop: 2 }}>{topic.titleEn}</Text>
                  <Text variant="caption" secondary style={{ marginTop: spacing.xs }}>{topic.questionCount} questions</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seedHeaderButton: { height: 36, minWidth: 52, paddingHorizontal: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  headerButtonText: { color: '#FFF' },
  titleCard: { padding: 18, borderWidth: 1 },
  centerState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyCard: { marginTop: 18, alignItems: 'center', padding: 28, borderWidth: 1 },
  topicCard: { padding: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  topicIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
