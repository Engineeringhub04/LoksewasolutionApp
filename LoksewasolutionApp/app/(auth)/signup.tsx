// §14 Signup — Fixed curved header, scrollable body slides underneath it.
// Continue with Email fades fields in/out.
import React, { useState } from 'react';
import { View, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { registerWithEmail, signInWithGoogleIdToken } from '@/src/core/firebase/auth';
import { isFirebaseConfigured } from '@/src/core/firebase/env';
import { useGoogleAuthRequest } from '@/src/core/firebase/googleAuth';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { FloatingLabelField } from '@/src/components/inputs/FloatingLabelField';
import { GoogleIcon } from '@/src/components/misc/GoogleIcon';
import { AuthScreenLayout } from '@/src/components/misc/AuthScreenLayout';

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showFields, setShowFields] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [, , promptGoogleAuth] = useGoogleAuthRequest();

  const handleSignup = async () => {
    if (name.trim().length < 2) { showToast('Name must be at least 2 characters', 'error'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { showToast('Please enter a valid email', 'error'); return; }
    if (password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
    setLoading(true);
    try {
      await registerWithEmail(name.trim(), email, password);
      setLoading(false);
      router.replace('/course-setup');
      showToast('Account created successfully', 'success');
    } catch (e: unknown) {
      setLoading(false);
      const code = (e as { code?: string })?.code;
      if (code === 'auth/email-already-in-use') showToast('This email is already registered', 'error');
      else showToast('Something went wrong. Please try again.', 'error');
    }
  };

  const handleGoogleSignIn = async () => {
    if (!isFirebaseConfigured) { showToast('Firebase is not configured', 'warning'); return; }
    setGoogleLoading(true);
    try {
      const result = await promptGoogleAuth();
      if (result?.type === 'success' && result.params?.id_token) {
        await signInWithGoogleIdToken(result.params.id_token);
        setGoogleLoading(false);
        router.replace('/course-setup');
        showToast('Account created successfully', 'success');
        return;
      }
    } catch {
      showToast('Google Sign-In failed. Please try again.', 'error');
    }
    setGoogleLoading(false);
  };

  return (
    <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AuthScreenLayout
        title="Create Account"
        subtitle="Join the Loksewa community and start your exam preparation today"
        onBack={() => router.back()}
      >
        {!showFields ? (
          <Animated.View key="collapsed" entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.collapsedContent}>
            <Pressable onPress={handleGoogleSignIn} disabled={googleLoading} style={({ pressed }) => [styles.googleButton, { opacity: pressed ? 0.85 : 1 }]}>
              {googleLoading ? <ActivityIndicator color="#374151" /> : (
                <>
                  <GoogleIcon size={20} />
                  <Text variant="body" weight="semiBold" style={styles.googleText}>Continue with Google</Text>
                </>
              )}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text variant="bodySmall" style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable onPress={() => setShowFields(true)} style={({ pressed }) => [styles.emailButton, { opacity: pressed ? 0.85 : 1 }]}>
              <Ionicons name="mail-outline" size={20} color="#FFF" />
              <Text variant="body" weight="semiBold" style={styles.emailButtonText}>Continue with Email</Text>
            </Pressable>

            <View style={styles.bottomLink}>
              <Text variant="body" style={{ color: '#6B7280' }}>Already have an account? </Text>
              <Link href="/(auth)/login">
                <Text variant="body" weight="bold" style={styles.loginLink}>Login</Text>
              </Link>
            </View>
          </Animated.View>
        ) : (
          <Animated.View key="expanded" entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.expandedContent}>
            <Pressable onPress={() => setShowFields(false)} style={styles.collapseBtn}>
              <Ionicons name="arrow-back" size={18} color="#7C3AED" />
              <Text variant="bodySmall" weight="semiBold" style={{ color: '#7C3AED' }}>Back</Text>
            </Pressable>

            <Text variant="h2" weight="bold" style={styles.expandedTitle}>Sign Up with Email</Text>

            <FloatingLabelField label="Full Name" leftIcon="person-outline" value={name} onChangeText={setName} autoComplete="name" containerStyle={styles.fieldGap} />
            <FloatingLabelField label="Email" leftIcon="mail-outline" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" containerStyle={styles.fieldGap} />
            <FloatingLabelField label="Password" leftIcon="lock-closed-outline" value={password} onChangeText={setPassword} secureToggle secureTextEntry containerStyle={styles.fieldGap} />

            <Pressable onPress={handleSignup} disabled={loading} style={({ pressed }) => [styles.signupButton, { opacity: pressed || loading ? 0.85 : 1 }]}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text variant="body" weight="bold" style={styles.signupButtonText}>Create Account</Text>}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text variant="bodySmall" style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable onPress={handleGoogleSignIn} disabled={googleLoading} style={({ pressed }) => [styles.googleButton, { opacity: pressed ? 0.85 : 1 }]}>
              {googleLoading ? <ActivityIndicator color="#374151" /> : (
                <>
                  <GoogleIcon size={20} />
                  <Text variant="body" weight="semiBold" style={styles.googleText}>Continue with Google</Text>
                </>
              )}
            </Pressable>

            <View style={styles.bottomLink}>
              <Text variant="body" style={{ color: '#6B7280' }}>Already have an account? </Text>
              <Link href="/(auth)/login">
                <Text variant="body" weight="bold" style={styles.loginLink}>Login</Text>
              </Link>
            </View>
          </Animated.View>
        )}
      </AuthScreenLayout>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  collapsedContent: { gap: 4, marginTop: 24 },
  expandedContent: { gap: 4 },
  collapseBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16, alignSelf: 'flex-start' },
  expandedTitle: { color: '#1F2937', fontSize: 22, marginBottom: 20 },
  fieldGap: { marginBottom: 14 },
  googleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#FFF', paddingVertical: 16, borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2, width: '100%' },
  googleText: { color: '#374151', fontSize: 16 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 18, width: '100%' },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { color: '#9CA3AF', marginHorizontal: 12 },
  emailButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7C3AED', paddingVertical: 16, borderRadius: 14, shadowColor: '#7C3AED', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4, width: '100%' },
  emailButtonText: { color: '#FFF', fontSize: 16 },
  signupButton: { backgroundColor: '#7C3AED', paddingVertical: 16, borderRadius: 14, alignItems: 'center', shadowColor: '#7C3AED', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  signupButtonText: { color: '#FFF', fontSize: 16 },
  bottomLink: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  loginLink: { color: '#7C3AED' },
});
