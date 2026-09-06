# 10. Motion & Animation Guide

Expo implementation: `react-native-reanimated` / `moti`. Durations come from theme animation tokens — never hardcoded.

## 10.1 Principles
- Smooth, purposeful, never blocks user.
- Duration bands: micro-interactions 100–150ms; standard transitions 250–350ms; emphasis 400–600ms.

## 10.2 Standard Patterns
- **Fade** — toasts, dialog backdrops, content appear/disappear
- **Slide** — screen transitions, bottom sheets
- **Scale** — button press feedback, dialogs appearing
- **Hero / Shared Element** — card → detail screen (tapped element grows into header)
- **Ripple** — tap feedback on buttons/list items
- **Haptic** — light feedback on key confirmations (exam submit, bookmark)
- **Shimmer** — skeleton loaders, left-to-right (RTL-safe variant allowed)
- Custom brand-colored pull-to-refresh indicator
- Inline infinite-scroll spinner

## 10.3 Page Transitions
- Forward: slide-in from right (platform-appropriate)
- Modal/bottom sheet: slide up + backdrop fade
- Back: reverse of forward
