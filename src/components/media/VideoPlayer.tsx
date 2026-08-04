// Global Video Player (PRD §8.6): play/pause, scrub, fullscreen.
import React from 'react';
import { View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTheme } from '@/src/core/theme';

export interface VideoPlayerProps {
  uri: string;
  aspectRatio?: number;
}

export function VideoPlayer({ uri, aspectRatio = 16 / 9 }: VideoPlayerProps) {
  const { radius } = useTheme();
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });

  return (
    <View style={{ width: '100%', aspectRatio, borderRadius: radius.md, overflow: 'hidden' }}>
      <VideoView style={{ flex: 1 }} player={player} allowsFullscreen allowsPictureInPicture nativeControls />
    </View>
  );
}
