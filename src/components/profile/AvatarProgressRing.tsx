// Circular determinate progress ring drawn around the profile avatar while a
// photo uploads to Cloudinary.
//
// Blue while uploading (driven by real XHR upload-progress events), green once
// the upload completes, and a plain themed ring when idle. Gives the user actual
// feedback instead of the photo appearing to change instantly while the network
// request is still in flight.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/src/core/theme';

export type UploadState = 'idle' | 'uploading' | 'done';

interface AvatarProgressRingProps {
  /** Diameter of the inner avatar content. */
  size: number;
  /** 0..1 */
  progress: number;
  state: UploadState;
  children: React.ReactNode;
}

const STROKE = 4;
const UPLOADING_COLOR = '#2563EB';
const DONE_COLOR = '#22C55E';

export function AvatarProgressRing({ size, progress, state, children }: AvatarProgressRingProps) {
  const { colors } = useTheme();

  const padding = STROKE + 2;
  const outer = size + padding * 2;
  const radius = (outer - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));

  const activeColor = state === 'done' ? DONE_COLOR : UPLOADING_COLOR;
  const showRing = state !== 'idle';

  return (
    <View style={{ width: outer, height: outer, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={outer} height={outer} style={StyleSheet.absoluteFillObject}>
        {/* Track */}
        <Circle
          cx={outer / 2}
          cy={outer / 2}
          r={radius}
          stroke={showRing ? `${activeColor}33` : colors.border}
          strokeWidth={STROKE}
          fill="none"
        />
        {showRing ? (
          <Circle
            cx={outer / 2}
            cy={outer / 2}
            r={radius}
            stroke={activeColor}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            // 'done' always draws a full ring even if the last progress event
            // came in slightly under 1.
            strokeDashoffset={circumference * (1 - (state === 'done' ? 1 : clamped))}
            // Start the arc at 12 o'clock rather than 3 o'clock.
            transform={`rotate(-90 ${outer / 2} ${outer / 2})`}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}
