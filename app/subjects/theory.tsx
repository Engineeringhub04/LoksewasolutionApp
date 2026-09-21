import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { fetchTheoryResource, type LearningTheoryNote } from '@/src/core/firebase/services/learningContent';
import { recordActivityProgress } from '@/src/core/services/activityProgress';
import { recordAppActivity } from '@/src/core/services/appUsage';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { Preloading } from '@/src/components/Preloading';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { BookmarkButton } from '@/src/components/bookmarks/BookmarkButton';
import { ReportButton } from '@/src/components/report/ReportButton';

function valueOf(value: string | string[] | undefined, fallback = ''): string {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

function bilingual(english: string | null | undefined, nepali: string | null | undefined): string {
  const en = (english ?? '').trim();
  const ne = (nepali ?? '').trim();
  if (!en) return ne;
  if (!ne || ne === en) return en;
  return `${en} | ${ne}`;
}

export default function TheoryModeScreen() {
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
  const [theory, setTheory] = useState<LearningTheoryNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const courseId = valueOf(params.courseId);
  const subcourseId = valueOf(params.subcourseId);
  const subjectId = valueOf(params.subjectId);
  const chapterId = valueOf(params.chapterId);
  const unitId = valueOf(params.unitId) || null;
  const subjectName = valueOf(params.subjectName, subjectId);
  const chapterName = valueOf(params.chapterName, chapterId);

  const load = useCallback(async () => {
    if (!user?.uid || !subjectId || !chapterId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    try {
      const resource = await fetchTheoryResource({ courseId, subcourseId, subjectId, unitId, chapterId });
      setTheory(resource);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [chapterId, courseId, subcourseId, subjectId, unitId, user?.uid]);

  useEffect(() => {
    void load();
  }, [load]);

  // ===== Progress tracking =====
  // Like read mode, theory mode persisted nothing. There is no score here, so
  // what counts is time on the chapter and whether the PDF was actually opened —
  // opening it is what marks the chapter as studied.
  const openedPdfRef = useRef(false);
  const openedAtRef = useRef(Date.now());
  const trackingRef = useRef({ courseId, subcourseId, chapterId, uid: user?.uid ?? '' });
  trackingRef.current = { courseId, subcourseId, chapterId, uid: user?.uid ?? '' };

  useEffect(() => {
    openedAtRef.current = Date.now();
    return () => {
      const { uid, courseId: cid, subcourseId: sid, chapterId: chid } = trackingRef.current;
      const seconds = Math.round((Date.now() - openedAtRef.current) / 1000);
      if (!uid || !chid || (!openedPdfRef.current && seconds < 5)) return;

      void recordActivityProgress(uid, {
        source: 'theory',
        refId: chid,
        courseId: cid,
        subcourseId: sid,
        totalItems: 1,
        secondsSpent: seconds,
        countVisit: true,
        completed: openedPdfRef.current,
      });
      if (openedPdfRef.current) void recordAppActivity(uid);
    };
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) {
        router.back();
      }
      return true;
    });
    return () => subscription.remove();
  }, []);

  const openPdf = () => {
    if (!theory?.pdfUrl) return;
    openedPdfRef.current = true;
    router.push({
      pathname: '/pdf/[id]',
        params: { id: theory.id, uri: theory.pdfUrl, title: bilingual(theory.title, theory.titleNe), privacyProtected: '1' },
    });
  };

  const header = <SubpageHeader title={t('learningModes.theoryTitle')} />;

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}> 
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <Preloading tinted={false} label={t('common.loading')} hint={t('loadHints.common')} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}> 
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <DataNotFound title={t('common.somethingWentWrong')} description={t('common.retry')} onRetry={() => void load()} />
      </View>
    );
  }

  if (!theory || !theory.isPublished) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}> 
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <DataNotFound title={t('learningModes.noTheoryResource')} description={`${chapterName} · ${subjectName}`} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}> 
      <Stack.Screen options={{ headerShown: false }} />
      {header}
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.md }} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}> 
          <View style={[styles.iconCircle, { backgroundColor: `${colors.primary}15` }]}> 
            <Ionicons name="school-outline" size={30} color={colors.primary} />
          </View>
          <Text variant="h2" weight="bold" style={{ textAlign: 'center' }}>{bilingual(theory.title || chapterName, theory.titleNe)}</Text>
          <Text variant="bodySmall" secondary style={{ textAlign: 'center' }}>{chapterName} · {subjectName}</Text>
          <View style={styles.heroActions}>
            <BookmarkButton
              context="chapter"
              kind="read"
              refId={`${chapterId}:theory`}
              title={bilingual(theory.title || chapterName, theory.titleNe)}
              preview={`${chapterName} · ${subjectName}`}
              sourceLabel={`${t('learningModes.theoryTitle')} · ${subjectName}`}
              courseId={courseId}
              subcourseId={subcourseId}
              size={21}
              payload={{
                body: `${chapterName} · ${subjectName}`,
                meta: [
                  { label: t('bookmarks.subjectLabel'), value: subjectName },
                  { label: t('bookmarks.chapterLabel'), value: chapterName },
                ],
              }}
            />
            <ReportButton
              size={21}
              target={() => ({
                source: 'read',
                targetType: 'content',
                id: `${chapterId}:theory`,
                contextLabel: `${t('learningModes.theoryTitle')} · ${subjectName}`,
                title: bilingual(theory.title || chapterName, theory.titleNe),
                meta: [
                  { label: t('bookmarks.subjectLabel'), value: subjectName },
                  { label: t('bookmarks.chapterLabel'), value: chapterName },
                ],
                categoryGroup: 'content',
              })}
            />
          </View>
        </View>


        <View style={[styles.pdfCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}> 
          <View style={{ flex: 1 }}>
            <Text variant="bodyLarge" weight="bold">{t('learningModes.theoryResource')}</Text>
            <Text variant="bodySmall" secondary style={{ marginTop: 4 }}>{theory.pdfUrl ? t('learningModes.theoryResourceReady') : t('learningModes.noTheoryResource')}</Text>
          </View>
          <Ionicons name={theory.pdfUrl ? 'document-attach-outline' : 'document-outline'} size={28} color={theory.pdfUrl ? colors.primary : colors.textSecondary} />
        </View>

        {theory.pdfUrl ? (
          <Button
            label={t('learningModes.openTheoryPdf')}
            icon={<Ionicons name="open-outline" size={18} color={colors.onPrimary} />}
            onPress={openPdf}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  heroCard: { alignItems: 'center', padding: 22, borderWidth: 1, gap: 10, elevation: 1 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  pdfCard: { padding: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 1 },
});

