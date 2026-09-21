# Analytics Page — Full Working Plan

> Status: **PLAN ONLY — no code written yet.**
> Target: rebuild `app/analytics.tsx` into a real, graph-driven, per-subcourse
> analytics screen backed by a new private collection under `users/{uid}`.

---

## 0. What exists today, and why it has to go

`app/analytics.tsx` is 100 lines and is essentially a placeholder. It reads
`fetchAnalytics(uid)` from `src/core/firebase/services/analytics.ts`, which does
one thing: pulls the last 20 exam attempts. From that it derives an average
percent, a total time, and a "score trend" that is rendered as a row of bare
`<View>` rectangles with `height: '{percent}%'` — not a chart, just coloured
divs. It then hard-gates the whole screen behind `attempts.length < 3`, so a
user who has done Question of the Day every morning for a month but never taken
a mock exam sees an empty state.

Everything else the app records — Question of the Day, daily tests, practice
mode, read mode, theory mode, GK, PM, Constitution, past questions, and app
focus time — is invisible to it.

Meanwhile the leaderboard work already built the aggregator that knows about all
of those. `computeMainLeaderboardScore()` in `src/core/services/mainLeaderboard.ts`
returns a `MainLeaderboardBreakdown` covering `qotd`, `exam`, `dailyTest`,
`practice`, `gkPm`, `reading` and `usage`, scoped to one subcourse. That is the
data backbone this page should stand on.

`src/core/firebase/services/analytics.ts` has exactly one importer — the screen
being rewritten — so it can be deleted cleanly, the same way
`services/leaderboard.ts` was.

---

## 1. Entry point — App Guide

Analytics is currently reachable only from Profile → Analytics
(`app/(tabs)/profile.tsx:225`). It is **not** in the App Guide grid.

The App Guide grid (`app/(tabs)/index.tsx:71`) holds 9 tiles today: Downloads,
Report Problem, Leaderboard, Bookmarks, Achievements, Help Center,
**Notifications**, Subscription Details, App Info. It renders through
`Grid3`, which is a plain `flexWrap` row at a fixed 3-column tile width — so a
10th tile does not re-balance, it lands alone at the left of a 4th row.

**Decided: go to 12 tiles.** Add **Analytics**, **Feedback** (`/feedback`) and
**Contact Us** (`/contact-us`) — all three are real, already-built pages — so the
grid becomes a clean 3×4 with no orphan tile. The alternatives considered were
adding Analytics alone (10 tiles, one stranded in row 4) and swapping out App
Info to stay at 9 (which would have cost a deliberate second entry point).

Tile definition:

```ts
{ key: 'analytics', icon: 'stats-chart-outline', label: 'Analytics', route: '/analytics' },
```

Placed directly after `leaderboard`, since the two share a data source and a
mental model. `GUIDE_ACCENT` (`#059669`) applies automatically.

---

## 2. Data model — `users/{uid}/app_analytics/{subcourseId}`

### 2.1 Why a new collection instead of reusing `app_mainleaderboard`

`users/{uid}/app_mainleaderboard/{subcourseId}` already holds the full breakdown
privately, and it would be tempting to just read that. It is not enough, for one
reason: **it is a snapshot, not a history.**

Every progress record in this app is cumulative and monotonic by design:

- `app_activity_progress` stores unioned arrays of question ids and a running
  `secondsSpent` — no per-day split
- `app_usage/summary` is a single document of `increment()`-ed counters
- `learning_progress` stores arrays of attempted/correct ids

Only three sources carry a per-event timestamp:

- `users/{uid}/questionofdata/{attemptId}` → has `dateKey` (`YYYY-MM-DD`,
  Asia/Kathmandu) and `answeredAt`
- `users/{uid}/exam_attempts/{id}` → `createdAt`
- `users/{uid}/daily_test_results/{id}` → `createdAt`

So "your accuracy over the last 30 days" is, right now, **unreconstructable** for
practice, reading, GK and PM. No amount of clever querying fixes that; the
information was never written down. A trend chart needs history, and history has
to start being recorded.

