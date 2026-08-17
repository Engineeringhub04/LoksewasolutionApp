import React, { useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutAnimation,
  Modal,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  UIManager,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { useRefreshOnFocus } from '@/src/core/hooks/useRefreshOnFocus';
import { useAuthStore } from '@/src/core/store/authStore';
import { useProfileStore } from '@/src/core/store/profileStore';
import { showToast } from '@/src/core/store/toastStore';
import {
  DEFAULT_LEARNING_COURSE_ID,
  DEFAULT_LEARNING_SUBCOURSE_ID,
} from '@/src/core/firebase/services/learning';
import {
  fetchSubjectChaptersWithProgress,
  type ChapterWithProgress,
} from '@/src/core/firebase/services/subjectChapterDetails';
import {
  fetchSubjectUnitsWithChapters,
  type SubjectUnitWithChapters,
  type UnitChapterWithProgress,
} from '@/src/core/firebase/services/subjectUnitDetails';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { Button } from '@/src/components/buttons/Button';
import { ProgressRing } from '@/src/components/misc/ProgressRing';
import { Text } from '@/src/components/misc/Text';
import { ThemeToggleButton } from '@/src/components/misc/ThemeToggleButton';

type DisplayChapter = {
  id: string;
  unitId: string | null;
  name: string;
  nameNe: string;
  order: number;
  pro: boolean;
  progress: { percentage: number; completed: boolean };
};

type UnitTrack = {
  id: string;
  label: string;
  unit?: SubjectUnitWithChapters;
  chapters: DisplayChapter[];
  direct: boolean;
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function StaggeredReveal({ children, index, animationKey }: { children: React.ReactNode; index: number; animationKey: string }) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(12)).current;

  React.useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(12);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 260, delay: index * 55, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, delay: index * 55, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [animationKey, index, opacity, translateY]);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

type UnitStatProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  tint: string;
};

