// §13 Login. Includes a dev-only "Seed Demo Data" button and Google Sign-In.
import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { Link, useRouter } from 'expo-router';
import Animated, { useSharedValue, withTiming, withSequence, useAnimatedStyle } from 'react-native-reanimated';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { AppConfig } from '@/src/core/config/appConfig';
import { loginWithEmail, signInWithGoogleIdToken } from '@/src/core/firebase/auth';
import { seedDemoData } from '@/src/core/firebase/seed';
import { isFirebaseConfigured } from '@/src/core/firebase/env';
import { useGoogleAuthRequest } from '@/src/core/firebase/googleAuth';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { TextField } from '@/src/components/inputs/TextField';
import { Button } from '@/src/components/buttons/Button';
import { Divider } from '@/src/components/misc/Divider';

export default function LoginScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const shake = useSharedValue(0);
  const [, googleResponse, promptGoogleAuth] = useGoogleAuthRequest();

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const triggerShake = () => {
    shake.value = withSequence(
      withTiming(-8, { duration: 60 }),
      withTiming(8, { duration: 60 }),
      withTiming(-6, { duration: 60 }),
      withTiming(0, { duration: 60 })
    );
  };

  const validate = () => {
    const next: { email?: string; password?: string } = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = t('auth.invalidCredentials');
    if (password.length < 6) next.password = t('auth.invalidCredentials');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) {
      triggerShake();
      return;
    }
    setLoading(true);
    try {
      await loginWithEmail(email, password);
      showToast(t('auth.loginSuccess'), 'success');
      router.replace('/(tabs)');
    } catch {
      triggerShake();
      showToast(t('auth.invalidCredentials'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!isFirebaseConfigured) {
      showToast(t('auth.seedNotConfigured'), 'warning');
      return;
    }
    try {
      const result = await promptGoogleAuth();
      if (result.type === 'success' && result.params.id_token) {
        setLoading(true);
        await signInWithGoogleIdToken(result.params.id_token);
        showToast(t('auth.loginSuccess'), 'success');
        router.replace('/(tabs)');
      }
    } catch {
      showToast(t('auth.networkError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedDemoData = async () => {
    if (!isFirebaseConfigured) {
      showToast(t('auth.seedNotConfigured'), 'warning');
      return;
    }
    setSeeding(true);
    try {
      await seedDemoData();
      showToast(t('auth.seedSuccess'), 'success');
    } catch {
      showToast(t('auth.seedFailed'), 'error');
    } finally {
      setSeeding(false);
    }
  };

  void googleResponse;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
        <Animated.View style={[{ gap: spacing.md }, shakeStyle]}>
          <View style={{ alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
            <Image source={AppConfig.identity.logoAsset} style={{ width: 64, height: 64, borderRadius: 14 }} />
            <Text variant="h1" weight="bold">{t('auth.login')}</Text>
            <Text variant="body" secondary>{t('auth.loginSubtitle')}</Text>
          </View>

          <TextField
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            errorText={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            testID="login-email"
          />
          <TextField
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            errorText={errors.password}
            secureToggle
            secureTextEntry
            autoComplete="password"
            testID="login-password"
          />

          <Link href="/(auth)/forgot-password" style={{ alignSelf: 'flex-end' }}>
            <Text variant="bodySmall" style={{ color: colors.primary }}>{t('auth.forgotPassword')}</Text>
          </Link>

          <Button label={t('auth.login')} onPress={handleLogin} loading={loading} testID="login-submit" />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.sm }}>
            <Divider style={{ flex: 1 }} />
            <Text variant="caption" secondary>{t('auth.orContinueWith')}</Text>
            <Divider style={{ flex: 1 }} />
          </View>

          <Button label={t('auth.continueWithGoogle')} variant="secondary" onPress={handleGoogleSignIn} />

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm }}>
            <Text variant="body" secondary>{t('auth.noAccount')}</Text>
            <Link href="/(auth)/signup">
              <Text variant="body" weight="semiBold" style={{ color: colors.primary }}>{t('auth.signUp')}</Text>
            </Link>
          </View>

          {__DEV__ ? (
            <View
              style={{
                marginTop: spacing.xl,
                padding: spacing.md,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                borderStyle: 'dashed',
                gap: spacing.xs,
              }}
            >
              <Text variant="caption" weight="semiBold" secondary>{t('auth.seedDemoDataDesc')}</Text>
              <Button label={t('auth.seedDemoData')} variant="text" onPress={handleSeedDemoData} loading={seeding} testID="seed-demo-data" />
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
