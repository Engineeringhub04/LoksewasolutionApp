// PremiumGateDialog — dedicated wrapper over ConfirmDialog for subscription gates.
//
// Three screens (subjects/index, subjects/units/[subjectId],
// subjects/chapters/[subjectId]) had byte-identical copies of the same hand-rolled
// Modal: the same amber accent, the same lock-then-diamond icon, the same two-button
// layout. Rather than let the trio drift apart independently, the look is extracted
// here once so only the i18n copy differs per screen.
//
// This component owns: tone (warning), icon (diamond), confirmIcon (arrow-forward).
// It does NOT own the copy — titles, messages, and button labels arrive as props
// so each screen keeps its own i18n keys exactly as they are.
import React from 'react';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';

export interface PremiumGateDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  /** The locked item's display name (subject, unit, or chapter) shown as subtitle. */
  itemName?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PremiumGateDialog({
  visible,
  title,
  message,
  itemName,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: PremiumGateDialogProps) {
  return (
    <ConfirmDialog
      visible={visible}
      tone="warning"
      icon="diamond"
      confirmIcon="arrow-forward"
      title={title}
      message={message}
      subtitle={itemName}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
