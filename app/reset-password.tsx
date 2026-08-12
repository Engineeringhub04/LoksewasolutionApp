// In-app password reset — opened via the deep link inside the reset email
// (oobCode passed as a query param). Fixed header, scrollable body underneath.
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { confirmPasswordReset } from '@/src/core/firebase/auth';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { FloatingLabelField } from '@/src/components/inputs/FloatingLabelField';
import { AuthScreenLayout } from '@/src/components/misc/AuthScreenLayout';

export default function ResetPasswordScreen() {
  const router = useRouter();
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
      <AuthScreenLayout title="Set New Password" subtitle="Choose a strong new password for your account">
        <Animated.View entering={FadeInDown.duration(400)} style={styles.body}>
          <FloatingLabelField label="New Password" leftIcon="lock-closed-outline" value={password} onChangeText={setPassword} secureToggle secureTextEntry containerStyle={styles.fieldGap} />
          <FloatingLabelField label="Confirm Password" leftIcon="lock-closed-outline" value={confirmPassword} onChangeText={setConfirmPassword} secureToggle secureTextEntry containerStyle={styles.fieldGap} />

          <Pressable onPress={handleReset} disabled={loading} style={({ pressed }) => [styles.submitButton, { opacity: pressed || loading ? 0.85 : 1 }]}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text variant="body" weight="bold" style={styles.submitButtonText}>Change Password</Text>}
          </Pressable>
        </Animated.View>
      </AuthScreenLayout>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  body: {},
  fieldGap: { width: '100%', marginBottom: 16 },
  submitButton: { backgroundColor: '#7C3AED', paddingVertical: 16, borderRadius: 14, alignItems: 'center', width: '100%', shadowColor: '#7C3AED', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitButtonText: { color: '#FFF', fontSize: 16 },
});
