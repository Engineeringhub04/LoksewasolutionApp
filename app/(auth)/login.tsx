// §13 Login — Fixed curved header (logo + title + description), scrollable body
// slides underneath it. Continue with Email fades fields in/out. Terms checkbox
// gates the auth actions (red + shake + vibrate when skipped). Submit stays
// disabled until required fields are valid. Buttons are centered lower.
import React, { useRef, useState } from 'react';
import { View, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator, StyleSheet, Keyboard, Vibration } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import Animated, { useSharedValue, withTiming, withSequence, useAnimatedStyle, FadeIn, FadeOut } from 'react-native-reanimated';
import { loginWithEmail, signInWithGoogleIdTokenResult } from '@/src/core/firebase/auth';
import { isFirebaseConfigured } from '@/src/core/firebase/env';
import { useGoogleAuthRequest } from '@/src/core/firebase/googleAuth';
import { hasUserCourseSetup } from '@/src/core/firebase/services/courses';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { FloatingLabelField } from '@/src/components/inputs/FloatingLabelField';
import { GoogleIcon } from '@/src/components/misc/GoogleIcon';
import { AuthScreenLayout } from '@/src/components/misc/AuthScreenLayout';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';

const TERMS_URL = 'https://www.kbr.com.np/terms';
const PRIVACY_URL = 'https://www.kbr.com.np/privacy';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showEmailFields, setShowEmailFields] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const redirectingAfterGoogleRef = useRef(false);
  const shake = useSharedValue(0);
  const termsShake = useSharedValue(0);
  const [, , promptGoogleAuth] = useGoogleAuthRequest();

  // Required-field gating — the email submit button stays inactive until a
  // valid email and a 6+ char password are present.
  const emailValid = /^\S+@\S+\.\S+$/.test(email);
  const canSubmit = emailValid && password.length >= 6;

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const termsShakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: termsShake.value }] }));

  const triggerShake = () => {
    shake.value = withSequence(
      withTiming(-8, { duration: 60 }), withTiming(8, { duration: 60 }),
      withTiming(-6, { duration: 60 }), withTiming(0, { duration: 60 })
    );
  };

  // Terms skipped — flash the row red, buzz, shake and toast so it's obvious.
  const flagTermsRequired = () => {
    setTermsError(true);
    Vibration.vibrate(Platform.OS === 'android' ? [0, 35, 55, 35] : 400);
    termsShake.value = withSequence(
      withTiming(-8, { duration: 55 }), withTiming(8, { duration: 55 }),
      withTiming(-6, { duration: 55 }), withTiming(0, { duration: 55 })
    );
    showToast('Please accept the Terms and Privacy Policy to continue.', 'warning');
  };

  const toggleTerms = () => {
    setAcceptedTerms((v) => {
      if (!v) setTermsError(false);
      return !v;
    });
  };

  const openTerms = () => WebBrowser.openBrowserAsync(TERMS_URL).catch(() => {});
  const openPrivacy = () => WebBrowser.openBrowserAsync(PRIVACY_URL).catch(() => {});

  const handleLogin = async () => {
    Keyboard.dismiss();
    if (!acceptedTerms) { flagTermsRequired(); return; }
    if (!canSubmit) {
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
      showToast('Invalid email or password. Please try again.', 'error');
    }
  };

  const handleGoogleSignIn = async () => {
    Keyboard.dismiss();
    if (!acceptedTerms) { flagTermsRequired(); return; }
    if (!isFirebaseConfigured) { showToast('Firebase is not configured', 'warning'); return; }
    setGoogleLoading(true);
    redirectingAfterGoogleRef.current = false;
    try {
      const result = await promptGoogleAuth();
      if (result?.type === 'success' && result.params?.id_token) {
        const { isNewUser } = await signInWithGoogleIdTokenResult(result.params.id_token, { allowCreate: false });
        redirectingAfterGoogleRef.current = true;
        router.replace(isNewUser ? '/course-setup' : '/(tabs)');
        showToast('Login successful', 'success');
        return;
      }
      if (result?.type === 'cancel' || result?.type === 'dismiss') return;
      showToast('Google Sign-In could not be completed. Please try again.', 'error');
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === 'auth/email-already-in-use' || code === 'auth/account-exists-with-different-credential' || code === 'auth/google-account-creation-blocked') {
        showToast('This Google account is not linked here. Please use the existing login method for this email.', 'error');
      } else {
        showToast('Google Sign-In failed. Please try again.', 'error');
      }
    } finally {
      if (!redirectingAfterGoogleRef.current) setGoogleLoading(false);
    }
  };

  const renderTerms = () => (
    <Animated.View style={termsShakeStyle}>
      <Pressable onPress={toggleTerms} style={styles.termsRow}>
        <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked, termsError && !acceptedTerms && styles.checkboxError]}>
          {acceptedTerms ? <Ionicons name="checkmark" size={14} color="#FFF" /> : null}
        </View>
        <Text variant="bodySmall" style={[styles.termsText, termsError && !acceptedTerms && styles.termsTextError]}>
          I agree to the{' '}
          <Text variant="bodySmall" weight="semiBold" style={styles.termsLink} onPress={openTerms}>Terms and Conditions</Text>
          {' '}and{' '}
          <Text variant="bodySmall" weight="semiBold" style={styles.termsLink} onPress={openPrivacy}>Privacy Policy</Text>
        </Text>
      </Pressable>
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AuthScreenLayout title="Welcome Back" subtitle="Sign in to continue your Loksewa preparation journey">
        <Animated.View style={[styles.bodyContent, shakeStyle]}>
          {!showEmailFields ? (
            <Animated.View key="collapsed" entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.collapsedContent}>
              <Pressable onPress={handleGoogleSignIn} disabled={googleLoading} style={({ pressed }) => [styles.googleButton, { opacity: pressed || googleLoading ? 0.85 : 1 }]}>
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

              {renderTerms()}

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
                <Ionicons name="arrow-back" size={18} color="#1D4ED8" />
                <Text variant="bodySmall" weight="semiBold" style={{ color: '#1D4ED8' }}>Back</Text>
              </Pressable>

              <Text variant="h2" weight="bold" style={styles.expandedTitle}>Login with Email</Text>

              <FloatingLabelField label="Email" leftIcon="mail-outline" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" returnKeyType="next" lightTheme containerStyle={styles.fieldGap} />
              <FloatingLabelField label="Password" leftIcon="lock-closed-outline" value={password} onChangeText={setPassword} secureToggle secureTextEntry autoComplete="password" returnKeyType="done" onSubmitEditing={handleLogin} lightTheme containerStyle={styles.fieldGap} />

              <Link href="/(auth)/forgot-password" style={{ alignSelf: 'flex-end', marginBottom: 8 }}>
                <Text variant="bodySmall" weight="semiBold" style={styles.forgotText}>Forgot Password?</Text>
              </Link>

              <Pressable onPress={handleLogin} disabled={loading || !canSubmit} style={({ pressed }) => [styles.loginButton, (!canSubmit || loading) && styles.buttonDisabled, { opacity: pressed && canSubmit ? 0.85 : 1 }]}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text variant="body" weight="bold" style={styles.loginButtonText}>Login</Text>}
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text variant="bodySmall" style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable onPress={handleGoogleSignIn} disabled={googleLoading} style={({ pressed }) => [styles.googleButton, { opacity: pressed || googleLoading ? 0.85 : 1 }]}>
                {googleLoading ? <ActivityIndicator color="#374151" /> : (
                  <>
                    <GoogleIcon size={20} />
                    <Text variant="body" weight="semiBold" style={styles.googleText}>Continue with Google</Text>
                  </>
                )}
              </Pressable>

              {renderTerms()}

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
      <PageLoaderOverlay visible={googleLoading} label="Signing in with Google..." />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  bodyContent: { flex: 1, justifyContent: 'center' },
  collapsedContent: { gap: 6 },
  expandedContent: { gap: 6 },
  collapseBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16, alignSelf: 'flex-start' },
  expandedTitle: { color: '#1F2937', fontSize: 22, marginBottom: 20 },
  fieldGap: { marginBottom: 14 },
  googleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#FFF', paddingVertical: 16, borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2, width: '100%' },
  googleText: { color: '#374151', fontSize: 16 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, width: '100%' },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { color: '#9CA3AF', marginHorizontal: 12 },
  emailButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1D4ED8', paddingVertical: 16, borderRadius: 14, shadowColor: '#1D4ED8', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4, width: '100%' },
  emailButtonText: { color: '#FFF', fontSize: 16 },
  forgotText: { color: '#1D4ED8' },
  loginButton: { backgroundColor: '#1D4ED8', paddingVertical: 16, borderRadius: 14, alignItems: 'center', shadowColor: '#1D4ED8', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  loginButtonText: { color: '#FFF', fontSize: 16 },
  buttonDisabled: { backgroundColor: '#93B4F3', shadowOpacity: 0, elevation: 0 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  checkboxChecked: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  checkboxError: { borderColor: '#DC2626', backgroundColor: 'rgba(220,38,38,0.08)' },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 14, marginHorizontal: 8 },
  termsText: { color: '#6B7280', lineHeight: 20, flex: 1 },
  termsTextError: { color: '#DC2626' },
  termsLink: { color: '#1D4ED8' },
  bottomLink: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  signUpLink: { color: '#1D4ED8' },
});
