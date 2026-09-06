# 6. Localization System

## 6.1 Requirements
- Default on first launch: **English**. Supported: **English (en), Nepali (ne)**.
- Switch anytime from **Settings** — applies app-wide immediately without restart.
- ALL user-facing text from centralized resource files — no hardcoded strings in screens.
- Identical keys across both language files — no missing key in either.
- Selection persists across restarts (local device storage).
- Date/number/time formatting respects the selected locale where applicable.

## 6.2 Language Switch Flow
1. Settings → Language.
2. Select English or Nepali.
3. Confirm via toast/inline feedback.
4. All screens re-render in new language.
5. Preference saved locally.

## 6.3 UI Text vs Content
- **UI text** (buttons, labels, nav, system messages) → localized via string resources.
- **Content** (notes, questions, current affairs) → backend-provided per-language content, managed via Admin Panel — not part of UI string resources.
