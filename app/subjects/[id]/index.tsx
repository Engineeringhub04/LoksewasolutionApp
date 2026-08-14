// Syllabus-driven Subject detail. Direct subjects show chapters; unit-first subjects show Units first.
import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchLearningChapters, fetchLearningSubject, fetchLearningUnits } from '@/src/core/firebase/services/learning';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { Text } from '@/src/components/misc/Text';
import { ProgressRing } from '@/src/components/misc/ProgressRing';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { Skeleton } from '@/src/components/feedback/Skeleton';
import { Card } from '@/src/components/cards/Card';

export default function SubjectDetailScreen() {
  const { id, unitId } = useLocalSearchParams<{ id: string; unitId?: string }>();
  const { colors, spacing } = useTheme();
  const { t, language } = useTranslation();
  const router = useRouter();
  const selectedUnitId = typeof unitId === 'string' && unitId.length > 0 ? unitId : null;

  const subject = useAsyncData(() => fetchLearningSubject(id), [id]);
  const units = useAsyncData(() => fetchLearningUnits(id), [id]);
  const chapters = useAsyncData(() => fetchLearningChapters(id, selectedUnitId), [id, selectedUnitId]);

  const selectedUnit = useMemo(
    () => (units.data ?? []).find((unit) => unit.id === selectedUnitId) ?? null,
    [selectedUnitId, units.data]
  );
  const isUnitFirst = subject.data?.hierarchy === 'unit-chapters';
  const showUnits = isUnitFirst && !selectedUnitId;
  const listLoading = showUnits ? units.loading : chapters.loading;
  const listError = showUnits ? units.error : chapters.error;
  const listRefetch = showUnits ? units.refetch : chapters.refetch;
  const listRefreshing = showUnits ? units.refreshing : chapters.refreshing;
  const listRefresh = showUnits ? units.refresh : chapters.refresh;
  const title = selectedUnit
    ? (language === 'ne' ? selectedUnit.titleNe : selectedUnit.title)
    : (subject.data ? (language === 'ne' ? subject.data.titleNe : subject.data.title) : '');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={title} />

      <View style={{ marginHorizontal: spacing.screenPadding, marginBottom: spacing.md, padding: spacing.md, borderRadius: 24, backgroundColor: colors.primary }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <ProgressRing progress={0} size={64} strokeWidth={6} color={colors.onPrimary} />
          <View style={{ flex: 1 }}>
            <Text variant="h3" weight="bold" style={{ color: colors.onPrimary }} numberOfLines={2}>{title}</Text>
            <Text variant="bodySmall" style={{ color: colors.onPrimary, opacity: 0.8 }}>
              {showUnits ? `${subject.data?.unitCount ?? 0} ${t('learning.units')}` : `${subject.data?.chapterCount ?? 0} ${t('learning.chapters')}`}
            </Text>
          </View>
        </View>
      </View>

      {listLoading ? (
        <View style={{ paddingHorizontal: spacing.screenPadding, gap: spacing.sm }}>
          <Skeleton height={88} /><Skeleton height={88} /><Skeleton height={88} />
        </View>
      ) : listError ? (
        <ErrorState onRetry={listRefetch} />
      ) : showUnits && (!units.data || units.data.length === 0) ? (
        <EmptyState title={t('subjects.contentComingSoon')} />
      ) : !showUnits && (!chapters.data || chapters.data.length === 0) ? (
        <EmptyState title={t('subjects.contentComingSoon')} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, gap: spacing.sm, paddingBottom: spacing.xl }}
          refreshControl={<AppRefreshControl refreshing={listRefreshing} onRefresh={listRefresh} />}
        >
          {showUnits
            ? (units.data ?? []).map((item) => {
                const itemTitle = language === 'ne' ? item.titleNe : item.title;
                return (
                  <Card key={item.id} onPress={() => router.push(`/subjects/${id}?unitId=${item.id}`)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }}>
                        <Ionicons name={item.icon as never} size={22} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyLarge" weight="semiBold" numberOfLines={3}>{itemTitle}</Text>
                        <Text variant="bodySmall" secondary>{item.chapterCount} {t('learning.chapters')}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                    </View>
                  </Card>
                );
              })
            : (chapters.data ?? []).map((item) => {
                const itemTitle = language === 'ne' ? item.titleNe : item.title;
                const query = selectedUnitId ? `?unitId=${selectedUnitId}` : '';
                return (
                  <Card key={item.id} onPress={() => router.push(`/subjects/${id}/${item.id}${query}`)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }}>
                        <Ionicons name="book-outline" size={22} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyLarge" weight="semiBold" numberOfLines={3}>{itemTitle}</Text>
                        <Text variant="bodySmall" secondary>{item.questionCount} {t('subscription.questions')}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                    </View>
                  </Card>
                );
              })}
        </ScrollView>
      )}
    </View>
  );
}
