// Profile → App Settings → Course details.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAuthStore } from '@/src/core/store/authStore';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchUserCourseInfo } from '@/src/core/firebase/services/courses';
import { SubpageScrollScreen } from '@/src/components/nav/SubpageScrollScreen';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';

export default function CourseDetailsScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const { data, loading, refreshing, error, refetch, refresh } = useAsyncData(async () => {
    if (!user) return null;
    return fetchUserCourseInfo(user.uid);
  }, [user?.uid]);

  const rows: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[] = [
    { icon: 'school-outline', label: t('courseDetails.course'), value: data?.courseName ?? t('courseDetails.notSelected') },
    { icon: 'layers-outline', label: t('courseDetails.subcourse'), value: data?.subcourseName ?? t('courseDetails.notSelected') },
  ];

  return (
    <>
      <SubpageScrollScreen title={t('profile.courseDetails')} refreshing={refreshing} onRefresh={refresh}>
        {loading ? null : error ? (
          <DataNotFound onRetry={refetch} />
        ) : (
          <>
            <View style={[styles.hero, { backgroundColor: `${colors.primary}14`, borderRadius: radius.lg, padding: spacing.md }]}>
              <Ionicons name="school" size={26} color={colors.primary} />
              <Text variant="bodySmall" secondary style={{ flex: 1 }}>
                {t('courseDetails.intro')}
              </Text>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
              {rows.map((row, index) => (
                <React.Fragment key={row.label}>
                  {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.divider }]} /> : null}
                  <View style={[styles.row, { padding: spacing.md, gap: spacing.md }]}>
                    <View style={[styles.iconBox, { backgroundColor: `${colors.primary}17`, borderRadius: radius.md }]}>
                      <Ionicons name={row.icon} size={20} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="caption" secondary>{row.label}</Text>
                      <Text variant="bodyLarge" weight="bold">{row.value}</Text>
                    </View>
                  </View>
                </React.Fragment>
              ))}
            </View>

            <View style={[styles.noteBox, { borderColor: colors.border, borderRadius: radius.md, padding: spacing.md }]}>
              <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
              <Text variant="caption" secondary style={{ flex: 1 }}>{t('courseDetails.changeNote')}</Text>
            </View>

            <Button label={t('courseDetails.changeCourse')} onPress={() => router.push('/course-setup?mode=update')} />
          </>
        )}
      </SubpageScrollScreen>
      <PageLoaderOverlay visible={loading || refreshing} label={t('courseDetails.loading')} />
    </>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  noteBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth },
});
