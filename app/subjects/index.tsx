import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { useRefreshOnFocus } from '@/src/core/hooks/useRefreshOnFocus';
import { useProfileStore } from '@/src/core/store/profileStore';
import { showToast } from '@/src/core/store/toastStore';
import {
  DEFAULT_LEARNING_COURSE_ID,
  DEFAULT_LEARNING_SUBCOURSE_ID,
} from '@/src/core/firebase/services/learning';
import {
  fetchSubjectDetails,
  seedSubjectDetails,
  type SubjectDetail,
} from '@/src/core/firebase/services/subjectDetails';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { SubjectCardColored } from '@/src/components/home/SubjectCardColored';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';
import { Button } from '@/src/components/buttons/Button';
import { Card } from '@/src/components/cards/Card';
import { Text } from '@/src/components/misc/Text';

const SUBJECT_COLORS = ['#2563EB', '#7C3AED', '#059669', '#EA580C'];
const SUBJECT_ICONS: (keyof typeof Ionicons.glyphMap)[] = ['globe-outline', 'briefcase-outline', 'construct-outline'];

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}>
      <Text variant="h3" weight="bold" style={{ color }}>{value}</Text>
      <Text variant="caption" secondary style={{ textAlign: 'center' }}>{label}</Text>
      <View style={{ width: 28, height: 3, borderRadius: 3, backgroundColor: colors.border }} />
    </View>
  );
}

