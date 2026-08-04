// Global Top App Bar (PRD §8.3): title, back, action icons slot.
// Internally renders the same curved blue gradient header as SubpageHeader,
// so every screen that was still using the old flat TopAppBar automatically
// picks up the app-wide curved header without needing to touch each file.
import React from 'react';
import { SubpageHeader } from '@/src/components/nav/SubpageHeader';

export interface TopAppBarProps {
  title?: string;
  showBack?: boolean;
  onBackPress?: () => void;
  actions?: React.ReactNode;
}

export function TopAppBar({ title, showBack = true, onBackPress, actions }: TopAppBarProps) {
  return (
    <SubpageHeader
      title={title ?? ''}
      showBack={showBack}
      onBackPress={onBackPress}
      rightSlot={actions}
    />
  );
}