### 2.2 The key idea — daily snapshots of cumulative totals

Rather than trying to log every event with a timestamp (which would mean touching
a dozen screens and multiplying writes), record **one snapshot per day of the
cumulative totals as they stand at that moment**. Deltas between consecutive
snapshots then give you per-day activity for free.

```
users/{uid}/app_analytics/{subcourseId}
{
  courseId: string,
  subcourseId: string,
  percent: number,          // current weighted accuracy, 0..100
  points: number,           // current cumulative effort points
  breakdown: { ... },       // same shape as MainLeaderboardBreakdown
  streak: { current: number, best: number, lastDay: "YYYY-MM-DD" },
  seededUpTo: "YYYY-MM-DD", // days at or before this are backfilled, not observed
  firstDay:   "YYYY-MM-DD",
  days: {
    "2026-09-14": { p:1840, pc:72.4, s:18240, a:96, qa:41, qc:33, ea:6, ep:68.2, da:11, dp:64.0, ta:320, tc:240, ga:60, gc:44, rd:130 },
    "2026-09-13": { ... },
    ...
  },
  updatedAt: serverTimestamp()
}
```

Field names in `days` are deliberately two characters: this map is rewritten
whole on every snapshot, so key length is paid on every write *and* every read.
`p` points, `pc` percent, `s` study seconds, `a` activity count, `qa`/`qc` QOTD
attempts/correct, `ea`/`ep` exam attempts/avg percent, `da`/`dp` daily test
attempts/avg percent, `ta`/`tc` practice attempted/correct, `ga`/`gc` GK+PM
attempted/correct, `rd` reading units.

What each chart derives from it:

| Chart | Derivation |
|---|---|
| Score trend | plot `pc` directly per day |
| Daily effort | `p[d] − p[d−1]` |
| Daily study minutes | `(s[d] − s[d−1]) / 60` |
| Heatmap intensity | `a[d] − a[d−1]` bucketed |
| Streak | consecutive days where any delta > 0 |
| Per-source growth | deltas on `qa`, `ea`, `da`, `ta`, `ga`, `rd` |

**One document read renders the entire page.** That is the whole point of this
shape, and it matters given how read-budget-conscious the rest of this codebase
is.

Days the user did not open the app simply have no key. Charts must carry the last
known cumulative value forward and treat the delta as zero — which is exactly
correct: on a day you did not study, your percent did not move and your effort
was nil.

`days` is pruned to the most recent **180** keys on every write. At roughly 15
small numbers per day that is far under the 1 MB document ceiling with a very
large margin.

### 2.3 Write cadence

Snapshots piggyback on the existing publish path. `publishMainLeaderboardScore()`
already flushes app usage, computes the breakdown, and writes the private and
public leaderboard documents. A fourth step is added:

```
recordAnalyticsSnapshot(uid, courseId, subcourseId, score)
  → read  users/{uid}/app_analytics/{subcourseId}
  → set   days[todayKey] = cumulative totals from `score`
  → prune to 180 keys, recompute streak
  → write back
```

That is +1 read +1 write, and only when a publish actually fires.

The 5-minute throttle currently lives as a module-level `Map` inside
`app/leaderboard.tsx`. It should **move into `mainLeaderboard.ts`** so the
leaderboard screen and the analytics screen share one throttle instead of each
keeping their own and doubling the recompute rate.

There is one gap: if the user never opens either screen, no snapshot is ever
taken, and the heatmap and streak silently under-report. **Decided: add a
once-per-Kathmandu-day trigger** from `app/_layout.tsx` after auth resolves,
guarded by an AsyncStorage `lastSnapshotDay` key. Cost is one recompute
(6 `listDocuments` calls) per active day per user — worth paying, because a
streak that undercounts is worse than no streak at all.

### 2.4 Backfill on first open

The first time the document does not exist, seed `days` from the three sources
that do carry timestamps:

- QOTD — group attempt docs by their `dateKey`, then prefix-sum into cumulative
  `qa`/`qc` per day
