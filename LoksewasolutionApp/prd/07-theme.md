# 7. Theme System — Design Tokens

## 7.1 Purpose
All colors, typography, spacing, radii, shadows, gradients defined ONCE as tokens. No inline one-off values anywhere.

## 7.2 Color Tokens
- Primary, Secondary, Accent
- Background (Light / Dark)
- Surface / Card (Light / Dark)
- Text Primary, Text Secondary, Text Disabled (per mode)
- Success, Warning, Error, Info
- Border / Divider
- Overlay / Scrim (modals, bottom sheets)
- Named gradients (e.g. "Primary Gradient", "Premium Gold Gradient")

Brand-level colors (Primary/Secondary) sourced from App Config (05); mode-dependent variants from theme layer.

## 7.3 Typography Tokens
- Font family (default + fallback)
- Type scale: Display, H1–H3, Body Large, Body, Body Small, Caption, Overline
- Weights: Regular, Medium, SemiBold, Bold
- Line height per scale step

## 7.4 Spacing & Layout
- Base spacing unit (4dp grid)
- Named steps: xs, sm, md, lg, xl, xxl
- Standard screen horizontal padding
- Standard card padding

## 7.5 Radius / Elevation / Shadow
- Radius steps: small, medium, large, pill/full
- Elevation levels 0–5, each mapped to a shadow definition
- Consistent shadow color/opacity per level

## 7.6 Light / Dark Mode
- Both modes supported; every token has Light + Dark values.
- Default: follows device system on first launch; user override in Settings.
- Switch applies instantly across visible screens.
