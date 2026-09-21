// Facebook-style verified name: the display name followed by the blue tick —
// "Kishan Raut ✔". The tick belongs to the NAME, not the photo, and it works
// with truncation: numberOfLines={1} on the text and flexShrink on the name
// mean a long name shortens to "Loksewa Solution Ad…" and the tick stays
// visible right after it.
//
// WHY A SHARED COMPONENT: the tick used to live on the avatar photo (stamped
// by Avatar/ProfileAvatar), which put it in a different place on every screen
// and fought with the pro ring. Names render in a dozen places; one component
// keeps the tick's size, colour and spacing identical in all of them.
import React from 'react';
import { View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { Text } from '@/src/components/misc/Text';
import { VerifiedTick, VERIFIED_BLUE } from '@/src/components/profile/VerifiedTick';

export interface NameWithTickProps {
  name: string;
  /** Show the tick. Pass the row's own premium flag — never a fetched profile. */
  pro?: boolean;
  /** Text variant forwarded to the name. */
  variant?: 'h3' | 'bodyLarge' | 'body' | 'bodySmall';
  weight?: 'semiBold' | 'bold';
  style?: StyleProp<TextStyle>;
  /** Wrapper style — the row this sits in. */
  containerStyle?: StyleProp<ViewStyle>;
  /** Tick diameter. Defaults scale with the text variant. */
  tickSize?: number;
  numberOfLines?: number;
}

/** Default tick diameter per text variant — roughly the text's cap height. */
const TICK_BY_VARIANT: Record<string, number> = {
  h3: 16,
  bodyLarge: 15,
  body: 14,
  bodySmall: 12,
};

export function NameWithTick({
  name,
  pro = false,
  variant = 'body',
  weight = 'bold',
  style,
  containerStyle,
  tickSize,
  numberOfLines = 1,
}: NameWithTickProps) {
  return (
    // NO default centering: in a list row the name must hug the avatar to its
    // left. Screens that want a centred name (Profile header) get it from their
    // parent's alignItems or via containerStyle.
    //
    // flexShrink: 1 on the ROW itself — without it the row measures at the
    // name's full text width and pushes siblings (language pill, buttons) off
    // screen instead of the name truncating. `minWidth: 0` lets it go below its
    // content width so numberOfLines can actually bite.
    <View style={[{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, minWidth: 0 }, containerStyle]}>
      <Text
        variant={variant}
        weight={weight}
        numberOfLines={numberOfLines}
        style={style}
      >
        {name}
      </Text>
      {pro ? (
        <VerifiedTick
          size={tickSize ?? TICK_BY_VARIANT[variant] ?? 14}
          // The disc's blue against any background: the badge is flat blue, so
          // its border uses its own blue rather than punching out white — on a
          // name row there is no photo to separate from, and a white ring on a
          // light surface would vanish.
          borderColor={VERIFIED_BLUE}
          style={{ marginLeft: 4 }}
        />
      ) : null}
    </View>
  );
}
