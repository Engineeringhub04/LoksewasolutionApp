# 11–45. Screen Specifications

> Every screen below must follow Global States ([09-global-states.md](09-global-states.md)) and Motion ([10-motion.md](10-motion.md)).
> Bottom Navigation: **Home, Exam, Discussion, Profile** (4 tabs).

---

## 11. Splash
**Purpose:** First screen on launch; initializes app and routes correctly.
**Components:** Centered app logo, optional tagline, Primary Gradient background.
**Flow:**
1. Show Splash immediately (no blank white screen).
2. In parallel: init App Config (05), check remote config (Maintenance Mode, Force Update), check local auth token.
3. Routing decision (in order):
   - Maintenance Mode on → Maintenance screen (45.3)
   - Force Update required → Update Required (45.1)
   - No internet + no cached session → No Internet (45.2)
   - Valid auth session → Home (16)
   - First-ever launch → Onboarding (12)
   - Else → Login (13)

**Animations:** Logo fade-in + subtle scale-up; cross-fade into next screen.
**Edge:** Slow network — bounded max splash duration, then proceed with cached/default config.

---

## 12. Onboarding
3–5 swipeable full-bleed slides: headline + short description + dots + "Skip" + "Next"/"Get Started".
Layout: illustration top ~60%, text middle, controls bottom.
**Gestures:** horizontal swipe; "Skip" always jumps to Login.
**Edge:** Shown once (first launch) unless app data reset. Final slide → Login.

---

## 13. Login
**Components:** Logo/header, Email, Password (show/hide toggle), "Forgot Password?" link, Primary Login button, divider, social login button(s), "Don't have an account? Sign Up" link.
**Animations:** Fields fade/slide in; button inline loading; shake on invalid credentials.
**Flow:** Credentials → Login → loading → success → Home; failure → inline error + toast.
**Toasts:** "Login successful", "Invalid email or password", "Network error, please try again".
**Loading:** Button-level spinner; screen locked until response.
**Errors:** Field-level validation on blur/submit; server errors via toast + inline banner.
**Edge:** Repeated failures → server-driven lockout message; preserve autofill.

---

## 14. Signup
**Components:** Name, Email, Password, Confirm Password, Terms & Conditions checkbox (links to 44), Primary "Create Account", "Already have an account? Login".
**Animations:** Field entry like Login; checkmark success animation before transition.
**Flow:** Validate → submit → (optional) OTP/verification → Home or "Complete your profile" prompt.
**Toasts:** "Account created successfully"; inline validation errors per field.
**Edge:** Password strength + hint before submission, not only after failure; "email already registered" directs to Login.

---

## 15. Forgot Password
**Components:** Email input, "Send Reset Link/Code" button, back-to-Login link.
**Flow:** Email → submit → confirmation shown *regardless* of whether the email exists (prevents enumeration) → OTP step (if OTP-based) → new password step → success → Login.
**Toast:** "If this email is registered, a reset link has been sent."
**Edge:** Rate-limit repeated resets with friendly cooldown message.

---

## 16. Home
Central hub after login. Sections top-to-bottom:
1. **Header** — greeting ("Good morning, [Name]"), Search icon (→38), notification bell + unread badge (→37), profile avatar (→39)
2. **Auto Carousel** — auto-scrolling banners/ads, swipeable, auto-advances, pauses on interaction
3. **Question of the Day** card — preview, tap → dedicated screen (23, not inline)
4. **Subject Categories** — horizontal/grid subject cards → Subject Detail (18)
5. **Quick Actions** — exactly 4 prominent buttons (e.g. Mock Test, Current Affairs, Bookmarks, Notes — labels/icons configurable)
6. **Additional Features Grid** — 3×3 (9 shortcuts, secondary frequent features)
7. **Recent Notices** — latest 3 compact + "View All" full list; each opens detail
8. **LS App Guide** — 6 shortcuts: Download, Report, Leaderboard, Bookmark, Keep Notes, + 1 configurable
9. **Bottom Navigation** — Home, Exam, Discussion, Profile

