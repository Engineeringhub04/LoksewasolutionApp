// §38 Search
import React, { useState, useCallback, useRef } from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useSettingsStore } from '@/src/core/store/settingsStore';
import { searchContent } from '@/src/core/firebase/services/search';
import { useNetworkStatus } from '@/src/core/hooks/useNetworkStatus';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { SearchBar } from '@/src/components/inputs/SearchBar';
import { Text } from '@/src/components/misc/Text';
import { Chip } from '@/src/components/misc/Chip';
import { Card } from '@/src/components/cards/Card';
import { Spinner } from '@/src/components/feedback/Spinner';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { useManualRefresh } from '@/src/core/hooks/useManualRefresh';
import { AppRefreshControl } from '@/src/components/feedback/AppRefreshControl';

const DEBOUNCE_MS = 350;

export default function SearchScreen() {
  const { colors, spacing } = useTheme();
  const { refreshing, onRefresh } = useManualRefresh();
  const { t } = useTranslation();
  const router = useRouter();
  const { isOffline } = useNetworkStatus();
  const { recentSearches, addRecentSearch, clearRecentSearches } = useSettingsStore();

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchContent>> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (text: string) => {
    if (!text.trim() || isOffline) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const r = await searchContent(text);
      setResults(r);
      addRecentSearch(text);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffline]);

  const handleChangeText = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(text), DEBOUNCE_MS);
  };

  const hasResults = results && (results.subjects.length > 0 || results.discussions.length > 0 || results.questions.length > 0);
  const showingResults = query.trim().length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={t('search.title')} />
      <View style={{ paddingHorizontal: spacing.screenPadding, marginBottom: spacing.sm }}>
        <SearchBar value={query} onChangeText={handleChangeText} placeholder={t('search.placeholder')} autoFocus />
      </View>

      {!showingResults ? (
        <View style={{ paddingHorizontal: spacing.screenPadding }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text variant="bodySmall" weight="semiBold" secondary>{t('search.recent')}</Text>
            {recentSearches.length > 0 ? (
              <Text variant="bodySmall" style={{ color: colors.primary }} onPress={clearRecentSearches}>{t('common.close')}</Text>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {recentSearches.map((q) => (
              <Chip key={q} label={q} onPress={() => { setQuery(q); runSearch(q); }} />
            ))}
          </View>
        </View>
      ) : loading ? (
        <Spinner fullScreen />
      ) : !hasResults ? (
        <EmptyState title={t('search.noResults', { query })} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.md }}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {results!.subjects.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="bodySmall" weight="semiBold" secondary>{t('subjects.title')}</Text>
              {results!.subjects.map((s) => (
                <Card key={s.id} onPress={() => router.push(`/subjects/${s.id}`)}>
                  <Text variant="body">{s.name}</Text>
                </Card>
              ))}
            </View>
          ) : null}
          {results!.discussions.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="bodySmall" weight="semiBold" secondary>{t('discussion.title')}</Text>
              {results!.discussions.map((d) => (
                <Card key={d.id} onPress={() => router.push(`/discussion/${d.id}`)}>
                  <Text variant="body">{d.title}</Text>
                </Card>
              ))}
            </View>
          ) : null}
          {results!.questions.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="bodySmall" weight="semiBold" secondary>{t('bookmarks.questions')}</Text>
              {results!.questions.map((q) => (
                <Card key={q.id}>
                  <Text variant="body" numberOfLines={2}>{q.text}</Text>
                </Card>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
