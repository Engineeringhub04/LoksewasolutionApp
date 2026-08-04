// §15 Forgot Password — Email field, sends reset link to Gmail.
// Premium purple UI matching login/signup design.
import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { sendResetPasswordEmail } from '@/src/core/firebase/auth';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { TextField } from '@/src/components/inputs/TextField';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      showToast('Reset link sent to your email!', 'info');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" bounces={false}>
        {/* Purple Header */}
        <LinearGradient colors={['#7C3AED', '#A855F7', '#C084FC']} style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </Pressable>
          <View style={styles.headerContent}>
            <View style={styles.logoCircle}>
              <Ionicons name="key" size={32} color="#7C3AED" />
            </View>
            <Text variant="h1" weight="bold" style={styles.headerTitle}>Reset Password</Text>
            <Text variant="body" style={styles.headerSubtitle}>We'll send a reset link to your email</Text>
          </View>
        </LinearGradient>

        {/* White Card Body */}
        <View style={styles.cardBody}>
          {sent ? (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.sentContainer}>
              <View style={styles.sentIcon}>
                <Ionicons name="mail-open" size={48} color="#7C3AED" />
              </View>
              <Text variant="h2" weight="bold" style={styles.sentTitle}>Check Your Email</Text>
              <Text variant="body" style={styles.sentDesc}>
                We've sent a password reset link to {email}. Open the link to reset your password.
              </Text>
              <Pressable onPress={() => router.replace('/(auth)/login')} style={({ pressed }) => [styles.backToLoginBtn, { opacity: pressed ? 0.8 : 1 }]}>
                <Text variant="body" weight="bold" style={styles.backToLoginText}>Back to Login</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.fieldsContainer}>
              <TextField
                label="Email Address"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />

              <Pressable
                onPress={handleSubmit}
                disabled={loading}
                style={({ pressed }) => [styles.submitButton, { opacity: pressed || loading ? 0.8 : 1 }]}
              >
                {loading ? <ActivityIndicator color="#FFF" /> : (
                  <Text variant="body" weight="bold" style={styles.submitButtonText}>Send Reset Link</Text>
                )}
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
  scrollContent: { flexGrow: 1 },
  header: { paddingBottom: 40, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, alignItems: 'center' },
  backBtn: { position: 'absolute', top: 50, left: 16, zIndex: 10, padding: 8 },
  headerContent: { alignItems: 'center', gap: 8, marginTop: 20 },
  logoCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  headerTitle: { color: '#FFF', fontSize: 28 },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 15, textAlign: 'center' },
  cardBody: { flex: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 },
  fieldsContainer: { gap: 16 },
  submitButton: { backgroundColor: '#7C3AED', paddingVertical: 16, borderRadius: 14, alignItems: 'center', shadowColor: '#7C3AED', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitButtonText: { color: '#FFF', fontSize: 16 },
  cancelBtn: { alignItems: 'center', marginTop: 16 },
  cancelText: { color: '#7C3AED' },
  // Sent state
  sentContainer: { alignItems: 'center', gap: 16, paddingTop: 20 },
  sentIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' },
  sentTitle: { color: '#1F2937', fontSize: 22 },
  sentDesc: { color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  backToLoginBtn: { backgroundColor: '#7C3AED', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 14, marginTop: 8 },
  backToLoginText: { color: '#FFF', fontSize: 16 },
});