**Animations:** Per-section skeletons with staggered fade-in (don't block whole screen); smooth carousel; card press scale-down; pull-to-refresh reloads all sections.
**States:** Per-section skeletons, per-section retry (notices fail ≠ whole screen fails), carousel hides if 0 banners, offline banner + cached content.

---

## 17. Subject List
Header (title + search icon) + grid/list of Subject Cards (icon, name, progress indicator, chapter count).
Staggered card entry; Hero transition into Subject Detail (18). Offline-cached list usable.

---

## 18. Subject Detail / Chapter List
Header (subject name, back), subject progress ring/bar, list of Chapters (title, sub-topic count, completion state).
Hero transition from Subject Card; tap Chapter → Topic Detail (19).
Empty state: "Content coming soon".

---

## 19. Topic Detail / Notes Viewer
Header (topic title, back, bookmark icon, share), formatted content (text/images/embedded video), "Mark as Complete", bottom Prev/Next bar.
**Toasts:** "Added to bookmarks", "Marked as complete".
Downloaded topics readable offline (see 36). Bookmark icon animates (fill + bounce).

---

## 20. PDF Viewer
Header (title, back, download, share), page render area, page indicator ("3 / 42"), zoom (pinch primary, buttons fallback).
**Gestures:** pinch-zoom, swipe pages, double-tap preset zoom.
Per-page progressive load (large PDFs don't block). Corrupted PDF → clear error + retry/redownload. Downloaded PDFs open from local storage.

---

## 21. Current Affairs
Header, date selector/filter, list (headline, summary, category tag, date), tap → detail, optional bookmark.
Empty state: "No current affairs published for this date yet".

---

## 22. Daily Gorkhapatra
Header with date nav (prev/next arrows or calendar), summarized sections, optional source link/embed. Cross-fade on date change. Bookmark/share. Missing date → clear empty state.

---

## 23. Question of the Day
Standalone screen (from Home preview). Header (back, date, share), question, MCQ options or reveal button, explanation (post-answer), streak indicator.
**Toasts:** "Streak updated: 5 days!", "Added to bookmarks".
Milestone streaks get a small celebratory animation. Already-answered: show answered state, no re-answering.

---

## 24. Quiz Practice
Untimed/lightly-timed MCQ practice per subject/chapter. Header (topic, "Q 4/20", exit), question card, options, Next, top progress bar.
Immediate inline correct/incorrect feedback per question (unlike Mock Test). Summary screen on completion.
**Dialog:** exit mid-practice → "Your progress will be lost. Exit anyway?"
Downloaded questions practiceable offline.

---

## 25. Mock Test
Pre-test instructions (duration, question count, marking scheme, Start button), in-test header (countdown, question counter, flag-for-review), question card, bottom bar (Previous / Next / grid overview), Submit.
Timer color-shifts to warning/error in final minutes; flagged questions badged in grid.
**Flow:** Instructions → Start → answer/flag → grid jump → Submit (manual or auto on expiry) → Result (27).
**Dialogs:** "You have X unanswered questions. Submit anyway?"; auto-submit brief non-blocking notice.
**Toasts:** "Question flagged for review", "Answer saved".
**Critical:** Questions fully loaded before timer starts; brief connectivity loss must not lose answers; timer based on real elapsed time (survives backgrounding); restore in-progress answers after app kill where feasible.

---

## 26. Live Exam
Scheduled synchronized exam — all participants start/end at official time.
Pre-exam waiting room (countdown + participant count) → auto-start at scheduled time → same structure as Mock Test (25) → post-exam processing → results released simultaneously to all.
**Dialogs:** confirm join; warn on mid-exam leave.
**Edge:** late joiners blocked or reduced-time (per exam config); results never leak early.

---

## 27. Result
Score summary (score, %, pass/fail), time taken, correct/incorrect/unattempted, per-question review (question, user's answer, correct answer, explanation), "Retake Test" + "Back to Home".
Score reveal: count-up + progress ring animation; celebratory for high scores.
"Calculating your result..." between submit and reveal. Result cached — viewable offline later (30).

---

## 28. Performance Analytics
Overall score trend chart, subject-wise strength/weakness bars, study streak calendar, time-spent summary, weak-topic recommendations.
Charts animate in (draw-in). Tap weak subject → Subject Detail (18).
Low-data empty state: "Complete a few more mock tests to see your analytics".

---

## 29. Leaderboard
Scope filter (All-Time, Weekly, per specific test), ranked list (rank, avatar, name, score), current user's row highlighted/pinned (auto-scroll or pin), top-3 special treatment (medals/gradient/shine).
Empty state when scope has no data.

---

## 30. Exam History
Filterable/sortable list (date, subject, score) — each row: test name, date, score, "View Result" → Result (27).
Empty state + CTA to start a Mock Test.

---

## 31. Discussion Feed
Header (title, filter/sort, search), FAB → Create Discussion (33), feed of Post Cards (avatar, name, timestamp, title/preview, likes, comments, category tag).
Staggered entry; like button heart-burst; pull-to-refresh + infinite scroll.
Empty state with "create the first post" CTA.

---

## 32. Discussion Detail / Comments
Full post (header, author, timestamp, body, optional image), like/comment/share row, bottom pinned comment input, Comment Cards with nested replies.
New comment animates in (slide/fade).
**Toasts:** "Comment posted", "Post reported".
**Dialogs:** confirm delete own comment/post; report bottom sheet.

---

## 33. Create Discussion
Title, body (rich or plain), category/tag selector, optional image attachment, Post button.
Image preview thumbnail fade-in; success → back to Feed with post on top.
**Dialog:** exit with unsaved content → "Discard this post?"
**Offline:** posting blocked with clear message (queued draft = future, not v1).

---

## 34. Bookmarks
Category filter tabs (Notes, Current Affairs, Questions, Discussions) + list of bookmarked items with type-relevant preview; swipe-to-remove or remove icon.
Removal slide/fade-out; tab cross-fade.
**Toast:** "Removed from bookmarks". Per-tab empty states.

---

## 35. Keep Notes
Personal notes (distinct from official content). Header, FAB create, grid/list of note cards (title, preview, last-edited, color tag), editor (title, body, color picker, save/delete).
Editor opens via hero transition from card.
**Toasts:** "Note saved", "Note deleted". Confirm-delete dialog.
Local-first — fully usable offline; account sync opportunistic when online.

---

## 36. Downloads
Header with total storage used; list (title, type icon, size, date); per-item delete; "Clear All" (confirm dialog).
Animated download progress bar/ring. Failed downloads → retry.
**Toasts:** "Download complete", "Download removed". Screen fully usable offline (reflects local storage).

---

## 37. Notifications
Header ("Mark all as read"), rows grouped by date (Today / Yesterday / Earlier): type icon, title, preview, timestamp, unread indicator.
Swipe-to-dismiss; unread dot fades out when read.
**Toast:** "All notifications marked as read". Tap → deep-link to relevant screen (e.g. reply → Discussion Detail at that comment).

---

## 38. Search
Auto-focused input top; recent searches pre-typing; live results grouped by content type; clear/cancel.
Debounced loading; "No results found for '...'" with spelling suggestion. Recent searches offline; live search needs connectivity.

---

## 39. Profile
Header (optional cover, large editable avatar), name, stat row (tests taken, streak, rank), menu: Edit Profile, Achievements, Analytics, Exam History, Settings, Help Center, Logout.
Stat count-up on entry. Logout → confirmation dialog.
Name/avatar cached — usable offline.

---

## 40. Edit Profile
Avatar with edit overlay; editable fields (Name; Email possibly read-only/verified; Phone; optional fields); "Save Changes".
Avatar picker bottom sheet (Camera / Gallery / Remove). Save → loading → toast → Profile reflects immediately.
**Toast:** "Profile updated successfully". Network changes blocked offline.

---

## 41. Achievements
Badge grid — earned in color, locked grayed-out with unlock criteria; tap → detail (unlock date or criteria).
Newly earned badges: scale-bounce + shine unlock animation on first open.

---

## 42. Settings
Sections:
- **Preferences:** Language (English/Nepali — 06), Theme (Light/Dark/System — 07), per-category notification toggles (49.2)
- **Account:** Change Password, Linked accounts, Delete Account
- **Support:** Help Center, Contact Us, Report a Problem (43)
- **About:** app version, About/Privacy/Terms (44)
- **Session:** Logout

Changes apply immediately (language/theme cross-fade).
**Dialogs:** confirm Logout; Delete Account needs explicit irreversibility warning + re-auth or typed confirmation.
**Toasts:** "Language changed to Nepali", "Theme updated".
Local prefs work offline; account changes need connectivity.

---

## 43. Help Center / Contact Us / Report Problem
- **Help Center:** searchable FAQ (expandable Q&A), category filter
- **Contact Us:** support email/phone from App Config (05), optional in-app form
- **Report a Problem:** category selector, description, optional screenshot, auto-attached device/app-version metadata, submit

**Toasts:** "Message sent, we'll get back to you soon", "Problem reported — thank you".
FAQ cacheable offline; forms blocked offline with clear message.

---

## 44. About / Privacy Policy / Terms
App logo + name + version (from config), short description, social links (Facebook/YouTube/Instagram/Discord — config), Privacy Policy & Terms links (in-app content or external URLs).
Static content bundled/cached — works offline.

---

## 45. Blocking Screens (Update Required / No Internet / Maintenance)

All driven by App Config (05). Calm illustration + fade-in; no alarming styling.

### 45.1 Update Required
Current version < Minimum Supported Version. Illustration, "Update Required", explanation, "Update Now" → store listing. Non-dismissable; re-checks on app return.

### 45.2 No Internet
No connectivity + nothing cached to fall back on. Illustration, explanation, Retry. **Auto-transitions away the moment connection is restored** (no manual tap needed).

### 45.3 Maintenance Mode
Remote config toggle on. Illustration, "Under Maintenance", admin-configurable message (expected downtime/reason). Non-dismissable; background re-checks → auto-exit when off.