export default function SubjectListScreen() {
  const { colors, spacing, effective, setMode, radius } = useTheme();
  const { t } = useTranslation();
  const { profile, courseInfo } = useProfileStore();
  const course = courseInfo?.courseId ?? DEFAULT_LEARNING_COURSE_ID;
  const subcourse = courseInfo?.subcourseId ?? DEFAULT_LEARNING_SUBCOURSE_ID;
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [premiumSubject, setPremiumSubject] = useState<SubjectDetail | null>(null);

  const subjectData = useAsyncData(
    () => fetchSubjectDetails(course, subcourse),
    [course, subcourse],
  );
  useRefreshOnFocus(subjectData.refresh);

  const subjects = useMemo(() => subjectData.data ?? [], [subjectData.data]);
  const stats = useMemo(() => ({
    total: subjects.length,
    premium: subjects.filter((subject) => subject.pro).length,
    complete: 0,
    inProgress: 0,
  }), [subjects]);

  const subcourseLabel = courseInfo?.subcourseName || (
    subcourse === DEFAULT_LEARNING_SUBCOURSE_ID ? 'Civil Assistant Sub Engineer' : subcourse
  );

  const handleSubjectAction = (subject: SubjectDetail) => {
    if (subject.pro) {
      setPremiumSubject(subject);
      return;
    }
    showToast(t('subjects.nextUpdate'), 'info');
  };

  const handleSeed = async () => {
    setShowSeedConfirm(false);
    setSeeding(true);
    try {
      const result = await seedSubjectDetails();
      showToast(`${t('subjects.seedSuccess')} ${result.records} ${t('subjects.seededRecords')}`, 'success');
      await subjectData.refresh();
    } catch {
      showToast(t('subjects.seedFailed'), 'error');
    } finally {
      setSeeding(false);
    }
  };

  const headerActions = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      {profile?.isAdmin ? (
        <Pressable
          accessibilityLabel={t('subjects.seedTitle')}
          onPress={() => setShowSeedConfirm(true)}
          style={styles.headerAction}
        >
          <Ionicons name="cloud-upload-outline" size={21} color={colors.onPrimary} />
        </Pressable>
      ) : null}
      <Pressable
        accessibilityLabel={t('settings.theme')}
        onPress={() => setMode(effective === 'dark' ? 'light' : 'dark')}
        style={styles.headerAction}
      >
        <Ionicons name={effective === 'dark' ? 'sunny-outline' : 'moon-outline'} size={20} color={colors.onPrimary} />
      </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={t('subjects.title')} actions={headerActions} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.md, paddingBottom: spacing.xxl }}
        refreshControl={<AppRefreshControl refreshing={subjectData.refreshing} onRefresh={subjectData.refresh} />}
      >
        <Card style={[styles.summaryCard, { borderRadius: radius.lg, backgroundColor: colors.card }]}>
          <View style={styles.summaryHeader}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.primary }]}>

              <Ionicons name="library-outline" size={25} color={colors.onPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="h3" weight="bold">{subcourseLabel}</Text>
              <Text variant="bodySmall" secondary>{t('subjects.totalAvailable')}</Text>
            </View>
            <View style={[styles.scopePill, { backgroundColor: colors.surfaceAlt }]}>
              <Text variant="caption" weight="semiBold" style={{ color: colors.primary }}>{course}</Text>
            </View>
          </View>
          <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
            <Stat label={t('subjects.totalAvailable')} value={stats.total} color={colors.primary} />
            <Stat label={t('subjects.complete')} value={stats.complete} color="#059669" />
            <Stat label={t('subjects.inProgress')} value={stats.inProgress} color="#D97706" />
            <Stat label={t('subjects.premium')} value={stats.premium} color="#B45309" />
          </View>
        </Card>

        {subjectData.error ? (
          <ErrorState onRetry={subjectData.refetch} />
        ) : !subjectData.loading && subjects.length === 0 ? (
          <EmptyState title={t('subjects.contentComingSoon')} />
        ) : (
          <View style={styles.subjectGrid}>
            {subjects.map((subject, index) => (
              <SubjectCardColored
                key={subject.id}
                name={subject.name}
                icon={SUBJECT_ICONS[index % SUBJECT_ICONS.length]}
                backgroundColor={SUBJECT_COLORS[index % SUBJECT_COLORS.length]}
                premium={subject.pro}
                premiumLabel={t('subjects.premium')}
                footerLabel={t('subjects.viewChapter')}
                onPress={() => handleSubjectAction(subject)}
                onFooterPress={() => handleSubjectAction(subject)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <PageLoaderOverlay visible={subjectData.loading || seeding} label={seeding ? t('subjects.seedRunning') : t('common.loading')} />

      <ConfirmDialog
        visible={showSeedConfirm}
        title={t('subjects.seedTitle')}
        message={t('subjects.seedMessage')}
        confirmLabel={t('subjects.seedConfirm')}
        onConfirm={handleSeed}
        onCancel={() => setShowSeedConfirm(false)}
      />

      <Modal visible={!!premiumSubject} transparent animationType="fade" onRequestClose={() => setPremiumSubject(null)}>
        <Pressable style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]} onPress={() => setPremiumSubject(null)}>
          <Pressable style={[styles.premiumModal, { backgroundColor: colors.card, borderRadius: radius.lg }]} onPress={(event) => event.stopPropagation()}>
            <View style={[styles.premiumIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="lock-closed" size={28} color="#B45309" />
            </View>
            <Text variant="h2" weight="bold" style={{ textAlign: 'center' }}>{t('subjects.premiumTitle')}</Text>
            <Text variant="body" secondary style={{ textAlign: 'center' }}>{premiumSubject?.name}</Text>
            <Text variant="bodySmall" secondary style={{ textAlign: 'center' }}>{t('subjects.premiumMessage')}</Text>
            <Button
              label={t('subjects.subscriptionRequired')}
              onPress={() => {
                setPremiumSubject(null);
                showToast(t('subjects.nextUpdate'), 'info');
              }}
              icon={<Ionicons name="card-outline" size={18} color={colors.onPrimary} />}
            />
            <Button label={t('common.close')} variant="text" onPress={() => setPremiumSubject(null)} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  summaryCard: {
    gap: 18,
    padding: 18,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopePill: {
    maxWidth: 112,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: 1,
    paddingTop: 15,
  },
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  premiumModal: {
    width: '100%',
    maxWidth: 390,
    padding: 24,
    gap: 13,
    alignItems: 'center',
  },
  premiumIcon: {
    width: 66,
    height: 66,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
});
