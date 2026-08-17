import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { fetchTheoryResource, type LearningTheoryNote } from '@/src/core/firebase/services/learningContent';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';

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
      console.error('[TheoryMode] missing required route/auth params', {
        hasUser: Boolean(user?.uid),
        courseId,
        subcourseId,
        subjectId,
        unitId,
        chapterId,
      });
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
    router.push({
      pathname: '/pdf/[id]',
      params: { id: theory.id, uri: theory.pdfUrl, title: bilingual(theory.title, theory.titleNe) },
    });
  };

  const header = <SubpageHeader title={t('learningModes.theoryTitle')} />;

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}> 
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <PageLoaderOverlay visible label={t('common.loading')} />
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
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  pdfCard: { padding: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 1 },
});

