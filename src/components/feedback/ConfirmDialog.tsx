// ConfirmDialog — THE confirmation dialog. Every "are you sure?" in the app is
// this component; there are no hand-rolled confirm Modals and no Alert.alert.
//
// Import it wherever a decision needs confirming and give it local `visible`
// state. It is deliberately a plain component rather than an imperative
// `confirm()` call, because the screen usually has to remember WHAT is being
// confirmed (which post, which note) while the dialog is open.
//
//   const [confirmLogout, setConfirmLogout] = useState(false);
//   <ConfirmDialog
//     visible={confirmLogout}
//     tone="danger"
//     title={t('profile.logout')}
//     message={t('profile.logoutConfirm')}
//     onConfirm={() => { setConfirmLogout(false); void logout(); }}
//     onCancel={() => setConfirmLogout(false)}
//   />
//
// The look comes from AppDialog, the shared shell, so a confirmation is visually
// the same object as the rules popup or a premium gate — only the accent and the
// icon change. `tone` picks both: danger for anything destructive, success for a
// completing action (submit), warning/info for gates and notices. `destructive`
// is the old boolean spelling of tone="danger" and still works.
//
// Long or structured content (a reason field, a typed-confirmation input, a list)
// goes in `children`: it lands inside the dialog's own scroll area, so it can
// never end up detached behind the modal the way a sibling <View> would.
import React from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/core/theme';
import { useTranslation } from '@/src/core/i18n';
import { AppDialog } from '@/src/components/feedback/AppDialog';

/** What kind of answer is being asked for — drives the accent and the icon. */
export type ConfirmTone = 'default' | 'danger' | 'success' | 'warning' | 'info';

/**
 * Fixed accents rather than theme colours. The cap prints white text on top of
 * them, and the dark theme's `colors.error` is a pale red that white sits badly
 * on — a confirmation must not become harder to read in dark mode.
 */
const TONE_ACCENT: Record<Exclude<ConfirmTone, 'default'>, string> = {
  danger: '#DC2626',
  success: '#16A34A',
  warning: '#D97706',
  info: '#2563EB',
};

const TONE_ICON: Record<ConfirmTone, keyof typeof Ionicons.glyphMap> = {
  default: 'help-circle',
  danger: 'alert-circle',
  success: 'checkmark-circle',
  warning: 'warning',
  info: 'information-circle',
};

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  /** Second line in the cap — the thing being acted on (a note title, a name). */
  subtitle?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Shorthand for tone="danger": delete, logout, discard, leave-without-saving. */
  destructive?: boolean;
  tone?: ConfirmTone;
  /** Overrides the tone's accent when a screen has its own established colour. */
  accent?: string;
  /** Overrides the tone's icon. Ionicons only — never emoji. */
  icon?: keyof typeof Ionicons.glyphMap;
  confirmIcon?: keyof typeof Ionicons.glyphMap;
  /**
   * Hides the Cancel button and lets Confirm take the full width — for dialogs
   * where both actions would do the same thing (a plain acknowledgement, a limit
   * notice with a single way out).
   */
  singleButton?: boolean;
  /** Blocks Confirm until the dialog's own content says it is allowed. */
  confirmDisabled?: boolean;
  /** Spinner on Confirm while the action runs; Cancel is blocked meanwhile. */
  confirmLoading?: boolean;
  /** Extra body content, inside the dialog's scroll area. */
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  subtitle,
  confirmLabel,
  cancelLabel,
  destructive,
  tone,
  accent,
  icon,
  confirmIcon,
  singleButton,
  confirmDisabled,
  confirmLoading,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const resolvedTone: ConfirmTone = tone ?? (destructive ? 'danger' : 'default');
  const resolvedAccent =
    accent ??
    (resolvedTone === 'default' ? colors.primary : TONE_ACCENT[resolvedTone]);

  return (
    <AppDialog
      visible={visible}
      icon={icon ?? TONE_ICON[resolvedTone]}
      title={title}
      subtitle={subtitle}
      message={message}
      accent={resolvedAccent}
      confirmLabel={confirmLabel ?? t('common.confirm')}
      confirmIcon={confirmIcon}
      cancelLabel={cancelLabel ?? t('common.cancel')}
      singleButton={singleButton}
      confirmDisabled={confirmDisabled}
      confirmLoading={confirmLoading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {children}
    </AppDialog>
  );
}
