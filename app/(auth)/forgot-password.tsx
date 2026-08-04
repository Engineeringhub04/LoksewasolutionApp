// §15 Forgot Password — Big curved header, scrollable, sends reset link that
// opens the app's reset-password screen (deep link) instead of a website.
import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { sendResetPasswordEmail } from '@/src/core/firebase/auth';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { FloatingLabelField } from '@/src/components/inputs/FloatingLabelField';
import { AuthHeader } from '@/src/components/misc/AuthHeader';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      showToast('Please enter a valid email', 'error');
      return;
    }
    setLoading(true);
    try {
      await sendResetPasswordEmail(email);
    } catch {
      // Intentionally ignored — always show same message (prevents email enumeration)
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <AuthHeader title="Reset Password" subtitle="Enter your email and we'll send you a secure reset link" onBack={() => router.back()} />

        <View style={styles.body}>
          {sent ? (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.sentContainer}>
              <View style={styles.sentIcon}>
                <Ionicons name="mail-open-outline" size={44} color="#7C3AED" />
              </View>
              <Text variant="h2" weight="bold" style={styles.sentTitle}>Check Your Email</Text>
              <Text variant="body" style={styles.sentDesc}>
                We've sent a password reset link to {email}. Open the link on this device to reset your password in the app.
              </Text>
              <Pressable onPress={() => router.replace('/(auth)/login')} style={({ pressed }) => [styles.backToLoginBtn, { opacity: pressed ? 0.85 : 1 }]}>
                <Text variant="body" weight="bold" style={styles.backToLoginText}>Back to Login</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.fieldsContent}>
              <FloatingLabelField
                label="Email Address"
                leftIcon="mail-outline"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                containerStyle={styles.fieldGap}
              />

              <Pressable onPress={handleSubmit} disabled={loading} style={({ pressed }) => [styles.submitButton, { opacity: pressed || loading ? 0.85 : 1 }]}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text variant="body" weight="bold" style={styles.submitButtonText}>Send Reset Link</Text>}
              </Pressable>

              <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
                <Text variant="body" weight="semiBold" style={styles.cancelText}>Back to Login</Text>
              </Pressable>
            </Animated.View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  body: { paddingHorizontal: 24, paddingTop: 28 },
  fieldsContent: { gap: 4 },
  fieldGap: { width: '100%', marginBottom: 16 },
  submitButton: { backgroundColor: '#7C3AED', paddingVertical: 16, borderRadius: 14, alignItems: 'center', width: '100%', shadowColor: '#7C3AED', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitButtonText: { color: '#FFF', fontSize: 16 },
  cancelBtn: { alignItems: 'center', marginTop: 16 },
  cancelText: { color: '#7C3AED' },
  sentContainer: { alignItems: 'center', gap: 16, paddingTop: 4 },
  sentIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' },
  sentTitle: { color: '#1F2937', fontSize: 22 },
  sentDesc: { color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  backToLoginBtn: { backgroundColor: '#7C3AED', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 14, marginTop: 8 },
  backToLoginText: { color: '#FFF', fontSize: 16 },
});
