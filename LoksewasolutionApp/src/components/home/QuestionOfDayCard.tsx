// Professional Question of the Day card for Home. Shows a blinking "LIVE" tag
// before the user has answered today's question (per-course, once per day),
// and a static "COMPLETED" tag after.
import React, { useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, withRepeat, withTiming, useAnimatedStyle, Easing } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { Text } from '@/src/components/misc/Text';

interface QuestionOfDayCardProps {
  answered: boolean;
  onPress: () => void;
}

export function QuestionOfDayCard({ answered, onPress }: QuestionOfDayCardProps) {
  const { radius } = useTheme();
  const blink = useSharedValue(1);

  useEffect(() => {
    if (!answered) {
      blink.value = withRepeat(withTiming(0.3, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
    }
  }, [answered, blink]);

  const blinkStyle = useAnimatedStyle(() => ({ opacity: answered ? 1 : blink.value }));

  return (
    <Pressable onPress={onPress} style={{ marginHorizontal: 16, marginBottom: 16 }}>
      <LinearGradient colors={['#4338CA', '#6366F1', '#818CF8']} style={[styles.card, { borderRadius: radius.lg }]}>
        <View style={styles.iconCircle}>
          <Ionicons name="bulb" size={26} color="#FFF" />
        </View>

        <View style={styles.textCol}>
          <Text variant="bodyLarge" weight="bold" style={styles.title}>Question of the Day</Text>
          <Text variant="bodySmall" style={styles.subtitle}>
            {answered ? "You've answered today's question" : 'Test your knowledge with a new question'}
          </Text>
        </View>

        <Animated.View style={[styles.tag, { backgroundColor: answered ? '#16A34A' : '#DC2626' }, blinkStyle]}>
          <Text variant="caption" weight="bold" style={styles.tagText}>{answered ? 'DONE' : 'LIVE'}</Text>
        </Animated.View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    shadowColor: '#4338CA',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  iconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  textCol: { flex: 1, gap: 2 },
  title: { color: '#FFF' },
  subtitle: { color: 'rgba(255,255,255,0.85)' },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  tagText: { color: '#FFF', fontSize: 10, letterSpacing: 0.5 },
});
