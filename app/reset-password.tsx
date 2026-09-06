// In-app password reset completion screen. It accepts Firebase action-link params
// (oobCode and, when present, mode=resetPassword) from a future App Link/deep link.
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { confirmPasswordReset, verifyPasswordResetCode } from '@/src/core/firebase/auth';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { FloatingLabelField } from '@/src/components/inputs/FloatingLabelField';
import { AuthScreenLayout } from '@/src/components/misc/AuthScreenLayout';

type ResetCodeStatus = 'checking' | 'valid' | 'invalid';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ oobCode?: string | string[]; mode?: string | string[] }>();
  const oobCode = firstParam(params.oobCode);
  const mode = firstParam(params.mode);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeStatus, setCodeStatus] = useState<ResetCodeStatus>('checking');

  useEffect(() => {
    let active = true;

    const validateCode = async () => {
      // Allow manual testing with only oobCode, but reject an action link
      // explicitly meant for another Firebase action.
      if (!oobCode || (mode !== undefined && mode !== 'resetPassword')) {
        if (active) setCodeStatus('invalid');
        return;
      }

      try {
        const result = await verifyPasswordResetCode(oobCode);
        if (!active) return;
        setCodeStatus(result.requestType === null || result.requestType === 'PASSWORD_RESET' ? 'valid' : 'invalid');
      } catch {
        if (active) setCodeStatus('invalid');
      }
    };

    void validateCode();
    return () => {
      active = false;
    };
  }, [mode, oobCode]);

  const handleReset = async () => {
    if (codeStatus !== 'valid' || !oobCode) {
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
      await confirmPasswordReset(oobCode, password);
      setLoading(false);
      router.replace('/(auth)/login');
      showToast('Password changed successfully', 'success');
    } catch {
      setLoading(false);
      setCodeStatus('invalid');
      showToast('This reset link is invalid or has expired', 'error');
    }
  };

  const renderBody = () => {
    if (codeStatus === 'checking') {
      return (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.statusContainer}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text variant="body" style={styles.statusText}>Checking reset link...</Text>
        </Animated.View>
      );
    }

    if (codeStatus === 'invalid') {
      return (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.statusContainer}>
          <Text variant="h2" weight="bold" style={styles.invalidTitle}>Reset Link Unavailable</Text>
          <Text variant="body" style={styles.statusText}>
            This reset link is invalid or has expired. Request a new link and open it after the app-link setup is enabled.
          </Text>
          <Pressable onPress={() => router.replace('/(auth)/forgot-password')} style={({ pressed }) => [styles.submitButton, { opacity: pressed ? 0.85 : 1 }]}>
            <Text variant="body" weight="bold" style={styles.submitButtonText}>Request New Link</Text>
          </Pressable>
        </Animated.View>
      );
    }

    return (
      <Animated.View entering={FadeInDown.duration(400)} style={styles.body}>
        <FloatingLabelField label="New Password" leftIcon="lock-closed-outline" value={password} onChangeText={setPassword} secureToggle secureTextEntry lightTheme containerStyle={styles.fieldGap} />
        <FloatingLabelField label="Confirm Password" leftIcon="lock-closed-outline" value={confirmPassword} onChangeText={setConfirmPassword} secureToggle secureTextEntry lightTheme containerStyle={styles.fieldGap} />

        <Pressable onPress={handleReset} disabled={loading} style={({ pressed }) => [styles.submitButton, { opacity: pressed || loading ? 0.85 : 1 }]}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text variant="body" weight="bold" style={styles.submitButtonText}>Change Password</Text>}
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AuthScreenLayout title="Set New Password" subtitle="Choose a strong new password for your account">
        {renderBody()}
      </AuthScreenLayout>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  body: {},
  statusContainer: { alignItems: 'center', gap: 16, paddingVertical: 24 },
  statusText: { color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  invalidTitle: { color: '#1F2937', fontSize: 22, textAlign: 'center' },
  fieldGap: { width: '100%', marginBottom: 16 },
  submitButton: { backgroundColor: '#7C3AED', paddingVertical: 16, borderRadius: 14, alignItems: 'center', width: '100%', shadowColor: '#7C3AED', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitButtonText: { color: '#FFF', fontSize: 16 },
});
