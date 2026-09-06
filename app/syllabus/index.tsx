import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useProfileStore } from '@/src/core/store/profileStore';
import { showToast } from '@/src/core/store/toastStore';
import { seedSyllabusData } from '@/src/core/firebase/services/syllabus';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { ThemeToggleButton } from '@/src/components/misc/ThemeToggleButton';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { IconButton } from '@/src/components/buttons/IconButton';

export default function SyllabusScreen() {
  const { colors, spacing, effective, setMode } = useTheme();
  const { t } = useTranslation();
  const { profile } = useProfileStore();
  const isAdmin = profile?.isAdmin === true;

  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    if (seeding) return;
    setSeeding(true);
    try {
      const count = await seedSyllabusData();
      showToast(`${t('syllabus.seedSuccess')} (${count} docs)`, 'success');
    } catch {
      showToast(t('syllabus.seedError'), 'error');
    } finally {
      setSeeding(false);
    }
  };

  const headerActions = (
    <View style={styles.headerActions}>
      {isAdmin && (
        seeding ? (
          <ActivityIndicator size="small" color="#FFFFFF" style={styles.seedLoader} />
        ) : (
          <IconButton
            name="server-outline"
            onPress={handleSeed}
            size={20}
            color="#FFFFFF"
            accessibilityLabel={t('syllabus.seedButton')}
            style={styles.seedButton}
          />
        )
      )}
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={t('syllabus.title')} actions={headerActions} />
      <View style={[styles.content, { padding: spacing.screenPadding }]}>
        <EmptyState title={t('syllabus.comingSoon')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seedButton: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 10,
  },
  seedLoader: {
    width: 38,
    height: 38,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
