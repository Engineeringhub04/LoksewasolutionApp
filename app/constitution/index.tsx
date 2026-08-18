import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { SearchBar } from '@/src/components/inputs/SearchBar';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';
import { ThemeToggleButton } from '@/src/components/misc/ThemeToggleButton';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { fetchConstitutionIndex, type ConstitutionFileEntry, type ConstitutionLanguage } from '@/src/core/services/constitution';

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function sectionLabel(item: ConstitutionFileEntry, language: ConstitutionLanguage): string {
  if (item.sectionType === 'preamble') return language === 'np' ? 'प्रस्तावना' : 'Preamble';
  if (item.sectionType === 'schedule') return language === 'np' ? `अनुसूची ${item.scheduleNo ?? ''}` : `Schedule ${item.scheduleNo ?? ''}`;
  return language === 'np' ? `भाग ${item.partNo ?? ''}` : `Part ${item.partNo ?? ''}`;
}

export default function ConstitutionIndexScreen() {
  const { colors, spacing, radius, effective, setMode } = useTheme();
  const router = useRouter();
  const [language, setLanguage] = useState<ConstitutionLanguage>('np');
  const [query, setQuery] = useState('');
  const constitution = useAsyncData(fetchConstitutionIndex, []);
  const index = constitution.data;

  const filteredFiles = useMemo(() => {
    if (!index) return [];
    const search = normalizeSearch(query);
    if (!search) return index.files;
    return index.files.filter((item) => {
      const haystack = [
        item.titleNp,
        item.titleEn,
        sectionLabel(item, 'np'),
        sectionLabel(item, 'en'),
        String(item.order),
        String(item.partNo ?? ''),
        String(item.scheduleNo ?? ''),
      ].join(' ').toLocaleLowerCase();
      return haystack.includes(search);
    });
  }, [index, query]);

  const title = language === 'np' ? index?.titleNp ?? 'नेपालको संविधान' : index?.titleEn ?? 'The Constitution of Nepal';
  const switchLanguage = () => setLanguage((current) => current === 'np' ? 'en' : 'np');

  const openPart = (item: ConstitutionFileEntry) => {
    const filename = item.file.split('/').pop() ?? item.file;
    router.push(`/constitution/${encodeURIComponent(filename)}`);
  };

  const rightSlot = (
    <View style={styles.headerActions}>
      <Pressable
        onPress={switchLanguage}
        accessibilityRole="button"
        accessibilityLabel="Change Constitution language"
        style={styles.languageButton}
      >
        <Ionicons name="language-outline" size={17} color="#FFF" />
        <Text variant="caption" weight="bold" style={styles.languageText}>{language === 'np' ? 'EN' : 'ने'}</Text>
      </Pressable>
      <ThemeToggleButton isDark={effective === 'dark'} onToggle={() => setMode(effective === 'dark' ? 'light' : 'dark')} size={36} />
    </View>
  );

  if (constitution.loading && !index) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <SubpageHeader title="नेपालको संविधान" rightSlot={rightSlot} />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text variant="bodySmall" weight="semiBold" secondary style={styles.stateText}>संविधान सामग्री तयार हुँदैछ...</Text>
        </View>
      </View>
    );
  }

  if (constitution.error && !index) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <SubpageHeader title="नेपालको संविधान" rightSlot={rightSlot} />
        <View style={styles.centerState}>
          <Ionicons name="cloud-offline-outline" size={46} color={colors.textSecondary} />
          <Text variant="h3" weight="bold" style={[styles.stateTitle, { color: colors.textPrimary }]}>Content unavailable</Text>
          <Text variant="bodySmall" secondary style={styles.stateDescription}>Internet जोडेर फेरि प्रयास गर्नुहोस्। पहिले download भएको content भए offline मा पनि खुल्नेछ।</Text>
          <Button label="Retry" onPress={constitution.refetch} />
        </View>
      </View>
    );
  }

  const listHeader = (
    <View>
      <View style={[styles.introCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
        <View style={[styles.introIcon, { backgroundColor: colors.primary + '18' }]}>
          <Ionicons name="library-outline" size={26} color={colors.primary} />
        </View>
        <View style={styles.introCopy}>
          <Text variant="body" weight="bold">{language === 'np' ? 'संविधानका भागहरू' : 'Constitution Sections'}</Text>
          <Text variant="caption" secondary>{index?.totalContentFiles ?? filteredFiles.length} {language === 'np' ? 'वटा section' : 'sections'}</Text>
        </View>
      </View>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder={language === 'np' ? 'संविधानका भागहरू खोज्नुहोस्' : 'Search Constitution sections'}
      />
      <Text variant="body" weight="bold" style={[styles.sectionHeading, { color: colors.textPrimary }]}>
        {language === 'np' ? 'भागहरू र अनुसूचीहरू' : 'Parts and Schedules'}
      </Text>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SubpageHeader title={title} rightSlot={rightSlot} />
      <FlatList
        data={filteredFiles}
        keyExtractor={(item) => item.file}
        renderItem={({ item, index: indexPosition }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(indexPosition, 8) * 35).duration(260)}>
            <Pressable
              onPress={() => openPart(item)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.partCard,
                { backgroundColor: colors.surface, borderColor: colors.divider, opacity: pressed ? 0.82 : 1 },
              ]}
            >
              <View style={[styles.orderBadge, { backgroundColor: colors.primary + '18' }]}>
                <Text variant="caption" weight="bold" color={colors.primary}>{String(item.order).padStart(2, '0')}</Text>
              </View>
              <View style={styles.partCopy}>
                <Text variant="caption" weight="semiBold" secondary>{sectionLabel(item, language)}</Text>
                <Text variant="body" weight="bold" numberOfLines={2} style={{ color: colors.textPrimary }}>
                  {language === 'np' ? item.titleNp : item.titleEn}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={21} color={colors.textSecondary} />
            </Pressable>
          </Animated.View>
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={(
          <View style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="search-outline" size={34} color={colors.textSecondary} />
            <Text variant="body" weight="semiBold" style={{ color: colors.textPrimary, marginTop: spacing.sm }}>No matching section</Text>
            <Text variant="caption" secondary style={styles.emptyText}>Search गरेर अर्को Part वा Schedule खोज्नुहोस्।</Text>
          </View>
        )}
        refreshControl={<AppRefreshControl refreshing={constitution.refreshing} onRefresh={constitution.refresh} />}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing.md, paddingBottom: spacing.xl }]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingTop: 16, gap: 12 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  languageButton: { height: 36, minWidth: 42, paddingHorizontal: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  languageText: { color: '#FFF' },
  introCard: { borderRadius: 18, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center' },
  introIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  introCopy: { marginLeft: 12, gap: 2 },
  sectionHeading: { marginTop: 6, marginBottom: 1 },
  partCard: { minHeight: 76, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  orderBadge: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  partCopy: { flex: 1, marginHorizontal: 12, gap: 3 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 },
  stateText: { marginTop: 12 },
  stateTitle: { marginTop: 14, textAlign: 'center' },
  stateDescription: { textAlign: 'center', marginTop: 8, marginBottom: 18, lineHeight: 20 },
  emptyCard: { borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingVertical: 34, paddingHorizontal: 24 },
  emptyText: { textAlign: 'center', marginTop: 5 },
});
