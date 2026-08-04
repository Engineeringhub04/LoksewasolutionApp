// §14 Signup
import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { registerWithEmail } from '@/src/core/firebase/auth';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { TextField } from '@/src/components/inputs/TextField';
import { Button } from '@/src/components/buttons/Button';
import { Checkbox } from '@/src/components/inputs/Checkbox';

export default function SignupScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = t('common.somethingWentWrong');
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = t('auth.invalidCredentials');
    if (password.length < 6) next.password = t('common.somethingWentWrong');
    if (password !== confirmPassword) next.confirmPassword = t('common.somethingWentWrong');
    setErrors(next);
    return Object.keys(next).length === 0 && agreed;
  };

  const handleSignup = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await registerWithEmail(name.trim(), email, password);
      showToast(t('auth.accountCreated'), 'success');
      router.replace('/(tabs)');
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === 'auth/email-already-in-use') {
        showToast(t('auth.emailAlreadyRegistered'), 'error');
      } else {
        showToast(t('auth.networkError'), 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: spacing.md }}>
          <View style={{ alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
            <Text variant="h1" weight="bold">{t('auth.createAccount')}</Text>
          </View>

          <TextField label={t('auth.name')} value={name} onChangeText={setName} errorText={errors.name} autoComplete="name" />
          <TextField
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            errorText={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <TextField label={t('auth.password')} value={password} onChangeText={setPassword} errorText={errors.password} secureToggle secureTextEntry />
          <TextField
            label={t('auth.confirmPassword')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            errorText={errors.confirmPassword}
            secureToggle
            secureTextEntry
          />

          <Checkbox
            checked={agreed}
            onChange={setAgreed}
            label={
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <Text variant="body">{t('auth.agreeTerms')}</Text>
              </View>
            }
          />

          <Button label={t('auth.createAccount')} onPress={handleSignup} loading={loading} disabled={!agreed} />

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm }}>
            <Text variant="body" secondary>{t('auth.haveAccount')}</Text>
            <Link href="/(auth)/login">
              <Text variant="body" weight="semiBold" style={{ color: colors.primary }}>{t('auth.login')}</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
