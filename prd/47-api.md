# 47. API Requirements

> Required **capabilities**, not endpoint names. Exact schemas/protocol (REST/GraphQL) are implementation detail.
> In Firebase: most of these map to Firestore queries + callable Cloud Functions where server logic is needed.

## 47.1 Authentication
Register (email/password + optional social), Login, Logout, Forgot/Reset Password, token refresh/session validation, Delete Account.

## 47.2 Configuration
Fetch remote App Config (05): branding, toggles, Maintenance Mode, Force Update, ad IDs.

## 47.3 Content
- Subjects list, Chapters per Subject, Topic/Note content per Chapter
- Question Bank filtered by subject/chapter/difficulty (Quiz Practice)
- Mock Test / Live Exam definitions; submit attempt; fetch past results
- Current Affairs (by date/category); Gorkhapatra (by date)
- Notices (list + detail)
- PDF/document download

## 47.4 User Data
Profile fetch/update; Performance Analytics aggregates; Exam History; Bookmarks add/remove/list (generic across content type); Keep Notes CRUD (user-scoped); Achievements fetch.

## 47.5 Community
Discussion list (paginated), create post, fetch post + comments, comment/reply, like/unlike, report post/comment, delete own post/comment.

## 47.6 Leaderboard
Rankings scoped by time period and/or specific test/exam.

## 47.7 Notifications
Push token registration; in-app inbox (list, mark-read, mark-all-read).

## 47.8 Support
Submit Contact message; submit Problem report (optional attachment + auto device/app metadata).

## 47.9 Search
Global search across content types, grouped/typed results.

## 47.10 Cross-Cutting
- Auth-protected endpoints validate token; consistent unauthorized response (app routes to Login).
- Large datasets paginated (Question Bank, Feed, Notifications, Leaderboard).
- Timestamps consistent ISO 8601 with timezone.
- Error shape consistent: error code + human-readable message → renders via Global Error State (09.3) without per-endpoint special-casing.
