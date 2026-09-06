# 9. Global State Patterns

Every screen with dynamic data handles ALL of these unless noted otherwise.

## 9.1 Loading
- Skeleton loaders matching the content shape (preferred over spinners).
- Full-screen spinner only for first-time, no-prior-content loads.

## 9.2 Empty
- Illustration + short explanation + optional CTA (e.g. "Browse Subjects" on empty Bookmarks).

## 9.3 Error
- Clear localized message (never raw technical text) + Retry button.

## 9.4 Offline
- Persistent, non-blocking offline banner at top.
- Cached content remains visible/usable.
- Network actions disabled or queued with clear indicator — never silent failure.

## 9.5 Success/Confirmation
- Toast for lightweight confirmations ("Bookmark added").
- Confirmation Dialog for consequential actions ("Delete this note?", "Submit exam now?").

## 9.6 Pull-to-Refresh & Pagination
- All dynamic scrollable lists support pull-to-refresh.
- Long lists use pagination/infinite scroll with inline end-of-list loader, not full-screen reload.
