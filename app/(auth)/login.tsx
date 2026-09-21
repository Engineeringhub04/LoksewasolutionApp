// §13 Login — Fixed curved header (logo + title + description), scrollable body
// slides underneath it. Continue with Email fades fields in/out. Terms checkbox
// gates the auth actions (red + shake + vibrate when skipped). Submit stays
// disabled until required fields are valid. Buttons are centered lower.
//
// One account = one device: both sign-in paths end in finishSignIn(), which asks
// whether another phone is holding this account and, if so, parks here on the
// takeover dialog instead of navigating. The check can only run once Firebase has
// authenticated us — the rules will not show a user their own session document
// before that — so "Cancel" has real work to do: it signs the account back out.
import React, { useEffect, useRef, useState } from 'react';
import { View, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator, StyleSheet, Keyboard, Vibration } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import Animated, { useSharedValue, withTiming, withSequence, useAnimatedStyle, FadeIn, FadeOut } from 'react-native-reanimated';
import { loginWithEmail, signInWithGoogleIdTokenResult } from '@/src/core/firebase/auth';
import { isFirebaseConfigured } from '@/src/core/firebase/env';
import { useGoogleAuthRequest } from '@/src/core/firebase/googleAuth';
import { hasUserCourseSetup } from '@/src/core/firebase/services/courses';
import { consumeEvictionNotice, type EvictionNotice } from '@/src/core/firebase/services/deviceSession';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { FloatingLabelField } from '@/src/components/inputs/FloatingLabelField';
import { GoogleIcon } from '@/src/components/misc/GoogleIcon';
import { AuthScreenLayout } from '@/src/components/misc/AuthScreenLayout';
import { DeviceTakeoverDialog, useDeviceTakeover } from '@/src/components/auth/DeviceTakeover';
import { DeviceEvictionDialog } from '@/src/components/auth/DeviceEvictionDialog';
import { PageLoaderOverlay } from '@/src/components/feedback/PageLoaderOverlay';

const TERMS_URL = 'https://www.kbr.com.np/terms';
const PRIVACY_URL = 'https://www.kbr.com.np/privacy';

/**
 * How long the "you were signed out" notice waits after this screen mounts.
 *
 * Comfortably past the native stack's slide (~350 ms), because the point is not
 * to delay the message but to make sure it lands on a screen that has stopped
 * moving. A dialog that fades in over a sliding splash screen reads as a glitch;
 * the same dialog a third of a second later reads as an explanation.
 */
const EVICTION_NOTICE_SETTLE_MS = 480;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showEmailFields, setShowEmailFields] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const redirectingAfterGoogleRef = useRef(false);
  // One account = one device. Both sign-in paths hand off to this instead of
  // navigating themselves; it navigates, or raises the takeover dialog.
  const { finishSignIn, dialogProps } = useDeviceTakeover();
  // The other direction of the same rule: this phone LOST the account while the
  // app was closed. The splash screen found out, signed out and routed here, and
  // left the reason behind for this screen to print — otherwise the user is
  // staring at a login form they never asked for.
  //
  // Reading the notice deletes it, which is what makes this appear exactly once:
  // a later launch, or a second visit to this screen, finds nothing to show.
  //
  // CLAIMED ON MOUNT, SHOWN AFTER THE TRANSITION.
  //
  // Those are deliberately two different moments. Storage is read immediately,
  // because whoever reads it first owns the notice and the read must not be lost
  // if the user navigates away. But raising the dialog immediately put it on
  // screen while the splash screen was still sliding out — the user saw a
  // sign-out popup floating over the launch animation, before the login form
  // they were being sent to had even arrived. So the dialog waits out the stack
  // transition and opens onto a login screen that is finished moving.
  const [evictionNotice, setEvictionNotice] = useState<EvictionNotice | null>(null);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void consumeEvictionNotice().then((notice) => {
      if (!active || !notice) return;
      timer = setTimeout(() => {
        if (active) setEvictionNotice(notice);
      }, EVICTION_NOTICE_SETTLE_MS);
    });
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, []);
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
      // Course-setup check and the device-claim check are independent reads —
      // start both now instead of paying them back-to-back.
      const hasCoursePromise = hasUserCourseSetup(user.uid).catch(() => false);
      const hasCourse = await hasCoursePromise;
      // Spinner stays up THROUGH finishSignIn (device-claim read + write +
      // navigation). Dropping it earlier read as a freeze: button back to
      // normal for a second before the screen changed.
      await finishSignIn(user.uid, hasCourse ? '/(tabs)' : '/course-setup', 'Login successful');
    } catch {
      triggerShake();
      showToast('Invalid email or password. Please try again.', 'error');
    } finally {
      setLoading(false);
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
        const { user, isNewUser } = await signInWithGoogleIdTokenResult(result.params.id_token, { allowCreate: false });
        // Keep the overlay only if we actually left the screen; a takeover
        // question needs the spinner gone so the dialog is not read through it.
        redirectingAfterGoogleRef.current = await finishSignIn(user.uid, isNewUser ? '/course-setup' : '/(tabs)', 'Login successful');
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
      <DeviceTakeoverDialog {...dialogProps} />
      <DeviceEvictionDialog
        visible={evictionNotice !== null}
        mode="notice"
        deviceName={evictionNotice?.deviceName}
        onConfirm={() => setEvictionNotice(null)}
      />
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
