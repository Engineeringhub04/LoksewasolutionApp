// Global Image Viewer (PRD §8.6): pinch-zoom, swipe (full-screen modal).
import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { IconButton } from '@/src/components/buttons/IconButton';

export interface ImageViewerProps {
  visible: boolean;
  uri: string;
  onClose: () => void;
}

export function ImageViewer({ visible, uri, onClose }: ImageViewerProps) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' }}>
        <GestureDetector gesture={pinch}>
          <Animated.View style={animatedStyle}>
            <Image source={{ uri }} style={{ width: '100%', height: 400 }} contentFit="contain" />
          </Animated.View>
        </GestureDetector>
        <Pressable
          onPress={onClose}
          style={{ position: 'absolute', top: 48, right: 16 }}
          accessibilityLabel="Close image viewer"
        >
          <IconButton name="close" accessibilityLabel="Close" color="#FFFFFF" onPress={onClose} />
        </Pressable>
      </View>
    </Modal>
  );
}
