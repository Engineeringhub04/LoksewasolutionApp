// Shared curved header for auth screens (Login/Signup/Forgot/Reset Password).
// Bigger purple gradient card with logo, page title, and short description —
// all inside the header itself (no separate title block in the white body).
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
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
    <LinearGradient colors={['#7C3AED', '#A855F7', '#C084FC']} style={[styles.header, { paddingTop: insets.top + 16 }]}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </Pressable>
      ) : null}
      {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}

      <Animated.View entering={FadeIn.duration(400)} style={styles.content}>
        <View style={styles.logoCircle}>
          <Image
            source={AppConfig.identity.logoAsset}
            style={styles.logoImage}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={0}
          />
        </View>
        <Text variant="h1" weight="bold" style={styles.title}>{title}</Text>
        <Text variant="body" style={styles.subtitle}>{subtitle}</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: 32,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    alignItems: 'center',
  },
  backBtn: { position: 'absolute', top: 54, left: 16, zIndex: 10, padding: 6 },
  rightSlot: { position: 'absolute', top: 54, right: 16, zIndex: 10 },
  content: { alignItems: 'center', gap: 6, paddingHorizontal: 32, marginTop: 4 },
  logoCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  logoImage: { width: 58, height: 58 },
  title: { color: '#FFF', fontSize: 26, textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
