import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { useRefreshOnFocus } from '@/src/core/hooks/useRefreshOnFocus';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { hasActivePremium } from '@/src/core/firebase/services/profile';
import { showToast } from '@/src/core/store/toastStore';
import {
  DEFAULT_LEARNING_COURSE_ID,
  DEFAULT_LEARNING_SUBCOURSE_ID,
} from '@/src/core/firebase/services/learning';
import {
  fetchSubjectChaptersWithProgress,
  type ChapterWithProgress,
} from '@/src/core/firebase/services/subjectChapterDetails';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { Button } from '@/src/components/buttons/Button';
import { ProgressRing } from '@/src/components/misc/ProgressRing';
import { Text } from '@/src/components/misc/Text';
import { ThemeToggleButton } from '@/src/components/misc/ThemeToggleButton';

type ChapterLanguage = 'ne' | 'en';

type ChapterStatProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  tint: string;
};

function ChapterStat({ icon, label, value, tint }: ChapterStatProps) {
  return (
    <View style={styles.summaryStat}>
      <View style={[styles.summaryStatIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={15} color="#0C2D91" />
      </View>
      <Text variant="h3" weight="bold" style={styles.summaryStatValue}>{value}</Text>
      <Text variant="caption" style={styles.summaryStatLabel}>{label}</Text>
    </View>
  );
}

function chapterName(chapter: ChapterWithProgress, language: ChapterLanguage): string {
  return language === 'ne' ? chapter.nameNe || chapter.name : chapter.name || chapter.nameNe;
}

export default function SubjectChaptersScreen() {
  const router = useRouter();
  const { colors, spacing, radius, effective, setMode } = useTheme();
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const { courseInfo, profile } = useProfileStore();
  const hasActivePro = hasActivePremium(profile);
  const params = useLocalSearchParams<{
    subjectId: string;
    course?: string;
    subcourse?: string;
    subjectName?: string;
    subjectPro?: string;
  }>();
  const subjectId = Array.isArray(params.subjectId) ? params.subjectId[0] : params.subjectId;
  const course = Array.isArray(params.course) ? params.course[0] : params.course;
  const subcourse = Array.isArray(params.subcourse) ? params.subcourse[0] : params.subcourse;
  const subjectNameParam = Array.isArray(params.subjectName) ? params.subjectName[0] : params.subjectName;
  const subjectPro = Array.isArray(params.subjectPro) ? params.subjectPro[0] : params.subjectPro;
  const resolvedCourse = course || courseInfo?.courseId || DEFAULT_LEARNING_COURSE_ID;
  const resolvedSubcourse = subcourse || courseInfo?.subcourseId || DEFAULT_LEARNING_SUBCOURSE_ID;
  const subjectName = subjectNameParam || subjectId || t('subjects.chaptersPage.chapter');
  const [chapterLanguage, setChapterLanguage] = useState<ChapterLanguage>('ne');
  const [selectedChapter, setSelectedChapter] = useState<ChapterWithProgress | null>(null);
  const [premiumChapter, setPremiumChapter] = useState<ChapterWithProgress | null>(null);

  const chapterData = useAsyncData(
    () => fetchSubjectChaptersWithProgress(resolvedCourse, resolvedSubcourse, subjectId, user?.uid),
    [resolvedCourse, resolvedSubcourse, subjectId, user?.uid],
    { enabled: Boolean(subjectId) },
  );
  useRefreshOnFocus(chapterData.refresh);

  const chapters = useMemo(() => chapterData.data ?? [], [chapterData.data]);
  const stats = useMemo(() => {
    const complete = chapters.filter((chapter) => chapter.progress.completed).length;
    const inProgress = chapters.filter((chapter) => (
      chapter.progress.percentage > 0 && !chapter.progress.completed
    )).length;
    const premium = chapters.filter((chapter) => chapter.pro).length;
    const average = chapters.length
      ? Math.round(chapters.reduce((total, chapter) => total + chapter.progress.percentage, 0) / chapters.length)
      : 0;
    return { complete, inProgress, premium, average };
  }, [chapters]);

  const showChapterActions = (chapter: ChapterWithProgress) => {
    if (chapter.pro && !hasActivePro) {
      setPremiumChapter(chapter);
      return;
    }
    setSelectedChapter(chapter);
  };

  const showNextUpdate = () => showToast(t('subjects.chaptersPage.nextUpdate'), 'info');

  const headerActions = (
    <View style={styles.headerActions}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={chapterLanguage === 'ne' ? t('subjects.chaptersPage.languageEn') : t('subjects.chaptersPage.languageNe')}
        onPress={() => setChapterLanguage((current) => (current === 'ne' ? 'en' : 'ne'))}
        style={styles.languageButton}
      >
        <Ionicons name="language-outline" size={18} color="#FFFFFF" />
        <Text variant="caption" weight="bold" style={styles.languageButtonText}>
          {chapterLanguage === 'ne' ? t('subjects.chaptersPage.languageEn') : t('subjects.chaptersPage.languageNe')}
        </Text>
      </Pressable>
      <ThemeToggleButton
        isDark={effective === 'dark'}
        onToggle={() => setMode(effective === 'dark' ? 'light' : 'dark')}
        size={38}
        iconColor="#FFFFFF"
        backgroundColor="rgba(255,255,255,0.16)"
      />
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}> 
      <TopAppBar
        title={t('subjects.chaptersPage.chapter')}
        onBackPress={() => router.back()}
        actions={headerActions}
      />
      <ScrollView
        contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.md, paddingBottom: spacing.xxl }}
        refreshControl={<AppRefreshControl refreshing={chapterData.refreshing} onRefresh={chapterData.refresh} />}
      >
        <View style={styles.subjectSubtitleWrap}>
          <Text variant="bodySmall" secondary style={styles.subjectSubtitle} numberOfLines={1}>
            {subjectName}
          </Text>
        </View>

        {!chapterData.loading && chapterData.error ? (
          <ErrorState onRetry={chapterData.refetch} />
        ) : !chapterData.loading && chapters.length === 0 ? (
          <EmptyState title={t('subjects.chaptersPage.noChapters')} />
        ) : !chapterData.loading ? (
          <>
            <LinearGradient
              colors={['#153DB8', '#0C2D91']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.summaryCard}
            >
              <View style={styles.summaryGlowTop} />
              <View style={styles.summaryGlowBottom} />
              <View style={styles.summaryHeader}>
                <View style={{ flex: 1 }}>
                  <Text variant="h2" weight="bold" style={styles.summaryTitle}>{subjectName}</Text>
                  <Text variant="bodySmall" style={styles.summaryHint}>{t('subjects.chaptersPage.totalTopics')}</Text>
                </View>
                <ProgressRing progress={stats.average / 100} size={78} strokeWidth={8} color="#FFD2A6" />
              </View>
              <View style={styles.summaryStatsRow}>
                <ChapterStat icon="layers-outline" label={t('subjects.chaptersPage.totalTopics')} value={chapters.length} tint="#C7D9FF" />
                <ChapterStat icon="checkmark-circle-outline" label={t('subjects.chaptersPage.complete')} value={stats.complete} tint="#B8E1FF" />
                <ChapterStat icon="pulse-outline" label={t('subjects.chaptersPage.inProgress')} value={stats.inProgress} tint="#C8F2DC" />
                <ChapterStat icon="diamond-outline" label={t('subjects.chaptersPage.premium')} value={stats.premium} tint="#FFD2A6" />
              </View>
              <Pressable onPress={showNextUpdate} style={({ pressed }) => [styles.analyticsButton, pressed && { opacity: 0.8 }]}>
                <Ionicons name="analytics-outline" size={17} color="#0C2D91" />
                <Text variant="bodySmall" weight="bold" style={styles.analyticsButtonText}>{t('subjects.chaptersPage.viewAnalytics')}</Text>
              </Pressable>
            </LinearGradient>

            <View style={styles.listHeader}>
              <Text variant="h3" weight="bold">{t('subjects.chaptersPage.chapter')}</Text>
              <Text variant="caption" secondary>{stats.average}% {t('subjects.chaptersPage.progress')}</Text>
            </View>
            <View style={{ gap: spacing.sm }}>
              {chapters.map((chapter) => {
                const progress = chapter.progress.percentage;
                const isLocked = chapter.pro && !hasActivePro;
                const isPurchased = chapter.pro && hasActivePro;
                return (
                  <Pressable
                    key={chapter.id}
                    onPress={() => showChapterActions(chapter)}
                    style={({ pressed }) => [
                      styles.chapterCard,
                      { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radius.lg },
                      pressed && styles.cardPressed,
                    ]}
                  >
                    <View style={styles.chapterCardTop}>
                      <View style={[styles.chapterNumber, { backgroundColor: isLocked ? '#FFF0DE' : isPurchased ? '#D1FAE5' : '#E7EEFF' }]}>
                        <Text variant="bodySmall" weight="bold" style={{ color: isLocked ? '#B45309' : isPurchased ? '#047857' : '#0C2D91' }}>
                          {String(chapter.order).padStart(2, '0')}
                        </Text>
                      </View>
                      <View style={styles.chapterNameBlock}>
                        <Text variant="body" weight="bold" numberOfLines={2}>{chapterName(chapter, chapterLanguage)}</Text>
                        <Text variant="caption" secondary numberOfLines={1}>
                          {chapterLanguage === 'ne' ? chapter.name : chapter.nameNe || chapter.name}
                        </Text>
                      </View>
                      {chapter.pro ? (
                        <View style={[styles.premiumBadge, { backgroundColor: isPurchased ? '#D1FAE5' : '#FFF0DE' }]}>
                          <Ionicons name={isPurchased ? 'checkmark-circle' : 'lock-closed'} size={12} color={isPurchased ? '#047857' : '#B45309'} />
                          <Text variant="caption" weight="bold" style={[styles.premiumBadgeText, { color: isPurchased ? '#047857' : '#B45309' }]}>
                            {isPurchased ? t('subjects.chaptersPage.purchasedActive') : t('subjects.chaptersPage.premium')}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.modeRow}>
                      <View style={styles.modeTags}>
                        <View style={[styles.modeTag, { backgroundColor: '#E7EEFF' }]}><Text variant="caption" weight="bold" style={styles.modeTagText}>P</Text></View>
                        <View style={[styles.modeTag, { backgroundColor: '#E7F7F0' }]}><Text variant="caption" weight="bold" style={[styles.modeTagText, { color: '#047857' }]}>R</Text></View>
                        <View style={[styles.modeTag, { backgroundColor: '#FFF0DE' }]}><Text variant="caption" weight="bold" style={[styles.modeTagText, { color: '#B45309' }]}>T</Text></View>
                      </View>
                      <View style={styles.progressTextWrap}>
                        <Text variant="caption" secondary>{progress}% {t('subjects.chaptersPage.progress')}</Text>
                        <View style={[styles.progressTrack, { backgroundColor: colors.surfaceAlt }]}>
                          <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: progress >= 100 ? '#059669' : '#2563EB' }]} />
                        </View>
                      </View>
                      <Ionicons name={isLocked ? 'lock-closed-outline' : 'chevron-forward'} size={18} color={isLocked ? '#B45309' : colors.textSecondary} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </ScrollView>

      <PageLoaderOverlay visible={chapterData.loading} label={t('common.loading')} />

      <Modal visible={!!premiumChapter} transparent animationType="fade" onRequestClose={() => setPremiumChapter(null)}>
        <Pressable style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]} onPress={() => setPremiumChapter(null)}>
          <Pressable style={[styles.premiumModal, { backgroundColor: colors.card }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.premiumIcon}><Ionicons name="lock-closed" size={28} color="#B45309" /></View>
            <Text variant="h2" weight="bold" style={styles.modalTitle}>{t('subjects.chaptersPage.premiumTitle')}</Text>
            <Text variant="body" secondary style={styles.modalCenteredText}>{premiumChapter ? chapterName(premiumChapter, chapterLanguage) : ''}</Text>
            <Text variant="bodySmall" secondary style={styles.modalCenteredText}>{t('subjects.chaptersPage.premiumMessage')}</Text>
            <Button
              label={t('subjects.chaptersPage.goToSubscriptionPlan')}
              onPress={() => { setPremiumChapter(null); router.push('/subscription'); }}
              icon={<Ionicons name="card-outline" size={18} color={colors.onPrimary} />}
            />
            <Button label={t('common.close')} variant="text" onPress={() => setPremiumChapter(null)} />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!selectedChapter} transparent animationType="slide" onRequestClose={() => setSelectedChapter(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSelectedChapter(null)}>
          <Pressable style={[styles.bottomSheet, { backgroundColor: colors.card }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text variant="h3" weight="bold">{selectedChapter ? chapterName(selectedChapter, chapterLanguage) : ''}</Text>
            <Text variant="bodySmall" secondary>{t('subjects.chaptersPage.free')}</Text>
            <View style={styles.sheetButtons}>
              <Button label={t('subjects.chaptersPage.practiceMode')} onPress={() => { setSelectedChapter(null); router.push({ pathname: '/subjects/practice', params: { courseId: resolvedCourse, subcourseId: resolvedSubcourse, subjectId, chapterId: selectedChapter?.id ?? '', unitId: selectedChapter?.unitId ?? '', subjectName, chapterName: selectedChapter ? chapterName(selectedChapter, chapterLanguage) : '', subjectPro: subjectPro ?? 'false', chapterPro: String(Boolean(selectedChapter?.pro)) } }); }} icon={<Ionicons name="play-circle-outline" size={18} color={colors.onPrimary} />} />
              <Button label={t('subjects.chaptersPage.readMode')} variant="secondary" onPress={() => { setSelectedChapter(null); router.push({ pathname: '/subjects/read', params: { courseId: resolvedCourse, subcourseId: resolvedSubcourse, subjectId, chapterId: selectedChapter?.id ?? '', unitId: selectedChapter?.unitId ?? '', subjectName, chapterName: selectedChapter ? chapterName(selectedChapter, chapterLanguage) : '', subjectPro: subjectPro ?? 'false', chapterPro: String(Boolean(selectedChapter?.pro)) } }); }} icon={<Ionicons name="book-outline" size={18} color={colors.primary} />} />
              <Button label={t('subjects.chaptersPage.theoryMode')} variant="secondary" onPress={() => { setSelectedChapter(null); router.push({ pathname: '/subjects/theory', params: { courseId: resolvedCourse, subcourseId: resolvedSubcourse, subjectId, chapterId: selectedChapter?.id ?? '', unitId: selectedChapter?.unitId ?? '', subjectName, chapterName: selectedChapter ? chapterName(selectedChapter, chapterLanguage) : '', subjectPro: subjectPro ?? 'false', chapterPro: String(Boolean(selectedChapter?.pro)) } }); }} icon={<Ionicons name="school-outline" size={18} color={colors.primary} />} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  subjectSubtitleWrap: { paddingHorizontal: 4, marginTop: -4 },
  subjectSubtitle: { fontWeight: '600' },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  languageButton: {
    minWidth: 64,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    gap: 5,
  },
  languageButtonText: { color: '#FFFFFF' },
  summaryCard: { minHeight: 255, borderRadius: 28, padding: 18, overflow: 'hidden', shadowColor: '#0C2D91', shadowOpacity: 0.26, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 7 },
  summaryGlowTop: { position: 'absolute', width: 160, height: 160, borderRadius: 80, top: -90, right: -40, backgroundColor: 'rgba(90,140,255,0.22)' },
  summaryGlowBottom: { position: 'absolute', width: 170, height: 170, borderRadius: 85, bottom: -125, left: -55, backgroundColor: 'rgba(17,94,255,0.2)' },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryTitle: { color: '#FFFFFF', marginBottom: 5 },
  summaryHint: { color: 'rgba(255,255,255,0.78)' },
  summaryStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, gap: 5 },
  summaryStat: { flex: 1, alignItems: 'center' },
  summaryStatIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  summaryStatValue: { color: '#FFFFFF' },
  summaryStatLabel: { color: 'rgba(255,255,255,0.78)', textAlign: 'center', fontSize: 10 },
  analyticsButton: { marginTop: 15, minHeight: 38, borderRadius: 19, paddingHorizontal: 13, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFFFFF' },
  analyticsButtonText: { color: '#0C2D91' },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  chapterCard: { padding: 14, borderWidth: 1, shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  cardPressed: { opacity: 0.84, transform: [{ scale: 0.99 }] },
  chapterCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  chapterNumber: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  chapterNameBlock: { flex: 1, gap: 3 },
  premiumBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 10, backgroundColor: '#FFF0DE' },
  premiumBadgeText: { color: '#B45309', fontSize: 10 },
  modeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 13, gap: 9 },
  modeTags: { flexDirection: 'row', gap: 5 },
  modeTag: { width: 25, height: 25, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  modeTagText: { color: '#0C2D91', fontSize: 11 },
  progressTextWrap: { flex: 1, gap: 5 },
  progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  premiumModal: { width: '100%', maxWidth: 420, borderRadius: 24, padding: 22, gap: 12, alignItems: 'center' },
  premiumIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0DE' },
  modalTitle: { textAlign: 'center' },
  modalCenteredText: { textAlign: 'center' },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.42)' },
  bottomSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, gap: 8 },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 6 },
  sheetButtons: { gap: 10, marginTop: 8 },
});
