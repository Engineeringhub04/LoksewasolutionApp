# 8. Global Component Library

Everything below is defined **once** and reused — never re-implemented per screen.

## 8.1 Buttons
- Primary (filled, brand), Secondary (outlined), Danger (error color), Text/Ghost, Icon Button, FAB
- All states: default, pressed, disabled, loading (inline spinner replaces label)

## 8.2 Inputs
- Text Input (label, helper text, error text)
- Search Bar (clear icon, optional voice/filter slot)
- OTP Input (segmented, auto-focus-next)
- Dropdown/Select, Radio Group, Checkbox, Date Picker, Toggle/Switch

## 8.3 Navigation
- Bottom Navigation Bar (Home, Exam, Discussion, Profile)
- Top App Bar (title, back, action icons slot)
- Tab Bar (in-screen tabs)

## 8.4 Feedback & Overlays
- Toast/Snackbar (success, error, info, warning; auto-dismiss + optional action)
- Confirmation Dialog (cancel/confirm; destructive actions)
- Bottom Sheet (filters, quick actions, share)
- Full Dialog / Modal
- Loading Spinner (inline + full-screen)
- Skeleton Loader (per content shape)
- Empty State (illustration + message + optional CTA)
- Error State (message + retry)
- Offline Banner (persistent small top banner)

## 8.5 Content Cards
- Subject Card, Notice Card, Exam Card, Result Card, Leaderboard Row, Comment Card, Discussion Post Card, Notification Row

## 8.6 Media
- Image Viewer (pinch-zoom, swipe)
- PDF Viewer (page nav, zoom, download)
- Video Player (play/pause, scrub, fullscreen)

## 8.7 Miscellaneous
- Avatar (fallback initials when no photo)
- Badge (count, "new" tag)
- Progress Bar (linear), Progress Ring (circular — Result/Analytics)
- Chip/Tag, Divider
