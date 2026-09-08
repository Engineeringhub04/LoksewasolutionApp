// Shared curved header for auth screens (Login/Signup/Forgot/Reset Password).
// Blue gradient matching Subcourse cards, with professional layout, terms/privacy
// checkbox, and stable button spacing. Logo sits inside a white circle.
import React from 'react';
import { Image, View, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/src/components/misc/Text';
import { AppConfig } from '@/src/core/config/appConfig';

interface AuthHeaderProps {
  title: string;
  subtitle: string;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
}

export function AuthHeader({ title, subtitle, onBack, rightSlot }: AuthHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient colors={['#2563EB', '#1D4ED8', '#1E40AF']} style={[styles.header, { paddingTop: insets.top + 16 }]}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </Pressable>
      ) : null}
      {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}

      <View style={styles.content}>
        <View style={styles.logoCircle}>
          <Image
            source={AppConfig.identity.logoAsset}
            style={styles.logoImage}
            resizeMode="cover"
            resizeMethod="resize"
            fadeDuration={0}
          />
        </View>
        <Text variant="h1" weight="bold" style={styles.title}>{title}</Text>
        <Text variant="body" style={styles.subtitle}>{subtitle}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    alignItems: 'center',
  },
  backBtn: { position: 'absolute', top: 54, left: 16, zIndex: 10, padding: 6 },
  rightSlot: { position: 'absolute', top: 54, right: 16, zIndex: 10 },
  content: { alignItems: 'center', gap: 8, paddingHorizontal: 32, marginTop: 4 },
  logoCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    overflow: 'hidden',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#1E40AF',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  logoImage: { width: 76, height: 76 },
  title: { color: '#FFF', fontSize: 26, textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.88)', fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
