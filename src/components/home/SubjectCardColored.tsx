// Premium subject card for Home's "Subjects" section: gradient background
// (2-tone, derived from the base color), decorative corner glow, icon in a
// glassy rounded box, and optional premium/footer actions.
import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '@/src/components/misc/Text';

export interface SubjectCardColoredProps {
  name: string;
  icon?: keyof typeof Ionicons.glyphMap;
  backgroundColor: string;
  onPress: () => void;
  premium?: boolean;
  premiumLabel?: string;
  purchased?: boolean;
  purchasedLabel?: string;
  footerLabel?: string;
  onFooterPress?: () => void;
}

// Darkens a hex color by a percentage, to build a 2-tone gradient from a
// single base color without needing a second color per subject.
function darken(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  const r = Math.max(0, ((num >> 16) & 0xff) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function SubjectCardColored({
  name,
  icon = 'bookmark',
  backgroundColor,
  onPress,
  premium = false,
  premiumLabel = 'Premium',
  purchased = false,
  purchasedLabel = 'Purchased (Active)',
  footerLabel,
  onFooterPress,
}: SubjectCardColoredProps) {
  const darkerShade = darken(backgroundColor, 40);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
      <LinearGradient colors={[backgroundColor, darkerShade]} style={[styles.card, footerLabel ? styles.cardWithFooter : null]}>
        <View style={styles.glow} />
        <View style={styles.topRow}>
          <View style={styles.iconBox}>
            <Ionicons name={icon} size={24} color="#FFF" />
          </View>
          {premium ? (
            <View style={purchased ? styles.purchasedTag : styles.premiumTag}>
              <Ionicons name={purchased ? 'checkmark-circle' : 'lock-closed'} size={11} color="#FFF" />
              <Text variant="caption" weight="bold" style={purchased ? styles.purchasedText : styles.premiumText}>
                {purchased ? purchasedLabel : premiumLabel}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="bodyLarge" weight="bold" style={styles.name} numberOfLines={2}>
          {name}
        </Text>
        {footerLabel ? (
          <Pressable onPress={onFooterPress ?? onPress} style={({ pressed }) => [styles.footer, pressed && { opacity: 0.72 }]}>
            <Text variant="caption" weight="semiBold" style={styles.footerText}>{footerLabel}</Text>
            <Ionicons name="arrow-forward" size={14} color="#FFF" />
          </Pressable>
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 164,
    height: 130,
    borderRadius: 18,
    padding: 14,
    justifyContent: 'space-between',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardWithFooter: {
    height: 172,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
  },
  premiumTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#9A3412',
    borderWidth: 1,
    borderColor: 'rgba(255,213,166,0.62)',
  },
  premiumText: {
    color: '#FFF',
    fontSize: 9,
    letterSpacing: 0.1,
  },
  purchasedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#047857',
    borderWidth: 1,
    borderColor: 'rgba(209,250,229,0.78)',
  },
  purchasedText: {
    color: '#FFF',
    fontSize: 9,
    letterSpacing: 0.1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  footerText: {
    color: '#FFF',
  },
  glow: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: '#FFF' },
});
