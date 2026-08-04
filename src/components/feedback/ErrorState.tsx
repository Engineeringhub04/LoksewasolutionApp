// Global Error State (PRD §9.3). Internally renders the same DataNotFound
// look used everywhere else in the app (icon, "Data Not Found" title,
// consistent description, small centered retry pill) instead of a separate
// generic "Something went wrong" message — so every screen still using
// ErrorState (Exam, Live Exam, Mock Test Attempt, Question of the Day,
// Discussion, Current Affairs, Exam History, Gorkhapatra, etc.) automatically
// shows the same branded empty/error state without editing each file.
import React from 'react';
import { DataNotFound } from '@/src/components/feedback/DataNotFound';

export interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return <DataNotFound description={message} onRetry={onRetry} />;
}
