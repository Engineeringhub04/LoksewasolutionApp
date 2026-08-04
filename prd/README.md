# PRD Index — Loksewa Solution

> **App:** Loksewa Solution
> **Package ID:** `com.loksewasolutionnp.hub`
> **Default Language:** English | **Supported:** English, Nepali
> **Note:** Yo PRD **framework-agnostic** ho — kunai pani stack ma implement garna milcha. Hamro current stack: **Expo (React Native) + Firebase**.

## Files Map

| File | Content |
|---|---|
| [01-overview.md](01-overview.md) | Project intro, problem, vision, mission |
| [02-goals-metrics.md](02-goals-metrics.md) | Business/user goals, success metrics |
| [03-users-personas.md](03-users-personas.md) | Target users & personas |
| [04-tech-guidelines.md](04-tech-guidelines.md) | Framework-agnostic technical principles |
| [05-app-config.md](05-app-config.md) | **App Configuration System (Single Source of Truth)** |
| [06-localization.md](06-localization.md) | i18n system (English/Nepali) |
| [07-theme.md](07-theme.md) | Design tokens (colors, typography, spacing, radius, shadows) |
| [08-components.md](08-components.md) | Global reusable component library |
| [09-global-states.md](09-global-states.md) | Loading / Empty / Error / Offline patterns |
| [10-motion.md](10-motion.md) | Motion & animation guide |
| [11-45-screens.md](11-45-screens.md) | **All 35 screens** (Splash → Maintenance) |
| [46-admin-panel.md](46-admin-panel.md) | Web Admin Panel requirements |
| [47-api.md](47-api.md) | API capability requirements |
| [48-database.md](48-database.md) | Firestore data model |
| [49-notifications.md](49-notifications.md) | Push notifications & deep linking |
| [50-security.md](50-security.md) | Security + Firestore rules + NFRs |
| [51-analytics.md](51-analytics.md) | Analytics & event tracking |
| [52-acceptance.md](52-acceptance.md) | Acceptance criteria checklist |
| [53-roadmap.md](53-roadmap.md) | Development phases |
| [54-future.md](54-future.md) | Future features (out of scope v1) |

## Rules For Any AI/Developer Reading This

1. **No hardcoded values** — everything from App Config (05), Theme (07), i18n (06).
2. **No new component per screen** — reuse Global Component Library (08).
3. **Every screen** must handle Loading/Empty/Error/Offline states (09).
4. **Read the whole file** before writing code for that area.
