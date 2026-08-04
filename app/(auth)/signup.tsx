// §14 Signup — Premium purple UI with logo, Continue with Email expand pattern.
import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { registerWithEmail } from '@/src/core/firebase/auth';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { TextField } from '@/src/components/inputs/TextField';
import { AppConfig } from '@/src/core/config/appConfig';

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showFields, setShowFields] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (name.trim().length < 2) { showToast('Name must be at least 2 characters', 'error'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { showToast('Please enter a valid email', 'error'); return; }
    if (password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
    setLoading(true);
    try {
      await registerWithEmail(name.trim(), email, password);
      showToast('Account created! 🎉', 'success');
      router.replace('/course-setup');
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === 'auth/email-already-in-use') showToast('This email is already registered', 'error');
      else showToast('Something went wrong. Try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" bounces={false}>
        {/* Purple Header with Logo */}
        <LinearGradient colors={['#7C3AED', '#A855F7', '#C084FC']} style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </Pressable>
          <Animated.View entering={FadeIn.duration(400)} style={styles.headerContent}>
            <View style={styles.logoCircle}>
              <Image source={AppConfig.identity.logoAsset} style={styles.logoImage} resizeMode="contain" />
            </View>
            <Text variant="h1" weight="bold" style={styles.headerTitle}>Create Account</Text>
            <Text variant="body" style={styles.headerSubtitle}>Join the Loksewa community</Text>
          </Animated.View>
        </LinearGradient>

        {/* Card Body */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={[styles.cardBody, !showFields && styles.cardBodyCentered]}>
          {!showFields ? (
            <View style={styles.centeredContent}>
              <Pressable onPress={() => setShowFields(true)} style={({ pressed }) => [styles.emailButton, { opacity: pressed ? 0.8 : 1 }]}>
                <Ionicons name="mail-outline" size={20} color="#FFF" />
                <Text variant="body" weight="semiBold" style={styles.emailButtonText}>Continue with Email</Text>
              </Pressable>
              <View style={styles.bottomLink}>
                <Text variant="body" style={{ color: '#6B7280' }}>Already have an account? </Text>
                <Link href="/(auth)/login">
                  <Text variant="body" weight="bold" style={styles.loginLink}>Login</Text>
                </Link>
              </View>
            </View>
          ) : (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.fieldsContainer}>
              <TextField label="Full Name" value={name} onChangeText={setName} autoComplete="name" />
              <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
              <TextField label="Password" value={password} onChangeText={setPassword} secureToggle secureTextEntry />
              <Pressable onPress={handleSignup} disabled={loading} style={({ pressed }) => [styles.signupButton, { opacity: pressed || loading ? 0.8 : 1 }]}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text variant="body" weight="bold" style={styles.signupButtonText}>Create Account</Text>}
              </Pressable>
              <View style={styles.bottomLink}>
                <Text variant="body" style={{ color: '#6B7280' }}>Already have an account? </Text>
                <Link href="/(auth)/login">
                  <Text variant="body" weight="bold" style={styles.loginLink}>Login</Text>
                </Link>
              </View>
            </Animated.View>
          )}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent: { flexGrow: 1 },
  header: { paddingBottom: 40, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, alignItems: 'center' },
  backBtn: { position: 'absolute', top: 50, left: 16, zIndex: 10, padding: 8 },
  headerContent: { alignItems: 'center', gap: 8, marginTop: 16 },
  logoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 },
  logoImage: { width: 56, height: 56 },
  headerTitle: { color: '#FFF', fontSize: 28 },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 15 },
  cardBody: { flex: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 },
  cardBodyCentered: { justifyContent: 'center' },
  centeredContent: { gap: 20 },
  emailButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7C3AED', paddingVertical: 16, borderRadius: 14, shadowColor: '#7C3AED', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  emailButtonText: { color: '#FFF', fontSize: 16 },
  fieldsContainer: { gap: 14 },
  signupButton: { backgroundColor: '#7C3AED', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 8, shadowColor: '#7C3AED', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  signupButtonText: { color: '#FFF', fontSize: 16 },
  bottomLink: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  loginLink: { color: '#7C3AED' },
});
