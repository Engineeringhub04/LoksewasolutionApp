# Low-read fix PR progress

Branch: feature/low-read-fetch-hydration (base origin/main 56069d0, PR #75 merged). User merges manually; never push to main.

## User requirements
- Whole-app read usage ~1-2 reads per page; total should not jump (earlier 5.5k->32k spike).
- New PR; user will merge, rebuild app in Termux, test, then seed (seed NOT done yet).
- Roman Nepali comms; quota resets ~12:45 Nepal time; user must not hammer app.

## Confirmed facts from audit (read_audit_findings.md)
- subjectDetails.ts seed doc IDs: `${course}__${subcourse}__${slug}` (slugs: general-awareness, public-management, technical-subject). DONE: rewrote subjectDetails.ts with deterministic getDocument x3 + module cache (STALE_MS=3min) + single-flight + fetchSubjectDetailsAll for visible errors. Uses clearSubjectDetailCache export.
- subjectStructureDetails.ts seeds chapters at `${course}__${subcourse}__${subjectId}__${chapter.id}` (documentId joins normalized parts with '__'). Subject ids: general-awareness, public-management, technical-subject (catalog 'job-based-knowledge' maps to technical-subject).
- subjectChapterDetails.ts fetchSubjectChapters: runQuery 5 filters -> fallback listDocuments(subjectChapterDetails) + client filter. REMOVE fallback; add module cache + single-flight. Keep query.
- subjectUnitDetails.ts fetchSubjectUnits/fetchUnitChapters: same pattern with listDocuments fallbacks -> remove; add cache. fetchSubjectUnitsWithChapters chains them; withProgress does 1 read per chapter (users/{uid}/learning_progress) — keep per-chapter reads (needed), they are bounded.
- courses.ts: fetchCourses already cached+single-flight; fetchSubcourses bounded (9 docs). keep.
- profileStore.ts load(): ensureUserStats(uid) reads users/{uid}, then fetchUserProfile(uid) reads users/{uid} again, fetchUserCourseInfo(uid) reads users/{uid} + course + subcourse. => reduce to 1 user-doc read by having load() use fetched user doc.
- Home (tabs/index.tsx): independent useAsyncData fetchUserCourseInfo (users/{uid} again) + subjectDetails + QOTD hasAnsweredQotdToday (users/{uid}/qotd/...) + fetchNotifications (users subcollection, limit 50) + banners + developers. Remove redundant courseInfo hook (store already warmed). QOTD: hasAnsweredQotdToday + fetchQuestionOfTheDay each read state doc — add tiny cache.
- course-setup.tsx: apply store courseInfo first (lines 88-95), still direct fetchUserCourseInfo mount (96-108) — make fallback only when store empty.
- discussion tab: per-post isDiscussionLiked + extra fetchUserProfile for isAdmin — add cache single-flight in isDiscussionLiked; isAdmin from store.
- useRefreshOnFocus skips first focus only, no cooldown — fine; module caches absorb repeats.
- firestoreRest.ts: getDocument(path) 1 read; listDocuments pageSize 300 loops; runQuery structured.

## DONE so far (updated)
1. [DONE] subjectDetails.ts deterministic getDocument x3 + module cache (STALE_MS 3min) + single-flight + fetchSubjectDetailsAll + clearSubjectDetailCache.
2. [DONE] subjectChapterDetails.ts: listDocuments fallback removed, targeted runQuery + cache (opts?.force), clearChapterDetailCache, removed isDirectChapterDocument.
3. [DONE] subjectUnitDetails.ts: both listDocuments fallbacks removed, units + unitChapters caches, clearUnitDetailCache, removed unitMatches/sameScope/chapterMatches.
4. [DONE] profile.ts fetchUserProfile: inline stats backfill on same read (removes ensureUserStats extra read); profileStore.ts: ensureUserStats call removed.
5. [DONE] Home (tabs)/index.tsx: removed duplicate fetchUserCourseInfo useAsyncData; enrolled scope from store first; removed courseInfo from refresh/loading state; courseName/subcourseName from store only.
6. [DONE] qotd.ts: module cache (60s) + single-flight for qotd state; submit invalidates cache; fetchQuestionOfTheDay now parallel reads question+state.
7. [DONE] (tabs)/discussion.tsx: storeProfile?.isAdmin instead of fetchUserProfile(uid); removed import.
8. [DONE] discussion/[id].tsx: storeProfile from store; fetchUserProfile import removed; comment/reply use store profile.
9. [DONE] discussion/create.tsx: isAdmin from storeProfile; fetchUserProfile import removed.
10. [DONE] course-setup.tsx: Source-2 fallback now skips when storeCourseId/storeSubcourseId present.
11. [DONE] discussions.ts: reaction reads (isDiscussionLiked/isCommentLiked/toggleReaction) now use 60s module cache + single-flight; invalidates on toggle; toggleLikeDiscussion invalidates too.
12. TODO: tsc + eslint on changed files; diff review; push; PR.

## TODO checklist
1. [DONE] subjectDetails.ts deterministic fetch + cache.
2. subjectChapterDetails.ts: remove listDocuments fallback (lines ~134-145); add module cache+single-flight (reuse pattern); export clearChapterCache.
3. subjectUnitDetails.ts: remove both listDocuments fallbacks (~169, ~200); add module caches (units, unitChapters); export clearers.
4. profile.ts: no change needed to fetchUserProfile itself; but profileStore.ts: merge ensureUserStats into single user-doc read flow: fetch profile first, if !stats merge stats (saves 1 read).
5. Home tabs/index.tsx: remove independent courseInfo useAsyncData; derive from store; keep profile/courses fallbacks logic. QOTD: add simple single-flight/memo to hasAnsweredQotdToday (maybe cache key uid+course).
6. course-setup.tsx: prefer store data, fallback direct fetch only when store null.
7. discussion.tsx: replace fetchUserProfile for isAdmin with store profile.isAdmin (useProfileStore available); ensure isDiscussionLiked is single-flight (check notifications/reactions service).
8. Verify no remaining callers of removed APIs (fetchSubjectDetailsAll optional param keeps signature compatible; check imports of subjectDetails in app).
9. tsc --noEmit; eslint changed files; diff review.
10. Push + PR #76 (feature/low-read-fetch-hydration) with merge/seed/test instructions.

## Post-merge instructions to give user
- Merge PR, git pull in Termux, expo rebuild (update).
- Quota reset: only then controlled test: app open (note reads), Subjects page (note reads), Chapters/Units page, Practice/Read/Theory (1 read each).
- Then seed via admin button (seed is idempotent).
- Verify document IDs/structure in Console.
- Do NOT open app repeatedly before quota reset.
