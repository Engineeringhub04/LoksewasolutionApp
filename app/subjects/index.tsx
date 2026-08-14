import React, { useState } from 'react';
import { View, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { useRefreshOnFocus } from '@/src/core/hooks/useRefreshOnFocus';
import {
  DEFAULT_LEARNING_COURSE_ID,
  DEFAULT_LEARNING_SUBCOURSE_ID,
  fetchLearningSubjects,
} from '@/src/core/firebase/services/learning';
import { seedLearningPageData } from '@/src/core/firebase/services/learningSeed';
import { useProfileStore } from '@/src/core/store/profileStore';
import { showToast } from '@/src/core/store/toastStore';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { SubjectCard } from '@/src/components/cards/SubjectCard';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { SkeletonCard } from '@/src/components/feedback/Skeleton';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';

export default function SubjectListScreen() {
  const { colors, spacing, effective, setMode } = useTheme();
  const { t, language } = useTranslation();
  const router = useRouter();
  const { profile, courseInfo } = useProfileStore();
  const courseId = courseInfo?.courseId ?? DEFAULT_LEARNING_COURSE_ID;
  const subcourseId = courseInfo?.subcourseId ?? DEFAULT_LEARNING_SUBCOURSE_ID;
  const { data, loading, refreshing, error, refetch, refresh } = useAsyncData(
    () => fetchLearningSubjects(courseId, subcourseId),
    [courseId, subcourseId],
  );
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useRefreshOnFocus(refresh);

  const handleSeed = async () => {
    setShowSeedConfirm(false);
    setSeeding(true);
    try {
      const result = await seedLearningPageData();
      showToast(`${t('learning.seedSuccess')} ${result.totalRecords} ${t('learning.seededRecords')}`, 'success');
      await refresh();
    } catch {
      showToast(t('learning.seedFailed'), 'error');
    } finally {
      setSeeding(false);
    }
  };

  const headerActions = profile?.isAdmin ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Pressable
        accessibilityLabel={t('learning.seedTitle')}
        onPress={() => setShowSeedConfirm(true)}
        style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' }}
      >
        <Ionicons name="cloud-upload-outline" size={21} color={colors.onPrimary} />
      </Pressable>
      <Pressable
        accessibilityLabel={t('settings.theme')}
        onPress={() => setMode(effective === 'dark' ? 'light' : 'dark')}
        style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' }}
      >
        <Ionicons name={effective === 'dark' ? 'sunny-outline' : 'moon-outline'} size={20} color={colors.onPrimary} />
      </Pressable>
    </View>
  ) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={t('subjects.title')} actions={headerActions} />
      {loading ? (
        <View style={{ padding: spacing.screenPadding, gap: spacing.sm }}>
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </View>
      ) : error ? (
        <ErrorState onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <EmptyState title={t('subjects.contentComingSoon')} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.sm, paddingHorizontal: spacing.screenPadding }}
          contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={refresh} />}
          renderItem={({ item }) => (
            <SubjectCard
              name={language === 'ne' ? item.titleNe : item.title}
              icon={item.icon as never}
              chapterCount={item.chapterCount}
              countLabel={t('learning.chapters')}
              progress={0}
              onPress={() => router.push(`/subjects/${item.id}`)}
            />
          )}
        />
      )}

      <PageLoaderOverlay visible={seeding} label={t('learning.seedRunning')} />
      <ConfirmDialog
        visible={showSeedConfirm}
        title={t('learning.seedTitle')}
        message={t('learning.seedScope')}
        confirmLabel={t('learning.seedCatalog')}
        onConfirm={handleSeed}
        onCancel={() => setShowSeedConfirm(false)}
      />
    </View>
  );
}
