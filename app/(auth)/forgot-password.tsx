// §15 Forgot Password — confirmation shown regardless of whether email exists (prevents enumeration).
import React, { useState } from 'react';
import { View, KeyboardAvoidingView, Platform } from 'react-native';
import { Link } from 'expo-router';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { sendResetPasswordEmail } from '@/src/core/firebase/auth';
import { showToast } from '@/src/core/store/toastStore';
import { Text } from '@/src/components/misc/Text';
import { TextField } from '@/src/components/inputs/TextField';
import { Button } from '@/src/components/buttons/Button';

export default function ForgotPasswordScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError(t('auth.invalidCredentials'));
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      await sendResetPasswordEmail(email);
    } catch {
      // Intentionally ignored — always show the same neutral message (PRD §15: prevents enumeration).
    } finally {
      setLoading(false);
      setSent(true);
      showToast(t('auth.resetLinkSent'), 'info');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, padding: spacing.xl, justifyContent: 'center', gap: spacing.md }}>
        <Text variant="h1" weight="bold">{t('auth.forgotPassword')}</Text>

        {sent ? (
          <Text variant="body" secondary>{t('auth.resetLinkSent')}</Text>
        ) : (
          <>
            <TextField
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              errorText={error}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Button label={t('auth.sendResetLink')} onPress={handleSubmit} loading={loading} />
          </>
        )}

        <Link href="/(auth)/login" style={{ alignSelf: 'center', marginTop: spacing.md }}>
          <Text variant="body" weight="semiBold" style={{ color: colors.primary }}>{t('auth.backToLogin')}</Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}
