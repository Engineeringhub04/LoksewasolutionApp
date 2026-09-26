// The app's one avatar primitive: a photo when there is one, initials when
// there is not.
//
// NOTE: the premium verified tick NO LONGER lives on the photo. It moved to the
// display name (Facebook style — "Kishan Raut ✔") via the shared NameWithTick
// component. The `pro` and `tickBorderColor` props are kept for API
// compatibility (call sites still pass them) but are no-ops here.
import React from 'react';
import { View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';

export interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  /** Deprecated: the tick now renders beside the name (NameWithTick). Kept so existing call sites keep compiling. */
  pro?: boolean;
  /** Deprecated: unused since the tick left the photo. */
  tickBorderColor?: string;
}

function initialsFor(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function Avatar({ uri, name, size = 44 }: AvatarProps) {
  const { colors } = useTheme();

  const face = uri ? (
    <ExpoImage source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" cachePolicy="memory-disk" />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* lineHeight MUST scale with fontSize. Text applies a fixed lineHeight
          from its variant token, so overriding only fontSize left the glyphs
          taller than their line box and the initials were visibly clipped at
          larger avatar sizes. includeFontPadding:false removes Android's extra
          font padding so the initials sit optically centred. */}
      <Text
        weight="semiBold"
        style={{
          color: colors.primary,
          fontSize: size * 0.38,
          lineHeight: size * 0.48,
          textAlign: 'center',
          includeFontPadding: false,
        }}
      >
        {initialsFor(name)}
      </Text>
    </View>
  );

  // The tick no longer lives on the photo — see NameWithTick beside the name.
  return face;
}
