// §13 Login — Premium purple UI. Continue with Google/Email. Fields expand on tap.
import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, withTiming, withSequence, useAnimatedStyle, FadeInDown, FadeIn } from 'react-native-reanimated';
import { loginWithEmail, signInWithGoogleIdToken } from '@/src/core/firebase/auth';
import { isFirebaseConfigured } from '@/src/core/firebase/env';
import { useGoogleAuthRequest } from '@/src/core/firebase/googleAuth';
import { seedCourseData, hasUserCourseSetup } from '@/src/core/firebase/services/courses';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { TextField } from '@/src/components/inputs/TextField';
import { AppConfig } from '@/src/core/config/appConfig';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showEmailFields, setShowEmailFields] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [seedingCourses, setSeedingCourses] = useState(false);
  const shake = useSharedValue(0);
  const [, , promptGoogleAuth] = useGoogleAuthRequest();

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const triggerShake = () => {
    shake.value = withSequence(
      withTiming(-8, { duration: 60 }), withTiming(8, { duration: 60 }),
      withTiming(-6, { duration: 60 }), withTiming(0, { duration: 60 })
    );
  };

  const navigateAfterAuth = async (uid: string) => {
    const hasCourse = await hasUserCourseSetup(uid).catch(() => false);
    router.replace(hasCourse ? '/(tabs)' : '/course-setup');
  };

  const handleLogin = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6) {
      triggerShake();
      showToast('Please enter valid email and password', 'error');
      return;
    }
    setLoading(true);
    try {
      const user = await loginWithEmail(email, password);
      showToast('Login successful! 🎉', 'success');
      await navigateAfterAuth(user.uid);
    } catch {
      triggerShake();
      showToast('Invalid email or password', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!isFirebaseConfigured) { showToast('Firebase not configured.', 'warning'); return; }
    setGoogleLoading(true);
    try {
      const result = await promptGoogleAuth();
      if (result?.type === 'success' && result.params?.id_token) {
        const user = await signInWithGoogleIdToken(result.params.id_token);
        showToast('Login successful! 🎉', 'success');
        await navigateAfterAuth(user.uid);
      }
    } catch {
      showToast('Google Sign-In failed. Try again.', 'error');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSeedCourses = async () => {
    if (!isFirebaseConfigured) { showToast('Firebase not configured.', 'warning'); return; }
    setSeedingCourses(true);
    try {
      await seedCourseData();
      showToast('✅ Courses seeded!', 'success');
    } catch (err: any) {
      showToast(`Seed failed: ${err?.message ?? 'Error'}`, 'error');
    } finally {
      setSeedingCourses(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" bounces={false}>
        {/* Purple Curved Header with Logo */}
        <LinearGradient colors={['#7C3AED', '#A855F7', '#C084FC']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
          {/* Seed Courses - top right */}
          <Pressable onPress={handleSeedCourses} disabled={seedingCourses} style={({ pressed }) => [styles.seedBtn, { opacity: pressed || seedingCourses ? 0.5 : 1 }]}>
            {seedingCourses ? <ActivityIndicator color="#FFF" size="small" /> : (
              <>
                <Ionicons name="cloud-upload-outline" size={14} color="#FFF" />
                <Text variant="bodySmall" weight="semiBold" style={{ color: '#FFF', fontSize: 11 }}>Seed</Text>
              </>
            )}
          </Pressable>

          <Animated.View entering={FadeIn.duration(400)} style={styles.headerContent}>
            <View style={styles.logoCircle}>
              <Image source={AppConfig.identity.logoAsset} style={styles.logoImage} resizeMode="contain" />
            </View>
            <Text variant="h1" weight="bold" style={styles.headerTitle}>Welcome</Text>
            <Text variant="body" style={styles.headerSubtitle}>Sign in to continue</Text>
          </Animated.View>
        </LinearGradient>

        {/* Card Body */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={[styles.cardBody, !showEmailFields && styles.cardBodyCentered]}>
          <Animated.View style={shakeStyle}>
            {/* Continue with Google */}
            <Pressable onPress={handleGoogleSignIn} disabled={googleLoading} style={({ pressed }) => [styles.socialButton, { opacity: pressed ? 0.8 : 1 }]}>
              {googleLoading ? <ActivityIndicator color="#7C3AED" /> : (
                <>
                  <Ionicons name="logo-google" size={22} color="#DB4437" />
                  <Text variant="body" weight="semiBold" style={styles.socialText}>Continue with Google</Text>
                </>
              )}
            </Pressable>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text variant="bodySmall" style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Continue with Email */}
            {!showEmailFields ? (
              <Pressable onPress={() => setShowEmailFields(true)} style={({ pressed }) => [styles.emailButton, { opacity: pressed ? 0.8 : 1 }]}>
                <Ionicons name="mail-outline" size={20} color="#FFF" />
                <Text variant="body" weight="semiBold" style={styles.emailButtonText}>Continue with Email</Text>
              </Pressable>
            ) : (
              <Animated.View entering={FadeInDown.duration(300)} style={styles.fieldsContainer}>
                <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
                <TextField label="Password" value={password} onChangeText={setPassword} secureToggle secureTextEntry autoComplete="password" />
                <Link href="/(auth)/forgot-password" style={{ alignSelf: 'flex-end', marginTop: -4 }}>
                  <Text variant="bodySmall" weight="semiBold" style={styles.forgotText}>Forgot Password?</Text>
                </Link>
                <Pressable onPress={handleLogin} disabled={loading} style={({ pressed }) => [styles.loginButton, { opacity: pressed || loading ? 0.8 : 1 }]}>
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text variant="body" weight="bold" style={styles.loginButtonText}>Login</Text>}
                </Pressable>
              </Animated.View>
            )}

            {/* Sign Up link */}
            <View style={styles.bottomLink}>
              <Text variant="body" style={{ color: '#6B7280' }}>Don't have an account? </Text>
              <Link href="/(auth)/signup">
                <Text variant="body" weight="bold" style={styles.signUpLink}>Sign Up</Text>
              </Link>
            </View>
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent: { flexGrow: 1 },
  header: { paddingBottom: 40, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, alignItems: 'center' },
  headerContent: { alignItems: 'center', gap: 8, marginTop: 16 },
  logoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 },
  logoImage: { width: 56, height: 56 },
  headerTitle: { color: '#FFF', fontSize: 28 },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 15 },
  seedBtn: { position: 'absolute', top: 50, right: 16, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.2)', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, zIndex: 10 },
  cardBody: { flex: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 },
  cardBodyCentered: { justifyContent: 'center' },
  socialButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#FFF', paddingVertical: 16, borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  socialText: { color: '#374151', fontSize: 16 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { color: '#9CA3AF', marginHorizontal: 12 },
  emailButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7C3AED', paddingVertical: 16, borderRadius: 14, shadowColor: '#7C3AED', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  emailButtonText: { color: '#FFF', fontSize: 16 },
  fieldsContainer: { gap: 14 },
  forgotText: { color: '#7C3AED' },
  loginButton: { backgroundColor: '#7C3AED', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 8, shadowColor: '#7C3AED', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  loginButtonText: { color: '#FFF', fontSize: 16 },
  bottomLink: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  signUpLink: { color: '#7C3AED' },
});
