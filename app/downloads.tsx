// §36 Downloads
import React, { useState } from 'react';
import { View, FlatList, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { useAsyncData } from '@/src/core/hooks/useAsyncData';
import { loadDownloads, removeDownload, clearAllDownloads, totalStorageUsed, formatBytes } from '@/src/core/firebase/services/downloads';
import { showToast } from '@/src/core/store/toastStore';
import { TopAppBar } from '@/src/components/nav/TopAppBar';
import { Text } from '@/src/components/misc/Text';
import { Button } from '@/src/components/buttons/Button';
import { Card } from '@/src/components/cards/Card';
import { EmptyState } from '@/src/components/feedback/EmptyState';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';
import { Skeleton } from '@/src/components/feedback/Skeleton';

const iconFor = { pdf: 'document-text-outline', note: 'create-outline', other: 'file-tray-outline' } as const;

export default function DownloadsScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const { data, loading, refetch } = useAsyncData(() => loadDownloads(), []);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const items = data ?? [];
  const total = totalStorageUsed(items);

  const handleRemove = async (id: string) => {
    await removeDownload(id);
    showToast(t('downloads.downloadRemoved'), 'success');
    refetch();
  };

  const handleClearAll = async () => {
    setShowClearConfirm(false);
    await clearAllDownloads();
    refetch();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TopAppBar title={t('downloads.title')} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.screenPadding, marginBottom: spacing.sm }}>
        <Text variant="body" secondary>{t('downloads.storageUsed')}: {formatBytes(total)}</Text>
        {items.length > 0 ? (
          <Button label={t('downloads.clearAll')} variant="text" onPress={() => setShowClearConfirm(true)} fullWidth={false} />
        ) : null}
      </View>

      {loading ? (
        <View style={{ padding: spacing.screenPadding, gap: spacing.sm }}>
          <Skeleton height={56} /><Skeleton height={56} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState title={t('downloads.empty')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.screenPadding, gap: spacing.sm }}
          renderItem={({ item }) => (
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name={iconFor[item.type]} size={24} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight="medium" numberOfLines={1}>{item.title}</Text>
                  <Text variant="caption" secondary>{formatBytes(item.sizeBytes)} · {new Date(item.downloadedAt).toLocaleDateString()}</Text>
                </View>
                <Pressable onPress={() => handleRemove(item.id)} accessibilityLabel={t('common.delete')}>
                  <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
            </Card>
          )}
        />
      )}

      <ConfirmDialog
        visible={showClearConfirm}
        title={t('downloads.clearAllConfirm')}
        destructive
        onConfirm={handleClearAll}
        onCancel={() => setShowClearConfirm(false)}
      />
    </View>
  );
}
