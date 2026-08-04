// "SEED DEMO DATA" button — shown ONLY when app_onboarding-settings collection is empty.
// Once seeded, this button disappears permanently (data exists in Firestore).
import React from 'react';
import { View, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/src/components/misc/Text';

interface SeedDataButtonProps {
  onSeed: () => void;
  loading: boolean;
}

export function SeedDataButton({ onSeed, loading }: SeedDataButtonProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(500)}
      exiting={FadeOut.duration(300)}
      style={styles.container}
    >
      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={22} color="#FFD700" />
        <Text variant="bodySmall" style={styles.infoText}>
          No onboarding data found. Tap below to seed demo slides into Firestore.
        </Text>
      </View>

      <Pressable
        onPress={onSeed}
        disabled={loading}
        style={({ pressed }) => [
          styles.button,
          { opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] },
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <Ionicons name="cloud-upload" size={20} color="#FFFFFF" />
            <Text variant="body" weight="bold" style={styles.buttonText}>
              SEED DEMO DATA
            </Text>
          </>
        )}
      </Pressable>

      {loading && (
        <Text variant="bodySmall" style={styles.loadingText}>
          Uploading 4 slides to Firestore...
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
    width: '100%',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  infoText: {
    color: '#FFFFFF',
    opacity: 0.9,
    flex: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    gap: 10,
    width: '100%',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    letterSpacing: 1,
  },
  loadingText: {
    color: '#FFFFFF',
    opacity: 0.7,
    textAlign: 'center',
  },
});
