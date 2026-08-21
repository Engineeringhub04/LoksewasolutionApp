// §13 Login — Fixed curved header (logo + title + description), scrollable body
// slides underneath it. Continue with Email fades fields in/out.
import React, { useState } from 'react';
import { View, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, withTiming, withSequence, useAnimatedStyle, FadeIn, FadeOut } from 'react-native-reanimated';
import { loginWithEmail, signInWithGoogleIdToken } from '@/src/core/firebase/auth';
import { isFirebaseConfigured } from '@/src/core/firebase/env';
import { useGoogleAuthRequest } from '@/src/core/firebase/googleAuth';
import { hasUserCourseSetup } from '@/src/core/firebase/services/courses';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { FloatingLabelField } from '@/src/components/inputs/FloatingLabelField';
import { GoogleIcon } from '@/src/components/misc/GoogleIcon';
import { AuthScreenLayout } from '@/src/components/misc/AuthScreenLayout';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showEmailFields, setShowEmailFields] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const shake = useSharedValue(0);
  const [, , promptGoogleAuth] = useGoogleAuthRequest();

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const triggerShake = () => {
    shake.value = withSequence(
      withTiming(-8, { duration: 60 }), withTiming(8, { duration: 60 }),
      withTiming(-6, { duration: 60 }), withTiming(0, { duration: 60 })
    );
  };

  const handleLogin = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6) {
      triggerShake();
      showToast('Please enter a valid email and password', 'error');
      return;
    }
    setLoading(true);
    try {
      const user = await loginWithEmail(email, password);
      const hasCourse = await hasUserCourseSetup(user.uid).catch(() => false);
      setLoading(false);
      router.replace(hasCourse ? '/(tabs)' : '/course-setup');
      showToast('Login successful', 'success');
    } catch {
      setLoading(false);
      triggerShake();
      showToast('Invalid email or password', 'error');
    }
  };

  const handleGoogleSignIn = async () => {
    if (!isFirebaseConfigured) { showToast('Firebase is not configured', 'warning'); return; }
    setGoogleLoading(true);
    try {
      const result = await promptGoogleAuth();
      if (result?.type === 'success' && result.params?.id_token) {
        const user = await signInWithGoogleIdToken(result.params.id_token);
        const hasCourse = await hasUserCourseSetup(user.uid).catch(() => false);
        setGoogleLoading(false);
        router.replace(hasCourse ? '/(tabs)' : '/course-setup');
        showToast('Login successful', 'success');
        return;
      }
    } catch {
      showToast('Google Sign-In failed. Please try again.', 'error');
    }
    setGoogleLoading(false);
  };

  return (
    <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AuthScreenLayout title="Welcome Back" subtitle="Sign in to continue your Loksewa preparation journey">
        <Animated.View style={shakeStyle}>
          {!showEmailFields ? (
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

              <Pressable onPress={() => setShowEmailFields(true)} style={({ pressed }) => [styles.emailButton, { opacity: pressed ? 0.85 : 1 }]}>
                <Ionicons name="mail-outline" size={20} color="#FFF" />
                <Text variant="body" weight="semiBold" style={styles.emailButtonText}>Continue with Email</Text>
              </Pressable>

              <View style={styles.bottomLink}>
                <Text variant="body" style={{ color: '#6B7280' }}>Don&apos;t have an account? </Text>
                <Link href="/(auth)/signup">
                  <Text variant="body" weight="bold" style={styles.signUpLink}>Sign Up</Text>
                </Link>
              </View>
            </Animated.View>
          ) : (
            <Animated.View key="expanded" entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.expandedContent}>
              <Pressable onPress={() => setShowEmailFields(false)} style={styles.collapseBtn}>
                <Ionicons name="arrow-back" size={18} color="#7C3AED" />
                <Text variant="bodySmall" weight="semiBold" style={{ color: '#7C3AED' }}>Back</Text>
              </Pressable>

              <Text variant="h2" weight="bold" style={styles.expandedTitle}>Login with Email</Text>

              <FloatingLabelField label="Email" leftIcon="mail-outline" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" lightTheme containerStyle={styles.fieldGap} />
              <FloatingLabelField label="Password" leftIcon="lock-closed-outline" value={password} onChangeText={setPassword} secureToggle secureTextEntry autoComplete="password" lightTheme containerStyle={styles.fieldGap} />

              <Link href="/(auth)/forgot-password" style={{ alignSelf: 'flex-end', marginBottom: 8 }}>
                <Text variant="bodySmall" weight="semiBold" style={styles.forgotText}>Forgot Password?</Text>
              </Link>

              <Pressable onPress={handleLogin} disabled={loading} style={({ pressed }) => [styles.loginButton, { opacity: pressed || loading ? 0.85 : 1 }]}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text variant="body" weight="bold" style={styles.loginButtonText}>Login</Text>}
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
                <Text variant="body" style={{ color: '#6B7280' }}>Don&apos;t have an account? </Text>
                <Link href="/(auth)/signup">
                  <Text variant="body" weight="bold" style={styles.signUpLink}>Sign Up</Text>
                </Link>
              </View>
            </Animated.View>
          )}
        </Animated.View>
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
  forgotText: { color: '#7C3AED' },
  loginButton: { backgroundColor: '#7C3AED', paddingVertical: 16, borderRadius: 14, alignItems: 'center', shadowColor: '#7C3AED', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  loginButtonText: { color: '#FFF', fontSize: 16 },
  bottomLink: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  signUpLink: { color: '#7C3AED' },
});
