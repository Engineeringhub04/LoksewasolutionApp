# 4. Technology Guidelines

> This PRD is **framework-agnostic**. Our current implementation: **Expo SDK 54 (React Native) + Firebase**.
> Docs: https://docs.expo.dev/versions/v54.0.0/

## Non-negotiable Principles
1. **Single configuration source** — all environment/branding/keys in one place (see 05-app-config.md). No duplicated hardcoded values.
2. **Centralized theme/design tokens** — no inline one-off colors/spacing (see 07-theme.md).
3. **Centralized localization strings** — no hardcoded user-facing text (see 06-localization.md).
4. **Offline resilience** — graceful degradation without internet (see 09-global-states.md).
5. **Modular architecture** — features separable into modules so new features don't destabilize existing ones.
