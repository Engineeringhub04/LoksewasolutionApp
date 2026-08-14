import { Alert, Linking, Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { Text } from '@/src/components/misc/Text';
import { Avatar } from '@/src/components/misc/Avatar';

export interface CommentCardProps {
  authorName: string;
  authorPhoto?: string | null;
  body: string;
  timestamp: string;
  indent?: boolean;
  onMenuPress?: () => void;
}

const URL_PATTERN = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

export function CommentCard({ authorName, authorPhoto, body, timestamp, indent, onMenuPress }: CommentCardProps) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const segments = body.split(URL_PATTERN);

  const openLink = (value: string) => {
    const url = value.startsWith('http') ? value : `https://${value}`;
    Alert.alert(t('discussion.openLinkTitle'), url, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('discussion.openLink'), onPress: () => Linking.openURL(url).catch(() => undefined) },
    ]);
  };

  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, marginLeft: indent ? spacing.xl : 0, paddingVertical: spacing.sm }}>
      <Avatar uri={authorPhoto} name={authorName} size={36} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}>
          <Text variant="bodySmall" weight="semiBold" style={{ flex: 1 }}>{authorName}</Text>
          <Text variant="caption" secondary>{timestamp}</Text>
          {onMenuPress ? (
            <Pressable
              onPress={onMenuPress}
              accessibilityRole="button"
              accessibilityLabel={t('discussion.commentOptions')}
              hitSlop={8}
              style={{ padding: 4, borderRadius: radius.pill }}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
        <View style={{ borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: spacing.sm }}>
          <Text variant="body">
            {segments.map((segment, index) => {
              const isLink = URL_PATTERN.test(segment);
              URL_PATTERN.lastIndex = 0;
              return isLink ? (
                <Text key={`${segment}-${index}`} variant="body" style={{ color: colors.primary }} onPress={() => openLink(segment)}>
                  {segment}
                </Text>
              ) : segment;
            })}
          </Text>
        </View>
      </View>
    </View>
  );
}
