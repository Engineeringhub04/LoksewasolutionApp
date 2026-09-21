// The signed-in user's own avatar, wearing whichever ring their account earns.
//
// Home and Profile both show this person, and both headers show them twice
// (expanded and collapsed). That is four places that previously carried their
// own copy of the green glow styles, with a comment in each asking the next
// person to keep them in sync. They are consolidated here instead, so the rule
// for what the avatar looks like lives in exactly one file.
//
// WHERE THE RING IS AND IS NOT USED
//
// The coloured ring is a personal decoration, so it appears only where the user
// is looking at themselves: Home, Profile and Edit Profile. It deliberately does
// NOT follow them into leaderboards, exam rankings or discussions — a public
// list needs every row to read the same, and a ring around one face there would
// be decoration competing with rank. Those screens use the plain `Avatar` with
// `pro`, which gives the verified tick and nothing else.
//
// Both rings occupy the same outer box at every size, so a user's header never
// reflows the day their subscription starts or ends.
import React from 'react';
import { View } from 'react-native';
import { Avatar } from '@/src/components/misc/Avatar';
import { ProAvatarRing } from '@/src/components/profile/ProAvatarRing';

/** Free-tier ring colour, in both the expanded and collapsed headers. */
const GLOW_GREEN = '#22C55E';

/**
 * Per-size geometry for the green ring. `border + padding` is the ring's total
 * thickness and must equal ProAvatarRing's width for the same size, or swapping
 * between them moves the layout. Halo radius/elevation are cosmetic only.
 */
function glowStepFor(size: number) {
  if (size >= 64) return { border: 3, padding: 4, haloRadius: 14, elevation: 12 };
  if (size >= 36) return { border: 2.5, padding: 3, haloRadius: 12, elevation: 10 };
  return { border: 2, padding: 2, haloRadius: 8, elevation: 8 };
}

export interface ProfileAvatarProps {
  uri?: string | null;
  name?: string | null;
  /** Diameter of the photo. Both rings are drawn outside this. */
  size: number;
  /**
   * Premium entitlement is active right now — use `hasActivePremium(profile)`,
   * not the raw `isPremium` flag, so a lapsed subscription stops decorating the
   * avatar even before the next expiry sweep rewrites the stored field.
   *
   * Drives both marks at once: the premium ring instead of the green one, and
   * the verified tick that `Avatar` stamps on the rim.
   */
  pro?: boolean;
}

export function ProfileAvatar({ uri, name, size, pro = false }: ProfileAvatarProps) {
  // `pro` goes to the Avatar as well as deciding the ring: the tick lives on the
  // face, so it reaches every screen through one prop instead of each header
  // remembering to place a badge of its own.
  const avatar = <Avatar uri={uri} name={name ?? undefined} size={size} pro={pro} />;

  // The ring used to require a photo — an animated sweep around a grey initials
  // circle read as a loading spinner. Now that it stands still there is nothing
  // to mistake it for, so a premium member without a photo wears it too.
  if (pro) {
    return <ProAvatarRing size={size}>{avatar}</ProAvatarRing>;
  }

  const { border, padding, haloRadius, elevation } = glowStepFor(size);
  return (
    <View
      style={{
        padding,
        borderRadius: 999,
        borderWidth: border,
        borderColor: GLOW_GREEN,
        backgroundColor: 'rgba(34,197,94,0.22)',
        // Soft green halo — iOS reads shadow*, Android needs elevation.
        shadowColor: GLOW_GREEN,
        shadowOpacity: 0.9,
        shadowRadius: haloRadius,
        shadowOffset: { width: 0, height: 0 },
        elevation,
      }}
    >
      {avatar}
    </View>
  );
}
