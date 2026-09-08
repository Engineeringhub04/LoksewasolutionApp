// Three admin screens (subscriptions, exam-purchases, content-purchases) had identical
// hand-rolled Modals for collecting a rejection reason. This wrapper centralises that
// pattern so there is one place to update if the copy, layout, or validation changes.
//
// The TextField lives in ConfirmDialog's `children` rather than beside it because
// siblings of a Modal can be rendered behind the overlay on Android, putting the field
// out of reach. Inside `children` it lands in the dialog's own scroll area and is
// always in the same stacking context as the buttons.
import React from 'react';
import { ConfirmDialog } from '@/src/components/feedback/ConfirmDialog';
import { TextField } from '@/src/components/inputs/TextField';

export interface RejectReasonDialogProps {
  visible: boolean;
  title: string;
  label?: string;
  placeholder?: string;
  reason: string;
  onChangeReason: (v: string) => void;
  confirmLabel: string;
  /** Spinner on the Confirm button while the reject call is in flight. */
  submitting?: boolean;
  subtitle?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RejectReasonDialog({
  visible,
  title,
  label,
  placeholder,
  reason,
  onChangeReason,
  confirmLabel,
  submitting,
  subtitle,
  onConfirm,
  onCancel,
}: RejectReasonDialogProps) {
  return (
    <ConfirmDialog
      visible={visible}
      tone="danger"
      icon="close-circle"
      title={title}
      subtitle={subtitle}
      confirmLabel={confirmLabel}
      // A rejection with no reason is not actionable for the person who receives it.
      confirmDisabled={!reason.trim()}
      confirmLoading={submitting}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <TextField
        label={label}
        placeholder={placeholder}
        value={reason}
        onChangeText={onChangeReason}
        multiline
        numberOfLines={3}
      />
    </ConfirmDialog>
  );
}