- Exam attempts — bucket `createdAt` by Kathmandu date, prefix-sum `ea`, and
  carry a running best-per-set average into `ep`
- Daily tests — bucket `createdAt`, prefix-sum `da`/`dp`

Everything else (practice, reading, GK/PM, usage time) has no date, so it is
attributed as a single lump to the earliest backfilled day and `seededUpTo` is
set to that date.

The UI then renders any day at or before `seededUpTo` with a **dashed line and a
lighter fill**, plus a one-line legend note ("estimated — before tracking
started"). The totals reconcile, and the chart does not pretend to know something
it does not. From the first real snapshot onward the line goes solid.

### 2.5 Firestore rules

`firebase.rules` has no `users/{userId}/{document=**}` wildcard, so every new
subcollection needs its own block. One new block, placed beside the other
per-user blocks and **before** the catch-all deny at the end:

```
// Private per-user analytics: one document per enrolled subcourse holding the
// current breakdown plus up to 180 days of cumulative snapshots. Owner-only by
// design — this screen shows a user only their own data, so unlike the
// leaderboard there is no public mirror.
match /users/{userId}/app_analytics/{docId} {
  allow read: if isOwner(userId) || isAdmin();
  allow create, update: if isOwner(userId) &&
    request.resource.data.percent is number &&
    request.resource.data.percent >= 0 &&
    request.resource.data.percent <= 100;
  allow delete: if isAdmin();
}
```

Plus a path constant in `src/core/firebase/collections.ts`:

```ts
analytics: (uid: string) => `users/${uid}/app_analytics`,
```

> **You deploy this from the Firebase console** — same as the four leaderboard
> blocks, which are still pending deployment.

---

## 3. Screen layout, section by section

Order is top to bottom. A range switcher (7D / 30D / 90D / All) sits under the
header and drives sections 4, 5, 9, 10 and 12.

**1 · Header** — `SubpageHeader` with `title={t('analytics.title')}` and a
`rightSlot` holding a refresh icon plus the theme toggle. Below it, a pill
segmented control for the range.

**2 · Course / Subcourse hero card** — the Syllabus page's Active Course banner
recipe, reused and extended. Same `LinearGradient ['#2563EB','#1D4ED8','#0B1F5B']`,
same `borderRadius: 24`, same offset white glow blob, same 56 px translucent
school-icon box, same `activeLabel` / h2 `courseName` / `activeSub` `subcourseName`
text column. Two changes: the static `trending-up` box on the right becomes a
**live 56 px animated SVG progress ring** showing overall %, and a thin inner
strip along the bottom of the same card carries three inline mini-stats —
**PTS · Rank · Streak**. If the user has analytics documents for more than one
subcourse, the card becomes pressable and opens the existing `BottomSheet` to
switch which subcourse is being viewed.

**3 · KPI tile row** — four `StatTile`s: Study Time, Day Streak, Activities,
Accuracy. Each shows an icon, a large value, a small delta against the previous
equivalent period ("+12% this week"), and a 12 px sparkline of that metric.

**4 · Score Trend — area line chart.** The headline graph. X is days across the
selected range, Y is percent 0–100. Animated SVG `Path` with a gradient fill
underneath and a 2 px stroke in `colors.primary`. The line is smoothed
(Catmull-Rom converted to cubic bezier) so 30 sparse points read as a curve
rather than a zigzag. Dragging across the chart shows a vertical guide line and a
floating pill with the exact date and percent. Seeded days render dashed. With no
data at all, it shows a flat dashed line at the current percent plus a hint,
rather than an empty box.

**5 · Activity heatmap.** GitHub-contributions style: 7 rows (Sun–Sat) by up to 26
weeks of 11 px rounded squares, five intensity buckets derived from the daily
points delta. Month labels above, weekday labels at the left in the active
language. Horizontally scrollable and auto-scrolled to today on mount. Tapping a
cell shows a pill with the date (BS and AD, since the app already works in BS)
and that day's points and minutes.

**6 · Skill radar (hexagon).** Six axes — Exam, Daily Test, Practice, QOTD,
GK/PM, Reading — plotted at each source's accuracy. SVG polygon over five
concentric guide rings, filled at ~0.25 opacity in the primary colour with a 2 px
stroke, animated scaling out from the centre on mount. Sources the user has never
touched plot at zero with a dimmed axis label, which is the genuinely actionable
part of the chart. A toggle overlays a second translucent polygon for the
subcourse average once cohort data is loaded.

**7 · Where your time goes — donut.** `secondsSpent` split across Reading,
Practice, Exams, Daily Test, GK/PM and Other. Animated arcs, total time in the
centre, and legend rows beneath carrying a colour dot, label, duration and share
of total. Tapping a legend row nudges that arc outward.

**8 · Points breakdown — stacked horizontal bars.** How the PTS total was
actually earned, computed from the same `POINTS` constants the leaderboard uses.
This is what turns the leaderboard number from a magic figure into something the
user can reason about and act on. One row per source with a bar, the points, and
the share.

**9 · Daily effort — bar chart.** Points earned per day across the range, with a
dashed average line. Weekend bars are tinted slightly differently. Tapping a bar
opens the same detail pill as the heatmap.

**10 · Accuracy by source — ranked bars.** The same six sources as the radar, but
sorted best to worst with exact percentages and a delta arrow against the
previous period. The radar communicates shape; this communicates precision. Both
earn their place.

**11 · Strengths & focus areas.** Two derived cards. Strength is the
highest-weighted source performing above the user's own average; focus is the
lowest-accuracy source with a meaningful sample, or the highest-weighted source
never touched. Each carries a CTA routing straight into that feature —
`/subjects/practice`, `/daily-test`, `/additional-features/gk`, `/exam-history`,
and so on.

**12 · Consistency card.** Current streak, best streak, active days in range,
average session length (from `sessionCount` and `foregroundSeconds`), and the
most active weekday derived from the day keys. Includes a seven-dot week strip.

**13 · You vs your subcourse.** **Loaded lazily behind a tap** — roughly 300
document reads is too much to spend on every visit for a section not everyone
cares about. `app_main_leaderboard` is readable by any signed-in user and already
filtered by `subcourseId`, so `fetchMainLeaderboard(subcourseId)` gives rank,
percentile ("Top 12%"), cohort median percent and cohort median study time with
no new collection. Rendered as a horizontal distribution strip with the user's
marker on it. Links through to `/leaderboard`. Cached for ten minutes and shared
with the leaderboard screen so visiting both does not pay twice.

**14 · Milestones.** Progress bars toward the next points tier, a 7-day streak,
90% accuracy, and 50 hours studied, each with a small trophy icon, linking to
`/achievements`.

**15 · Footer.** "Updated 2 minutes ago" with a refresh action, and a short
collapsible explainer of how % and PTS are calculated — reusing the real
`PERCENT_WEIGHTS`, so the page stays honest about its own maths.

---

## 4. Chart layer

Everything is built in-house on `react-native-svg@15.12.1`, which is **already a
dependency** — no new package. Animation uses `react-native-reanimated@4.1`
driving `useAnimatedProps` on animated SVG primitives, which is the exact pattern
`src/components/misc/ProgressRing.tsx` already uses with `AnimatedCircle`, so it
is proven in this codebase rather than novel. Touch handling uses
`react-native-gesture-handler@2.28`, also already installed.

New folder `src/components/charts/`:

| File | Purpose |
|---|---|
| `ChartCard.tsx` | Shared shell: title, subtitle, right action, themed surface, consistent radius/padding, built-in skeleton and empty states |
| `chartMath.ts` | Pure functions — scales, nice-number ticks, Catmull-Rom smoothing, arc path generation. No React, so it is directly testable |
| `LineAreaChart.tsx` | Section 4 |
| `BarChart.tsx` | Sections 9 and 10 |
| `DonutChart.tsx` | Section 7 |
| `RadarChart.tsx` | Section 6 |
| `Heatmap.tsx` | Section 5 |
| `Sparkline.tsx` | Inside the KPI tiles |
| `StatTile.tsx` | Section 3 |

Every chart takes plain arrays of numbers plus a colour, knows nothing about
analytics, and renders a defined empty state at zero and one data point. Keeping
them dumb is what makes them reusable later for the exam result screens.

---

## 5. Theming, motion, i18n

Unlike the leaderboard — which is deliberately pinned to a fixed dark palette
because a podium is a designed surface — the analytics page **follows the app
theme** through `useTheme()`. It is a page users open repeatedly in varying
light, and charts need to sit on the surface colour to stay readable. The single
exception is the hero card in section 2, which keeps the Syllabus banner's fixed
blue gradient so the two pages read as siblings.

Motion stays restrained and purposeful: charts draw in once on mount
(400–600 ms), sections stagger in with `FadeInDown` at 60 ms intervals capped at
about ten, and nothing loops. No breathing or pulsing effects here — that
belongs on a podium, not on a page someone reads numbers off.

The `analytics` i18n block grows from 7 keys to roughly 55, added to **both**
`en.json` and `ne.json` with parity enforced, matching how the `leaderboard`
block was handled.

---

## 6. Files touched

**New**

- `src/core/services/analyticsSnapshot.ts` — document shape, read/write, prune,
  backfill, streak, and all derivation helpers
- `src/components/charts/` — the nine files listed above

**Changed**

- `app/analytics.tsx` — full rewrite
- `app/(tabs)/index.tsx` — App Guide grid entry
- `src/core/services/mainLeaderboard.ts` — move the throttle here; call
  `recordAnalyticsSnapshot` after a successful publish
- `src/core/firebase/collections.ts` — add the `analytics` path
- `src/core/i18n/en.json`, `src/core/i18n/ne.json`
- `firebase.rules` — one new block
- `app/_layout.tsx` — once-per-day snapshot trigger *(pending decision #2)*
- `app/leaderboard.tsx` — drop its local throttle map in favour of the shared one

**Deleted**

- `src/core/firebase/services/analytics.ts` — superseded, and verified to have
  exactly one importer (the screen being rewritten)

---

## 7. Build order

1. **Data layer** — `analyticsSnapshot.ts`, the collections constant, the rules
   block, the throttle move, and the publish hook. No visible change yet, but
   snapshots start accumulating from this point, which means real history exists
   by the time the UI lands.
2. **Chart primitives** — `chartMath.ts` first, then `ChartCard`, then the six
   charts, each with its empty state.
3. **Screen, upper half** — sections 1 through 7.
4. **Screen, lower half** — sections 8 through 15, plus the range switcher wiring.
5. **Entry point and polish** — App Guide grid, i18n parity, verification pass.

---

## 8. Verification

Following the pattern established on the leaderboard work: a `ts.createProgram`
semantic type-check scoped to the changed files (a full `tsc` times out), an
i18n parity check in both directions, and a brace-balance plus
block-before-deny check on `firebase.rules`.

Beyond that, simulations for the things most likely to be quietly wrong:

- delta maths across missing days, including a gap at the start and end of a range
- streak counting across gaps, and across a Kathmandu midnight boundary
- backfill prefix sums reconciling to the same totals the breakdown reports
- the 180-day prune keeping the newest keys, never the oldest
- percentile and median on cohorts of size 1, 2 and 300
- donut arcs summing to exactly 360° with rounding
- every chart at zero points and at exactly one point

ESLint cannot run in this environment — the `node_modules` native binding is
built for Windows — so the semantic type-check carries that weight instead.

---

## 9. Decisions locked in

1. **App Guide** — 12 tiles: Analytics, Feedback and Contact Us all added, grid
   becomes a clean 3×4.
2. **Daily snapshot** — once per Kathmandu day on app open, so the streak and
   heatmap stay honest even for users who rarely open Analytics or Leaderboard.
3. **Cohort comparison** — lazy on tap, cached ten minutes, shared with the
   leaderboard screen.

Nothing else is outstanding. Next step is Phase 1 of the build order above.
