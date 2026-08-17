# Firestore read audit findings

## Primary hotspot
`src/core/firebase/services/subjectDetails.ts` runs a structured query on `app_subjects_details` with two where filters plus orderBy. Any error is caught and falls back to `listDocuments(Collections.subjectDetails)`, which reads every document in the collection. This catches HTTP_429, permission errors, missing indexes, and transient failures, so quota/rules/index failures silently become full-collection scans.

`app/subjects/index.tsx` calls `fetchSubjectDetails` through `useAsyncData` and also registers `useRefreshOnFocus(subjectData.refresh)`. The first focus is skipped, but every later focus re-runs the fetch. If the query is failing, each focus/refresh scans the entire subject collection again.

Home (`app/(tabs)/index.tsx`) also calls `fetchSubjectDetails` and separately loads course info, banners, developers, notifications, QOTD, and profile data. Home and Subjects do not share a subject-details cache, so navigation can issue duplicate subject requests.

## Other collection-scan risks
`src/core/firebase/services/learning.ts` uses `listDocuments` for app_learning_subjects, flat learning units, and flat learning chapter records before fallback to nested paths. These are legacy catalog paths and should not be used by Phase 5 content fetches, but they remain app-wide low-read risks if any screen calls them.

`src/core/firebase/services/subjectChapterDetails.ts` and `subjectUnitDetails.ts` also fall back to full collection scans when scoped queries fail. Chapter/unit pages can therefore produce the same burst after navigation.

`src/core/firebase/services/examHub.ts` lists exam provinces/sections and user attempts; `examPurchases.ts`, subscription services, and other pages also have list-based reads. These are secondary risks and should be audited after the subject/catalog hotspot.

## Bounded/secondary Home reads
Home notifications are limited to 50; banners and developer data are usually small. QOTD uses direct per-user documents. They cannot alone explain a 5.5k to 32k jump, but Home also duplicates course/profile reads.

Root layout warms profile on user login using ensureUserStats + fetchUserProfile + fetchUserCourseInfo. Home independently calls fetchUserCourseInfo again. This is a small duplicate multiplier, not the primary burst.

## Immediate likely explanation
The most likely cause is a query failure in subjectDetails (possibly composite index/rules/429) triggering the catch-all full collection fallback, multiplied by Home/Subjects focus refreshes or repeated navigation. The fallback must not run on every error.

## Low-read fix direction
1. Remove catch-all listDocuments fallbacks from runtime screen fetches.
2. Use direct deterministic document IDs or properly scoped queries with safe limits.
3. If a query fails, return an error/empty state and log the exact cause; never scan a whole collection as recovery.
4. Add module-level cache + single-flight request deduplication to subject details, chapters, units, and learning catalog services.
5. Reuse the profile store’s course info instead of fetching user/course data again on Home.
6. Make focus refresh opt-in and cooldown/debounce it; do not refresh on every focus if cached data is fresh.
7. Audit legacy learning and exam/subscription list reads in a separate follow-up after measuring the subject fix.

## Testing constraint
Do not repeatedly open/refresh the app while the quota is low. Test only after reset, one controlled app launch, one Subjects navigation, and inspect Firebase usage after each step.