function UnitStat({ icon, label, value, tint }: UnitStatProps) {
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

function chapterTitle(chapter: DisplayChapter, language: string): string {
  return language === 'ne' ? chapter.nameNe || chapter.name : chapter.name || chapter.nameNe;
}

function toDisplayChapter(chapter: UnitChapterWithProgress | ChapterWithProgress): DisplayChapter {
  return {
    id: chapter.id,
    unitId: 'unitId' in chapter ? chapter.unitId : null,
    name: chapter.name,
    nameNe: chapter.nameNe,
    order: chapter.order,
    pro: chapter.pro,
    progress: {
      percentage: chapter.progress.percentage,
      completed: chapter.progress.completed,
    },
  };
}

export default function SubjectUnitsScreen() {
  const router = useRouter();
  const { colors, spacing, radius, effective, setMode } = useTheme();
  const { t, language } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const { courseInfo } = useProfileStore();
  const params = useLocalSearchParams<{
    subjectId: string;
    course?: string;
    subcourse?: string;
    subjectName?: string;
  }>();
  const subjectId = Array.isArray(params.subjectId) ? params.subjectId[0] : params.subjectId;
  const courseParam = Array.isArray(params.course) ? params.course[0] : params.course;
  const subcourseParam = Array.isArray(params.subcourse) ? params.subcourse[0] : params.subcourse;
  const subjectNameParam = Array.isArray(params.subjectName) ? params.subjectName[0] : params.subjectName;
  const course = courseParam || courseInfo?.courseId || DEFAULT_LEARNING_COURSE_ID;
  const subcourse = subcourseParam || courseInfo?.subcourseId || DEFAULT_LEARNING_SUBCOURSE_ID;
  const subjectName = subjectNameParam || subjectId || t('subjects.unitsPage.units');
  const [selectedTrack, setSelectedTrack] = useState('all');
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<DisplayChapter | null>(null);
  const [premiumChapter, setPremiumChapter] = useState<DisplayChapter | null>(null);

  const unitData = useAsyncData(
    async () => {
      const units = await fetchSubjectUnitsWithChapters(course, subcourse, subjectId, user?.uid);
      let directChapters: ChapterWithProgress[] = [];
      try {
        directChapters = await fetchSubjectChaptersWithProgress(course, subcourse, subjectId, user?.uid);
      } catch {
        // Technical Subject normally has no direct chapters. Keep unit content usable
        // if the optional backward-compatible direct-chapter lookup is unavailable.
      }
      return {
        units,
        directChapters: directChapters.map(toDisplayChapter),
      };
    },
    [course, subcourse, subjectId, user?.uid],
    { enabled: Boolean(subjectId) },
  );
  useRefreshOnFocus(unitData.refresh);

  const tracks = useMemo<UnitTrack[]>(() => {
    const units = unitData.data?.units ?? [];
    const directChapters = unitData.data?.directChapters ?? [];
    const unitTracks = units.map((unit) => ({
      id: unit.id,
      label: `${unit.order}. ${language === 'ne' ? unit.nameNe || unit.name : unit.name || unit.nameNe}`,
      unit,
      chapters: unit.chapters.map(toDisplayChapter),
      direct: false,
    }));
    if (directChapters.length === 0) return unitTracks;
    return [
      {
        id: 'direct-chapters',
        label: subjectName,
        chapters: directChapters,
        direct: true,
      },
      ...unitTracks,
    ];
  }, [unitData.data, language, subjectName]);

  const allChapters = useMemo(
    () => tracks.flatMap((track) => track.chapters),
    [tracks],
  );
  const stats = useMemo(() => {
    const complete = allChapters.filter((chapter) => chapter.progress.completed).length;
    const inProgress = allChapters.filter((chapter) => (
      chapter.progress.percentage > 0 && !chapter.progress.completed
    )).length;
    const premium = allChapters.filter((chapter) => chapter.pro).length;
    const average = allChapters.length
      ? Math.round(allChapters.reduce((total, chapter) => total + chapter.progress.percentage, 0) / allChapters.length)
      : 0;
    return { complete, inProgress, premium, average };
  }, [allChapters]);

  const selectedTrackData = selectedTrack === 'all'
    ? null
    : tracks.find((track) => track.id === selectedTrack);

  const animateLayout = () => {
    LayoutAnimation.configureNext({
      duration: 260,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
  };

  const selectTrack = (trackId: string) => {
    animateLayout();
    setSelectedTrack(trackId);
    setExpandedUnit(null);
  };

  const toggleUnit = (trackId: string) => {
    animateLayout();
    setExpandedUnit((current) => (current === trackId ? null : trackId));
  };

  const showNextUpdate = () => showToast(t('subjects.unitsPage.nextUpdate'), 'info');

  const showChapterActions = (chapter: DisplayChapter) => {
    if (chapter.pro) {
      setPremiumChapter(chapter);
      return;
    }
    setSelectedChapter(chapter);
  };

  const headerActions = (
    <ThemeToggleButton
      isDark={effective === 'dark'}
      onToggle={() => setMode(effective === 'dark' ? 'light' : 'dark')}
      size={38}
      iconColor="#FFFFFF"
      backgroundColor="rgba(255,255,255,0.16)"
    />
  );

  const renderChapterCard = (chapter: DisplayChapter) => {
    const progress = chapter.progress.percentage;
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
          <View style={[styles.chapterNumber, { backgroundColor: chapter.pro ? '#FFF0DE' : '#E7EEFF' }]}>
            <Text variant="bodySmall" weight="bold" style={{ color: chapter.pro ? '#B45309' : '#0C2D91' }}>
              {String(chapter.order).padStart(2, '0')}
            </Text>
          </View>
          <View style={styles.chapterNameBlock}>
            <Text variant="body" weight="bold" numberOfLines={2}>{chapterTitle(chapter, language)}</Text>
            <Text variant="caption" secondary numberOfLines={1}>
              {language === 'ne' ? chapter.name : chapter.nameNe || chapter.name}
            </Text>
          </View>
          {chapter.pro ? (
            <View style={styles.premiumBadge}>
              <Ionicons name="lock-closed" size={12} color="#B45309" />
              <Text variant="caption" weight="bold" style={styles.premiumBadgeText}>{t('subjects.unitsPage.premium')}</Text>
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
            <Text variant="caption" secondary>{progress}% {t('subjects.unitsPage.progress')}</Text>
            <View style={[styles.progressTrack, { backgroundColor: colors.surfaceAlt }]}>
              <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: progress >= 100 ? '#059669' : '#2563EB' }]} />
            </View>
          </View>
          <Ionicons name={chapter.pro ? 'lock-closed-outline' : 'chevron-forward'} size={18} color={chapter.pro ? '#B45309' : colors.textSecondary} />
        </View>
      </Pressable>
    );
  };

  const renderUnitCard = (track: UnitTrack) => {
    const isExpanded = expandedUnit === track.id;
    return (
      <View key={track.id} style={[styles.unitCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radius.lg }]}>
        <Pressable
          onPress={() => toggleUnit(track.id)}
          style={({ pressed }) => [styles.unitCardHeader, { backgroundColor: track.direct ? colors.card : '#F2F6FF' }, pressed && styles.cardPressed]}
        >
          <View style={styles.unitIcon}><Ionicons name={track.direct ? 'albums-outline' : 'layers-outline'} size={20} color="#0C2D91" /></View>
          <View style={styles.unitNameBlock}>
            <Text variant="body" weight="bold" numberOfLines={2}>{track.label}</Text>
            <Text variant="caption" secondary>{track.chapters.length} {t('subjects.unitsPage.chapters')}</Text>
          </View>
          {track.unit?.pro ? (
            <View style={styles.premiumBadge}><Ionicons name="lock-closed" size={12} color="#B45309" /><Text variant="caption" weight="bold" style={styles.premiumBadgeText}>{t('subjects.unitsPage.premium')}</Text></View>
          ) : null}
          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
        </Pressable>
        {isExpanded ? (
          <View style={[styles.expandedChapters, { backgroundColor: colors.background }]}>
            {track.chapters.map((chapter, index) => (
              <StaggeredReveal key={`${track.id}-${chapter.id}`} index={index} animationKey={`${track.id}-${isExpanded}`}>
                {renderChapterCard(chapter)}
              </StaggeredReveal>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}> 
      <TopAppBar title={t('subjects.unitsPage.units')} onBackPress={() => router.back()} actions={headerActions} />
      {!unitData.loading ? (
        <ScrollView
          contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.md, paddingBottom: spacing.xxl }}
          refreshControl={<AppRefreshControl refreshing={unitData.refreshing} onRefresh={unitData.refresh} />}
        >
          <View style={styles.subjectSubtitleWrap}>
            <Text variant="bodySmall" secondary style={styles.subjectSubtitle} numberOfLines={1}>{subjectName}</Text>
          </View>
          {unitData.error ? <ErrorState onRetry={unitData.refetch} /> : allChapters.length === 0 ? (
            <EmptyState title={t('subjects.unitsPage.noUnits')} />
          ) : (
            <>
              <LinearGradient colors={['#153DB8', '#0C2D91']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.summaryCard}>
                <View style={styles.summaryGlowTop} />
                <View style={styles.summaryGlowBottom} />
                <View style={styles.summaryHeader}>
                  <View style={{ flex: 1 }}>
                    <Text variant="h2" weight="bold" style={styles.summaryTitle}>{subjectName}</Text>
                    <Text variant="bodySmall" style={styles.summaryHint}>{t('subjects.unitsPage.totalTopics')}</Text>
                  </View>
                  <ProgressRing progress={stats.average / 100} size={78} strokeWidth={8} color="#FFD2A6" />
                </View>
                <View style={styles.summaryStatsRow}>
                  <UnitStat icon="layers-outline" label={t('subjects.unitsPage.totalTopics')} value={allChapters.length} tint="#C7D9FF" />
                  <UnitStat icon="checkmark-circle-outline" label={t('subjects.unitsPage.complete')} value={stats.complete} tint="#B8E1FF" />
                  <UnitStat icon="pulse-outline" label={t('subjects.unitsPage.inProgress')} value={stats.inProgress} tint="#C8F2DC" />
                  <UnitStat icon="diamond-outline" label={t('subjects.unitsPage.premium')} value={stats.premium} tint="#FFD2A6" />
                </View>
                <Pressable onPress={showNextUpdate} style={({ pressed }) => [styles.analyticsButton, pressed && { opacity: 0.8 }]}>
                  <Ionicons name="analytics-outline" size={17} color="#0C2D91" />
                  <Text variant="bodySmall" weight="bold" style={styles.analyticsButtonText}>{t('subjects.unitsPage.viewAnalytics')}</Text>
                </Pressable>
              </LinearGradient>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trackRow}>
                <Pressable
                  onPress={() => selectTrack('all')}
                  style={({ pressed }) => [styles.trackChip, selectedTrack === 'all' && styles.trackChipActive, pressed && styles.trackChipPressed]}
                >
                  <Text variant="caption" weight="bold" style={selectedTrack === 'all' ? styles.trackTextActive : { color: colors.textSecondary }}>{t('subjects.unitsPage.all')}</Text>
                  <Text variant="caption" weight="bold" style={selectedTrack === 'all' ? styles.trackCountActive : { color: colors.textSecondary }}>{allChapters.length}</Text>
                </Pressable>
                {tracks.map((track) => (
                  <Pressable
                    key={track.id}
                    onPress={() => selectTrack(track.id)}
                    style={({ pressed }) => [styles.trackChip, selectedTrack === track.id && styles.trackChipActive, pressed && styles.trackChipPressed]}
                  >
                    <Text variant="caption" weight="bold" numberOfLines={1} style={selectedTrack === track.id ? styles.trackTextActive : { color: colors.textSecondary }}>{track.label}</Text>
                    <Text variant="caption" weight="bold" style={selectedTrack === track.id ? styles.trackCountActive : { color: colors.textSecondary }}>{track.chapters.length}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={styles.listHeader}>
                <View style={styles.listHeaderTitleBlock}>
                  <Text variant="h3" weight="bold" numberOfLines={2}>{selectedTrack === 'all' ? t('subjects.unitsPage.units') : selectedTrackData?.label}</Text>
                </View>
                <View style={styles.listProgressBlock}>
                  <Text variant="caption" secondary numberOfLines={1}>{stats.average}% {t('subjects.unitsPage.progress')}</Text>
                </View>
              </View>
              <View style={{ gap: spacing.sm }}>
                {selectedTrack === 'all'
                  ? tracks.map(renderUnitCard)
                  : selectedTrackData?.chapters.map((chapter, index) => (
                    <StaggeredReveal key={`${selectedTrack}-${chapter.id}`} index={index} animationKey={selectedTrack}>
                      {renderChapterCard(chapter)}
                    </StaggeredReveal>
                  ))}
              </View>
            </>
          )}
        </ScrollView>
      ) : null}

      <PageLoaderOverlay visible={unitData.loading} label={t('common.loading')} />

      <Modal visible={!!premiumChapter} transparent animationType="fade" onRequestClose={() => setPremiumChapter(null)}>
        <Pressable style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]} onPress={() => setPremiumChapter(null)}>
          <Pressable style={[styles.premiumModal, { backgroundColor: colors.card }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.premiumIcon}><Ionicons name="lock-closed" size={28} color="#B45309" /></View>
            <Text variant="h2" weight="bold" style={styles.modalTitle}>{t('subjects.unitsPage.premiumTitle')}</Text>
            <Text variant="body" secondary style={styles.modalCenteredText}>{premiumChapter ? chapterTitle(premiumChapter, language) : ''}</Text>
            <Text variant="bodySmall" secondary style={styles.modalCenteredText}>{t('subjects.unitsPage.premiumMessage')}</Text>
            <Button label={t('subjects.unitsPage.subscriptionRequired')} onPress={() => { setPremiumChapter(null); showNextUpdate(); }} icon={<Ionicons name="card-outline" size={18} color={colors.onPrimary} />} />
            <Button label={t('common.close')} variant="text" onPress={() => setPremiumChapter(null)} />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!selectedChapter} transparent animationType="slide" onRequestClose={() => setSelectedChapter(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSelectedChapter(null)}>
          <Pressable style={[styles.bottomSheet, { backgroundColor: colors.card }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text variant="h3" weight="bold">{selectedChapter ? chapterTitle(selectedChapter, language) : ''}</Text>
            <Text variant="bodySmall" secondary>{t('subjects.unitsPage.free')}</Text>
            <View style={styles.sheetButtons}>
              <Button label={t('subjects.unitsPage.practiceMode')} onPress={() => { setSelectedChapter(null); router.push({ pathname: '/subjects/practice', params: { courseId: course, subcourseId: subcourse, subjectId, unitId: selectedChapter?.unitId ?? '', chapterId: selectedChapter?.id ?? '', subjectName, chapterName: selectedChapter ? chapterTitle(selectedChapter, language) : '' } }); }} icon={<Ionicons name="play-circle-outline" size={18} color={colors.onPrimary} />} />
              <Button label={t('subjects.unitsPage.readMode')} variant="secondary" onPress={() => { setSelectedChapter(null); router.push({ pathname: '/subjects/read', params: { courseId: course, subcourseId: subcourse, subjectId, unitId: selectedChapter?.unitId ?? '', chapterId: selectedChapter?.id ?? '', subjectName, chapterName: selectedChapter ? chapterTitle(selectedChapter, language) : '' } }); }} icon={<Ionicons name="book-outline" size={18} color={colors.primary} />} />
              <Button label={t('subjects.unitsPage.theoryMode')} variant="secondary" onPress={() => { setSelectedChapter(null); router.push({ pathname: '/subjects/theory', params: { courseId: course, subcourseId: subcourse, subjectId, unitId: selectedChapter?.unitId ?? '', chapterId: selectedChapter?.id ?? '', subjectName, chapterName: selectedChapter ? chapterTitle(selectedChapter, language) : '' } }); }} icon={<Ionicons name="school-outline" size={18} color={colors.primary} />} />
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
  subjectSubtitle: { fontWeight: '700' },
  summaryCard: { minHeight: 242, borderRadius: 28, padding: 20, overflow: 'hidden', shadowColor: '#0C2D91', shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  summaryGlowTop: { position: 'absolute', width: 170, height: 170, borderRadius: 85, top: -100, right: -40, backgroundColor: 'rgba(90,140,255,0.22)' },
  summaryGlowBottom: { position: 'absolute', width: 180, height: 180, borderRadius: 90, bottom: -125, left: -70, backgroundColor: 'rgba(0,0,45,0.16)' },
  summaryHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  summaryTitle: { color: '#FFFFFF' },
  summaryHint: { color: 'rgba(255,255,255,0.78)', marginTop: 4 },
  summaryStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 22, gap: 8 },
  summaryStat: { flex: 1, alignItems: 'center', gap: 4 },
  summaryStatIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  summaryStatValue: { color: '#FFFFFF' },
  summaryStatLabel: { color: 'rgba(255,255,255,0.78)', textAlign: 'center', fontSize: 10 },
  analyticsButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 13, paddingVertical: 9, marginTop: 20 },
  analyticsButtonText: { color: '#0C2D91' },
  trackRow: { gap: 8, paddingVertical: 2 },
  trackChip: { minHeight: 40, maxWidth: 180, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 20, borderWidth: 1, borderColor: '#D5DCEC', paddingHorizontal: 13, backgroundColor: '#FFFFFF' },
  trackChipActive: { backgroundColor: '#0C2D91', borderColor: '#0C2D91' },
  trackChipPressed: { opacity: 0.78, transform: [{ scale: 0.96 }] },
  trackTextActive: { color: '#FFFFFF' },
  trackCountActive: { color: '#FFD2A6' },
  listHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  listHeaderTitleBlock: { flex: 1, minWidth: 0 },
  listProgressBlock: { width: 96, alignItems: 'flex-end', paddingTop: 4 },
  unitCard: { borderWidth: 1, overflow: 'hidden', shadowColor: '#0C2D91', shadowOpacity: 0.08, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  unitCardHeader: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13 },
  unitIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#DCE7FF', alignItems: 'center', justifyContent: 'center' },
  unitNameBlock: { flex: 1, minWidth: 0, gap: 4 },
  expandedChapters: { gap: 9, padding: 11, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#D7E2FF' },
  chapterCard: { borderWidth: 1, padding: 14, gap: 14 },
  chapterCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  chapterNumber: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chapterNameBlock: { flex: 1, gap: 3 },
  premiumBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF0DE', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  premiumBadgeText: { color: '#B45309', fontSize: 10 },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modeTags: { flexDirection: 'row', gap: 5 },
  modeTag: { width: 25, height: 25, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  modeTagText: { color: '#0C2D91' },
  progressTextWrap: { flex: 1, gap: 5 },
  progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  cardPressed: { opacity: 0.82 },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  premiumModal: { width: '100%', maxWidth: 390, borderRadius: 24, padding: 22, gap: 12, alignItems: 'center' },
  premiumIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFF0DE', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { textAlign: 'center' },
  modalCenteredText: { textAlign: 'center' },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  bottomSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, gap: 10 },
  sheetHandle: { alignSelf: 'center', width: 46, height: 5, borderRadius: 3, backgroundColor: '#CBD5E1', marginBottom: 5 },
  sheetButtons: { gap: 9, marginTop: 8 },
});
