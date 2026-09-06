# Low-read fix implementation plan (feature/low-read-fetch-hydration)

Branch base: origin/main 56069d0 (PR #75 merged). Working branch: feature/low-read-fetch-hydration.

## Key findings to preserve (audit)
- audit notes in read_audit_findings.md (saved earlier).
- subjectDetails.ts: fetchSubjectDetails(course, subcourse) — runQuery 2 where + orderBy on app_subjects_details; catch-all fallback = listDocuments(subjectDetails) = full scan.
- subjectChapterDetails.ts: fetchSubjectChapters — runQuery 5 where + orderBy on app_subjects_chapter_details; on failure/empty falls back to listDocuments(subjectChapterDetails) + client filter. Also fetchChapterProgressMap does 1 read per chapter (users/{uid}/learning_progress) via fetchLearningProgress.
- subjectUnitDetails.ts: fetchSubjectUnits (~146-173) falls back to listDocuments(subjectUnitDetails); fetchUnitChapters (~175-204) falls back to listDocuments(subjectUnitChapterDetails); fetchSubjectUnitsWithChapters (~233-252) loops and withProgress (~206-231) adds per-chapter progress reads.
- learning.ts: fetchLearningSubjects/Units/Chapters use listDocuments(learningSubjects/learningUnitRecords/learningChapterRecords/learningUnitChapterRecords) — legacy catalog, whole-collection reads.
- examHub.ts: fetchProvinces/Sections listDocuments; attempts list per-user.
- firestoreRest.ts listDocuments: pageSize 300, loops nextPageToken. runQuery = structured query.
- courses.ts: fetchCourses has module cache + single flight (good pattern to replicate). fetchSubcourses = listDocuments(course/subcourses) — bounded (9 docs total across courses = small), keep.
- profileStore.ts: ensureUserStats(uid) reads users/{uid} then merges; load() also reads users/{uid} via fetchUserProfile + fetchUserCourseInfo reads users/{uid} again + course/subcourse docs. => 3-4 user-doc reads on cold start.
- Home (tabs/index.tsx): fetchUserCourseInfo independent of profile store; subjectDetails.fetchSubjectDetails via useAsyncData + useRefreshOnFocus (first focus skipped).
- Subjects index.tsx: fetchSubjectDetails(course,subcourse) + useRefreshOnFocus(subjectData.refresh).
- Home also: banners (query homeBanners), developers (listDocuments app_developers — small), notifications (query limit 50 user subcollection), qotd (hasAnsweredQotdToday + fetchQuestionOfTheDay each getDocument users/{uid}/qotd/*).
- Discussion tab: fetchDiscussions limit 30 + isDiscussionLiked per post + fetchUserProfile again for isAdmin.
- course-setup.tsx: fetchCourses + direct fetchUserCourseInfo + fetchSubcourses duplicates.
- useRefreshOnFocus skips first focus; fine. useAsyncData ok.

## New design decisions
1. Deterministic IDs for subject details: `${course}__${subcourse}__${slug}` (already seeded as document IDs; SUBJECT_SEED slugs general-awareness, public-management, technical-subject). Fetch = 3 direct getDocuments (one per scope) instead of query/fallback. No full scan.
2. Keep seeded deterministic IDs for chapters? Chapter doc IDs format unknown -> check what discoverSubjectDetailScopes/seed uses: subjectChapterDetails seed creates id pattern `${course}__${subcourse}__${subjectId}__chapter-${order}`? Need to verify from seed function in same file (not shown; earlier session: Phase 2 seed). If deterministic, direct fetch by chapterList document. Simpler safe approach: store chapter list per subject as ONE documents like `app_subjects_chapter_details/{scopeId}__{subjectId}__chapters` with chapters array, and same for units/unit-chapters. BUT user has already seeded Phase 2 data with per-chapter documents — cannot restructure Phase 2 collections now (user wants low-read only). So for chapters: keep query but REMOVE fallback scan; on error return [] / error. GA 10 + PM 10 chapters = small collection (492 docs per scope? chapters: 20+62=82 per scope * 6 scopes = 492). One query = 82-120 reads. Acceptable but can add result cache module-level with TTL so focus refresh doesn't re-read.
3. Module-level cache + single-flight for: subjectDetails (scoped), subjectChapters, unitChapters, unit details, fetchCourses already cached.
4. focus-refresh: keep useRefreshOnFocus but wire cache TTL so repeated focus within window doesn't refetch Firestore. Simple: fetchers return cached data if age < STALE_MS.
5. profileStore: dedupe user-doc reads — load() should not call ensureUserStats before reading profile; instead after fetchUserProfile, if !stats, merge stats; that saves 1 read (ensureUserStats currently reads users/{uid}, then possibly writes). fetchUserCourseInfo reads users/{uid} + course + subcourse docs; reuse fetched user doc instead of re-reading.
6. Home: pass profile store course info directly; remove independent fetchUserCourseInfo async data hook (keep as fallback).
7. course-setup.tsx: use profile store data, avoid duplicate direct reads.
8. learning.ts legacy: DO NOT remove (maybe used by old exam/legacy screens). But ensure no current Phase 3-5 screen uses it — earlier grep showed no app callers for fetchLearningSubjects/Units/Chapters (only defined in learning.ts). Keep untouched but note risk. Actually app uses subjectDetails services now. Safe to leave learning.ts alone; out of scope.
9. Discovery of seed pattern: need to verify chapter doc ID pattern used by Phase 2 seed (subjectChapterDetails.seedSubjectChapters etc.) — check file lines beyond 202 (search for seed function) to see if deterministic IDs exist.

## Remaining tasks
- Phase 1 (map): verify seed doc ID patterns for chapters/units (deterministic?); verify learning.ts callers (none in app); verify examHub/subscription list reads (secondary, leave for follow-up PR — user wants low reads mainly for learning flow; include exam provinces/sections quick cache maybe).
- Phase 2: rewrite subjectDetails.ts: fetchSubjectDetails -> 3 direct getDocuments per call; cache; single-flight; remove runQuery+listDocuments.
- Phase 3: subjectChapterDetails.ts: remove listDocuments fallback; add result cache TTL; keep query. subjectUnitDetails.ts: remove listDocuments fallbacks; add cache.
- Phase 4: profileStore dedupe; Home remove duplicate fetchUserCourseInfo; course-setup reuse; (Discussion per-item reads — defer).
- Phase 5: tsc --noEmit + eslint + diff review.
- Phase 6: push + PR.

## User requirements recap
- Read count per page should be ~1-2; total app usage very low.
- New PR for low-read fix; user will merge then seed/test.
- Roman Nepali communication; never push to main.
- After merge: user pulls in Termux, rebuilds app, tests with quota reset, then seeds.
- No seed done yet by user; seed planned after PR merge+test.

## Notes about Phase 2 seed doc IDs (to verify)
- subjectDetails seed id: `${course}__${subcourse}__general-awareness|public-management|technical-subject` (from subjectDetails.ts SUBJECT_SEED + subjectDocumentId).
- chapter/unit seed id patterns: check seedSubjectChapterDetails / seedSubjectUnitDetails in subjectChapterDetails.ts and subjectUnitDetails.ts (files have seed functions beyond line 202).
