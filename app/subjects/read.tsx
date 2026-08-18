import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { showToast } from '@/src/core/store/toastStore';
import { fetchReadQuestionSet, type LearningQuestion } from '@/src/core/firebase/services/learningContent';
import { Text } from '@/src/components/misc/Text';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';

function valueOf(value: string | string[] | undefined, fallback = ''): string {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

function bilingual(english: string, nepali: string): string {
  const ne = nepali.trim();
  return ne && ne !== english.trim() ? `${english} | ${ne}` : english;
}

export default function ReadModeScreen() {
  const params = useLocalSearchParams<{
    courseId?: string;
    subcourseId?: string;
    subjectId?: string;
    chapterId?: string;
    unitId?: string;
    subjectName?: string;
    chapterName?: string;
  }>();
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const [questions, setQuestions] = useState<LearningQuestion[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const courseId = valueOf(params.courseId);
  const subcourseId = valueOf(params.subcourseId);
  const subjectId = valueOf(params.subjectId);
  const chapterId = valueOf(params.chapterId);
  const unitId = valueOf(params.unitId) || null;
  const chapterName = valueOf(params.chapterName);

  const load = useCallback(async () => {
    if (!user?.uid || !subjectId || !chapterId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    try {
      const readQuestions = await fetchReadQuestionSet({ courseId, subcourseId, subjectId, unitId, chapterId });
      setQuestions(readQuestions);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [chapterId, courseId, subcourseId, subjectId, unitId, user?.uid]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) {
        router.back();
      }
      return true;
    });
    return () => subscription.remove();
  }, []);

  const expandAll = () => setExpanded(Object.fromEntries(questions.map((question) => [question.id, true])));
  const collapseAll = () => setExpanded({});

  const modeHeader = (
    <SubpageHeader
      title={t('learningModes.readTitle')}
      onBackPress={() => router.back()}
    />
  );

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        {modeHeader}
        <PageLoaderOverlay visible label={t('common.loading')} />
      </View>
    );
  }
  if (loadError) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        {modeHeader}
        <DataNotFound title={t('common.somethingWentWrong')} description={t('common.retry')} onRetry={() => void load()} />
      </View>
    );
  }
  if (questions.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        {modeHeader}
        <DataNotFound title={t('learning.noQuestions')} description={t('learningModes.noReadQuestions')} />
      </View>
    );
  }

  const allExpanded = questions.every((question) => expanded[question.id]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {modeHeader}

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.md }} showsVerticalScrollIndicator={false}>
        <View style={[styles.sectionHeader, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
          <View style={[styles.sectionIcon, { backgroundColor: `${colors.primary}15` }]}><Ionicons name="bookmark" size={22} color={colors.primary} /></View>
          <View style={styles.sectionTitle}>
            <Text variant="h3" weight="semiBold" style={{ lineHeight: 23 }}>{t('learningModes.importantQuestion')}</Text>
            <Text variant="caption" secondary numberOfLines={2} ellipsizeMode="tail" style={styles.chapterSubtitle}>{chapterName || t('subjects.chaptersPage.chapter')}</Text>
          </View>
          <Pressable onPress={allExpanded ? collapseAll : expandAll} style={styles.expandButton} accessibilityLabel={allExpanded ? t('learningModes.collapseAll') : t('learningModes.expandAll')}>
            <Ionicons name={allExpanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={19} color={colors.primary} />
            <Text variant="caption" weight="bold" style={styles.expandButtonLabel}>{allExpanded ? t('learningModes.collapseAll') : t('learningModes.expandAll')}</Text>
          </Pressable>
        </View>

        {questions.map((question, index) => {
          const isOpen = expanded[question.id] === true;
          const difficultyColor = question.difficulty === 'easy' ? colors.success : question.difficulty === 'medium' ? colors.warning : colors.error;
          return (
            <View key={question.id} style={[styles.questionCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
              <View style={styles.questionTopRow}>
                <View style={[styles.numberBadge, { backgroundColor: `${colors.primary}15` }]}><Text variant="bodySmall" weight="bold" style={{ color: colors.primary }}>Qn. {index + 1}</Text></View>
                <View style={[styles.difficultyBadge, { backgroundColor: `${difficultyColor}18` }]}><Text variant="caption" weight="bold" style={{ color: difficultyColor }}>{question.difficulty[0].toUpperCase() + question.difficulty.slice(1)}</Text></View>
                <View style={{ flex: 1 }} />
                <Pressable onPress={() => showToast(t('learningModes.bookmarkComingSoon'), 'info')} style={styles.smallAction} accessibilityLabel="Bookmark question"><Ionicons name="bookmark-outline" size={21} color={colors.primary} /></Pressable>
                <Pressable onPress={() => showToast(t('learningModes.reportComingSoon'), 'info')} style={styles.smallAction} accessibilityLabel="Report question"><Ionicons name="flag-outline" size={21} color={colors.error} /></Pressable>
              </View>
              <Text variant="h3" weight="semiBold" style={{ lineHeight: 24, fontSize: 18 }}>{bilingual(question.text, question.textNe)}</Text>
              <Pressable onPress={() => setExpanded((previous) => ({ ...previous, [question.id]: !isOpen }))} style={styles.answerToggle}>
                <Ionicons name={isOpen ? 'chevron-up-circle-outline' : 'chevron-down-circle-outline'} size={24} color={colors.primary} />
                <Text variant="bodySmall" weight="semiBold" style={{ color: colors.primary }}>{isOpen ? t('learningModes.collapseAnswer') : t('learningModes.showAnswer')}</Text>
              </Pressable>
              {isOpen ? (
                <View style={{ gap: spacing.sm }}>
                  {question.options.map((option, optionIndex) => {
                    const correct = optionIndex === question.correctIndex;
                    return <View key={optionIndex} style={[styles.readOption, { backgroundColor: correct ? `${colors.success}12` : colors.surface, borderColor: correct ? `${colors.success}80` : colors.border, borderRadius: radius.md }]}><View style={[styles.optionBullet, { borderColor: correct ? colors.success : colors.border, backgroundColor: correct ? colors.success : 'transparent' }]}><Text variant="caption" weight="bold" style={{ color: correct ? '#FFF' : colors.textSecondary }}>{String.fromCharCode(65 + optionIndex)}</Text></View><Text variant="bodySmall" style={{ flex: 1, lineHeight: 19, fontSize: 14 }}>{option}</Text>{correct ? <Ionicons name="checkmark-circle" size={20} color={colors.success} /> : null}</View>;
                  })}
                  <View style={[styles.explanationCard, { backgroundColor: `${colors.warning}12`, borderColor: `${colors.warning}55`, borderRadius: radius.md }]}>
                    <View style={styles.explanationTitle}><Ionicons name="bulb-outline" size={22} color={colors.warning} /><Text variant="bodyLarge" weight="bold" style={{ color: colors.warning }}>{t('learningModes.answerExplanation')}</Text></View>
                    <Text variant="bodySmall" style={{ lineHeight: 20, fontSize: 14 }}>{bilingual(question.explanation, question.explanationNe)}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { minHeight: 76, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  headerTitle: { color: '#FFF' },
  headerSubtitle: { color: 'rgba(255,255,255,0.78)', marginTop: 2 },
  sectionHeader: { borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, elevation: 1 },
  sectionTitle: { flex: 1, minWidth: 0, gap: 2 },
  chapterSubtitle: { flexShrink: 1, lineHeight: 17 },
  sectionIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  expandButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 7, paddingHorizontal: 5, flexShrink: 1, maxWidth: 132 },
  expandButtonLabel: { color: '#2559C7', flexShrink: 1, textAlign: 'right', lineHeight: 17, fontSize: 13 },
  questionCard: { borderWidth: 1, padding: 15, gap: 14, elevation: 1 },
  questionTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  numberBadge: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10 },
  difficultyBadge: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  smallAction: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  answerToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  readOption: { minHeight: 53, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionBullet: { width: 29, height: 29, borderRadius: 15, borderWidth: 1.4, alignItems: 'center', justifyContent: 'center' },
  explanationCard: { borderWidth: 1, padding: 13, gap: 8 },
  explanationTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
