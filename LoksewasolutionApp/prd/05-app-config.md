# 5. App Configuration System — Single Source of Truth

## 5.1 Purpose
All environment/branding/key values live in **one centralized config source**. No screen, component, or module may hardcode any of these values. **Strict rule:** if a value could change when rebranding or switching environments, it belongs here and nowhere else.

## 5.2 Required Configuration Fields

### App Identity
- App Name (`Loksewa Solution`)
- Package/Bundle ID (`com.loksewasolutionnp.hub`)
- App Version (semantic), Build Number
- App Logo asset ref, Splash image/animation ref
- App Tagline/Description

### API & Backend
- API Base URL
- API Timeout duration
- API Version header (if applicable)

### Advertising
- Ad Provider App ID (e.g., AdMob App ID)
- App Open / Banner / Interstitial / Rewarded / Native Ad Unit IDs
- Ads Enabled Toggle (global on/off)

### Branding / Design
- Primary, Secondary, Accent colors
- Success / Warning / Error / Info colors
- Gradient definitions (start/end per named gradient)
- Default font family

### Social & External Links
- Facebook, YouTube, Instagram, Discord, Website URLs

### Legal & Support
- Privacy Policy URL, Terms & Conditions URL
- Support Email, Contact Phone

### App Behavior / Feature Flags
- Maintenance Mode (+ optional message)
- Force Update toggle
- Minimum Supported App Version, Latest Available App Version
- Per-module feature toggles (Discussion enabled, Leaderboard enabled, etc.)
- Default Exam Timer Duration (fallback; exams can override)
- Current Affairs source identifier

### Notifications
- Default notification topic(s)
- Notification icon/sound ref

### Localization
- Default language code (`en`)
- Supported language codes (`en`, `ne`)

## 5.3 Behavior Rules
- Every screen/component/service **imports** from the config — never redeclares.
- Rebranding = editing this one config source only.
- Remote-configurable fields (Maintenance, Force Update, Feature Toggles) fetched at app start; local config is the fallback if fetch fails.
- Config resolved during **Splash/Initialization** (Section 11) before dependent screens render.

## 5.4 Non-Goal
Physical storage (file/module/remote JSON) is an implementation detail — only required to be conceptually singular, zero duplication.
