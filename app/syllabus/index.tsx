// §Syllabus (Phase 2) — shows the user's enrolled course as a premium gradient
// "Active Course" banner, then one card per available syllabus level for that
// course. Tapping a card opens the shared in-app PDF viewer (/pdf/[id]) which is
// locked to light mode, has the curved shared header, pinch/double-tap zoom,
// text selection on editable PDFs, and a page counter.
//
// Data is real: fetchSyllabusList(courseId) reads app_syllabusdata filtered by
// the enrolled course. No seeding here — that was a Phase 1 admin utility and
// has been removed.
import React from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useProfileStore } from '@/src/core/store/profileStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { useRefreshOnFocus } from '@/src/core/hooks/useRefreshOnFocus';
import { fetchSyllabusList, type SyllabusData } from '@/src/core/firebase/services/syllabus';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { Text } from '@/src/components/misc/Text';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';

export default function SyllabusScreen() {
  const { colors, spacing } = useTheme();
  const { t, language } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const courseInfo = useProfileStore((s) => s.courseInfo);
  const courseId = courseInfo?.courseId ?? null;
  const courseName = courseInfo?.courseName ?? null;
  const subcourseName = courseInfo?.subcourseName ?? null;

  const {
    data: syllabusList,
    loading,
    refreshing,
    error,
    refetch,
    refresh,
  } = useAsyncData<SyllabusData[]>(
    () => (courseId ? fetchSyllabusList(courseId) : Promise.resolve([])),
    [courseId],
    { enabled: !!courseId },
  );

  useRefreshOnFocus(refresh);

  const openSyllabus = (item: SyllabusData) => {
    const title = language === 'ne' ? item.nameNe || item.name : item.name || item.nameNe;
    router.push({
      pathname: '/pdf/[id]',
      params: { id: item.id, uri: item.pdfLink, title },
    } as never);
  };

  const renderBody = () => {
    // No course enrolled — steer the user to Course Setup.
    if (!courseId) {
      return (
        <EmptyState
          icon="school-outline"
          title={t('syllabus.noCourseTitle')}
          description={t('syllabus.noCourseMessage')}
          ctaLabel={t('syllabus.selectCourse')}
          ctaIcon="arrow-forward"
          onCtaPress={() => router.push('/course-setup' as never)}
        />
      );
    }

    // Initial load shows the centered opaque loader (below), not inline
    // skeletons — keeps the loading treatment consistent with Daily Test/Home.
    if (loading && !syllabusList) {
      return null;
    }

    if (error) {
      return <ErrorState message={t('syllabus.errorMessage')} onRetry={refetch} />;
    }

    if (!syllabusList || syllabusList.length === 0) {
      return (
        <EmptyState
          icon="document-text-outline"
          title={t('syllabus.emptyTitle')}
          description={t('syllabus.emptyMessage')}
        />
      );
    }

    return (
      <View style={{ gap: spacing.md }}>
        <View style={styles.sectionRow}>
          <Text variant="h3" weight="bold">{t('syllabus.listSectionTitle')}</Text>
          <View style={[styles.countPill, { backgroundColor: `${colors.primary}14` }]}>
            <Text variant="caption" weight="bold" style={{ color: colors.primary }}>
              {syllabusList.length}
            </Text>
          </View>
        </View>

        {syllabusList.map((item, index) => {
          const displayName =
            language === 'ne' ? item.nameNe || item.name : item.name || item.nameNe;
          return (
            <Animated.View key={item.id} entering={FadeInDown.delay(index * 60).springify()}>
              <Pressable
                onPress={() => openSyllabus(item)}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.85 : 1,
                    transform: [{ scale: pressed ? 0.99 : 1 }],
                  },
                ]}
              >
                <View style={[styles.cardIcon, { backgroundColor: `${colors.primary}14` }]}>
                  <Ionicons name="document-text" size={24} color={colors.primary} />
                </View>

                <View style={styles.cardBody}>
                  <Text variant="bodyLarge" weight="semiBold" numberOfLines={2}>
                    {displayName}
                  </Text>
                  <View style={styles.cardMetaRow}>
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor: item.isPro ? '#F59E0B22' : '#22C55E22',
                        },
                      ]}
                    >
                      <Ionicons
                        name={item.isPro ? 'star' : 'checkmark-circle'}
                        size={11}
                        color={item.isPro ? '#D97706' : '#16A34A'}
                      />
                      <Text
                        variant="caption"
                        weight="bold"
                        style={{ color: item.isPro ? '#D97706' : '#16A34A' }}
                      >
                        {item.isPro ? t('syllabus.proBadge') : t('syllabus.freeBadge')}
                      </Text>
                    </View>
                    <Text variant="caption" secondary>
                      {t('syllabus.openHint')}
                    </Text>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={t('syllabus.title')} />

      {/* Body wrapper — the loader below is absolute-filled to THIS view rather
          than the screen, so the header stays visible while loading and the
          spinner centres in the content area beneath it. */}
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            padding: spacing.screenPadding,
            paddingBottom: insets.bottom + spacing.xl,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            courseId ? <AppRefreshControl refreshing={refreshing} onRefresh={refresh} /> : undefined
          }
        >
        {/* Active Course banner — premium blue gradient, curved, matches the
           app's dark-gradient card family. */}
        {courseId && courseName ? (
          <LinearGradient
            colors={['#2563EB', '#1D4ED8', '#0B1F5B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.activeCard}
          >
            <View style={styles.activeGlow} />
            <View style={styles.activeIconBox}>
              <Ionicons name="school" size={26} color="#FFFFFF" />
            </View>
            <View style={styles.activeTextCol}>
              <Text variant="bodySmall" weight="semiBold" style={styles.activeLabel}>
                {t('syllabus.activeCourseLabel')}
              </Text>
              <Text variant="h2" weight="bold" style={styles.activeTitle} numberOfLines={2}>
                {courseName}
              </Text>
              {subcourseName ? (
                <Text variant="bodySmall" style={styles.activeSub} numberOfLines={1}>
                  {subcourseName}
                </Text>
              ) : null}
            </View>
            <View style={styles.activeTrendBox}>
              <Ionicons name="trending-up" size={22} color="#FFFFFF" />
            </View>
          </LinearGradient>
        ) : null}

        <View style={{ marginTop: courseId && courseName ? spacing.lg : 0, flex: 1 }}>
          {renderBody()}
        </View>
        </ScrollView>

        <PageLoaderOverlay
          visible={loading && !syllabusList && !!courseId}
          opaque
          label="Loading Syllabus..."
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 24,
    padding: 18,
    overflow: 'hidden',
    shadowColor: '#1D4ED8',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  activeGlow: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  activeIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTextCol: { flex: 1, gap: 3 },
  activeLabel: { color: 'rgba(255,255,255,0.78)', letterSpacing: 0.3 },
  activeTitle: { color: '#FFFFFF' },
  activeSub: { color: 'rgba(255,255,255,0.72)', marginTop: 2 },
  activeTrendBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countPill: {
    minWidth: 24,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 6 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
});
