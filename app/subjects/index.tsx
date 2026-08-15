import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import { fetchSubjectDetails, type SubjectDetail } from '@/src/core/firebase/services/subjectDetails';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { ThemeToggleButton } from '@/src/components/misc/ThemeToggleButton';
import { SubjectCardColored } from '@/src/components/home/SubjectCardColored';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { ErrorState } from '@/src/components/feedback/ErrorState';
import { Button } from '@/src/components/buttons/Button';
import { Text } from '@/src/components/misc/Text';

const SUBJECT_COLORS = ['#2563EB', '#7C3AED', '#059669', '#EA580C'];
const SUBJECT_ICONS: (keyof typeof Ionicons.glyphMap)[] = ['globe-outline', 'briefcase-outline', 'construct-outline'];

type JourneyStatProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
};

function JourneyStat({ icon, label, value }: JourneyStatProps) {
  return (
    <View style={styles.journeyStat}>
      <View style={styles.journeyStatIcon}>
        <Ionicons name={icon} size={23} color="#FFFFFF" />
      </View>
      <Text variant="h2" weight="bold" style={styles.journeyStatValue}>{value}</Text>
      <Text variant="caption" style={styles.journeyStatLabel}>{label}</Text>
    </View>
  );
}

export default function SubjectListScreen() {
  const { colors, spacing, effective, setMode } = useTheme();
  const { t } = useTranslation();
  const { courseInfo } = useProfileStore();
  const course = courseInfo?.courseId ?? DEFAULT_LEARNING_COURSE_ID;
  const subcourse = courseInfo?.subcourseId ?? DEFAULT_LEARNING_SUBCOURSE_ID;
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

  const headerActions = (
    <ThemeToggleButton
      isDark={effective === 'dark'}
      onToggle={() => setMode(effective === 'dark' ? 'light' : 'dark')}
      size={38}
      iconColor="#FFFFFF"
      backgroundColor="rgba(255,255,255,0.16)"
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={t('subjects.title')} actions={headerActions} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.md, paddingBottom: spacing.xxl }}
        refreshControl={<AppRefreshControl refreshing={subjectData.refreshing} onRefresh={subjectData.refresh} />}
      >
        <LinearGradient
          colors={['#153DB8', '#0C2D91']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.journeyCard}
        >
          <View style={styles.journeyGlowTop} />
          <View style={styles.journeyGlowBottom} />
          <View style={styles.journeyHeader}>
            <View style={{ flex: 1 }}>
              <Text variant="h2" weight="bold" style={styles.journeyTitle}>{t('subjects.journeyTitle')}</Text>
              <Text variant="body" style={styles.journeySubtitle}>
                {stats.total} {t('subjects.subjectsAvailable')}
              </Text>
            </View>
            <View style={styles.journeyScopePill}>
              <Text variant="caption" weight="bold" style={styles.journeyScopeText}>{subcourseLabel}</Text>
            </View>
          </View>

          <View style={styles.journeyStatsRow}>
            <JourneyStat icon="checkmark-circle" label={t('subjects.complete')} value={stats.complete} />
            <JourneyStat icon="play-circle" label={t('subjects.inProgress')} value={stats.inProgress} />
            <JourneyStat icon="lock-closed" label={t('subjects.premium')} value={stats.premium} />
          </View>
        </LinearGradient>

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

      <PageLoaderOverlay visible={subjectData.loading} label={t('common.loading')} />

      <Modal visible={!!premiumSubject} transparent animationType="fade" onRequestClose={() => setPremiumSubject(null)}>
        <Pressable style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]} onPress={() => setPremiumSubject(null)}>
          <Pressable style={[styles.premiumModal, { backgroundColor: colors.card }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.premiumIcon}>
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
  journeyCard: {
    minHeight: 290,
    borderRadius: 28,
    padding: 22,
    overflow: 'hidden',
    shadowColor: '#0C2D91',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  journeyGlowTop: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    top: -100,
    right: -40,
    backgroundColor: 'rgba(90,140,255,0.22)',
  },
  journeyGlowBottom: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    bottom: -125,
    left: -70,
    backgroundColor: 'rgba(0,0,45,0.16)',
  },
  journeyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 22,
  },
  journeyTitle: {
    color: '#FFFFFF',
    letterSpacing: 0.15,
  },
  journeySubtitle: {
    color: '#D6E2FF',
    marginTop: 6,
  },
  journeyScopePill: {
    maxWidth: 130,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  journeyScopeText: {
    color: '#FFFFFF',
    textAlign: 'center',
  },
  journeyStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  journeyStat: {
    flex: 1,
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 14,
    borderRadius: 19,
    backgroundColor: 'rgba(105,132,204,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  journeyStatIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
    backgroundColor: 'rgba(255,255,255,0.98)',
  },
  journeyStatValue: {
    color: '#FFFFFF',
    lineHeight: 34,
  },
  journeyStatLabel: {
    color: '#E2EAFF',
    textAlign: 'center',
    marginTop: 2,
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
    borderRadius: 24,
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
    backgroundColor: '#FEF3C7',
  },
});
