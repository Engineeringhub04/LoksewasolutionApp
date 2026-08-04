// In-app password reset — opened via the deep link inside the reset email
// (oobCode passed as a query param by Firebase's continue URL / dynamic link).
// After a successful reset, always routes back to Login.
import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { confirmPasswordReset } from '@/src/core/firebase/auth';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { FloatingLabelField } from '@/src/components/inputs/FloatingLabelField';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ oobCode?: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!params.oobCode) {
      showToast('This reset link is invalid or has expired', 'error');
      return;
    }
    if (password.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }
    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset(params.oobCode, password);
      setLoading(false);
      router.replace('/(auth)/login');
      showToast('Password changed successfully', 'success');
    } catch {
      setLoading(false);
      showToast('This reset link is invalid or has expired', 'error');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" bounces={false}>
        <LinearGradient colors={['#7C3AED', '#A855F7', '#C084FC']} style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Animated.View entering={FadeIn.duration(400)} style={styles.headerIconCircle}>
            <Ionicons name="lock-open-outline" size={26} color="#FFF" />
          </Animated.View>
        </LinearGradient>

        <Animated.View entering={FadeInDown.duration(400)} style={styles.body}>
          <Text variant="h1" weight="bold" style={styles.title}>Set New Password</Text>
          <Text variant="body" style={styles.subtitle}>Choose a strong new password for your account</Text>

          <FloatingLabelField label="New Password" leftIcon="lock-closed-outline" value={password} onChangeText={setPassword} secureToggle secureTextEntry containerStyle={styles.fieldGap} />
          <FloatingLabelField label="Confirm Password" leftIcon="lock-closed-outline" value={confirmPassword} onChangeText={setConfirmPassword} secureToggle secureTextEntry containerStyle={styles.fieldGap} />

          <Pressable onPress={handleReset} disabled={loading} style={({ pressed }) => [styles.submitButton, { opacity: pressed || loading ? 0.85 : 1 }]}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text variant="body" weight="bold" style={styles.submitButtonText}>Change Password</Text>}
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent: { flexGrow: 1 },
  header: { paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, alignItems: 'center' },
  headerIconCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  body: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24, alignItems: 'center' },
  title: { color: '#1F2937', fontSize: 26, marginBottom: 8, textAlign: 'center' },
  subtitle: { color: '#6B7280', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  fieldGap: { width: '100%', marginBottom: 16 },
  submitButton: { backgroundColor: '#7C3AED', paddingVertical: 16, borderRadius: 14, alignItems: 'center', width: '100%', shadowColor: '#7C3AED', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitButtonText: { color: '#FFF', fontSize: 16 },
});
