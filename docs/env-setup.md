# Environment variables & EAS setup

Every secret-ish or environment-specific value the app needs is read from an
`EXPO_PUBLIC_*` variable, resolved in `src/core/config/appConfig.ts` (and the
Firebase ones in `src/core/firebase/env.ts`). Real values live in `.env`, which
is **gitignored**. `.env.example` is the committed template — copy it and fill
it in.

```bash
cp .env.example .env      # then edit .env with the real values
```

## What matters about EXPO_PUBLIC_ vars (read this first)

- The `EXPO_PUBLIC_` prefix is required. Without it the value is **not** exposed
  to the app and `process.env.X` is `undefined` at runtime.
- The value is **inlined into the JS bundle at build time**. It therefore ships
  inside the APK/IPA and can be extracted from the bundle. This is true of every
  client app and every framework — env vars here are for git hygiene and easy
  rotation, **not** for hiding a string from someone who unzips the APK. Real
  secrets (e.g. admin push tokens) stay server-side, in the Apps Script.
- Reference each var as a literal — `process.env.EXPO_PUBLIC_FOO`. A dynamic
  lookup like `process.env[key]` breaks in release builds because Expo does a
  static text substitution, not a runtime object read.
- `.env` is read automatically by `expo start` (Expo Go and dev builds). It is
  **not** uploaded to EAS Build (it's gitignored), so EAS needs its own copy of
  the variables — see below.

## The variables

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase web config |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase web config |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Firebase web config |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase web config |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase web config |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Firebase web config |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google Sign-In (Expo Go proxy + web) |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Google Sign-In (native, optional) |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google Sign-In (native, optional) |
| `EXPO_PUBLIC_EXAM_ANSWER_WEBHOOK_URL` | Theory-answer → Discord Apps Script `/exec` |
| `EXPO_PUBLIC_ADMIN_ALERT_WEBHOOK_URL` | Admin-alert relay `/exec` (separate project) |
| `EXPO_PUBLIC_ADMIN_ALERT_SHARED_SECRET` | Must match that relay's `SHARED_SECRET` |
| `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary account for image/PDF uploads |
| `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Cloudinary **unsigned** upload preset |

Values that are intentionally **not** env vars: the Google Form id + `entry.*`
field ids (public by design — see the comment in `appConfig.ts`), and
`cloudinary.folder` (a plain path).

## Push all local vars to EAS in one shot

The fastest path — read the whole `.env` and push it to an EAS environment:

```bash
eas env:push --environment production
eas env:push --environment preview
eas env:push --environment development
```

`eas env:push` reads a local dotenv file (defaults to `.env`) and uploads every
variable to the chosen environment. Run it once per environment.

## Or create / manage individual vars

```bash
# Create one variable in multiple environments at once
eas env:create --name EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME --value dw7gg0fhc \
  --environment production --environment preview --visibility plaintext

# List what's set (values shown for plaintext, hidden for sensitive)
eas env:list --environment production

# Pull an environment back down into a local .env.local (handy to verify)
eas env:pull --environment production
```

### Visibility

`--visibility plaintext` | `sensitive` | `secret`. For anything prefixed
`EXPO_PUBLIC_`, use **plaintext** (or sensitive). Picking `secret` gives no real
protection here — the value is still inlined into the bundle — and it only makes
your own life harder because you can't read it back from the dashboard.

You can also do all of this in the web UI: **expo.dev → your project → Settings →
Environment variables**.

## Gotchas that cost the most time

1. **Missing `EXPO_PUBLIC_` prefix** → `undefined` at runtime.
2. **Dynamic `process.env[key]` access** → works in Expo Go, breaks in release.
   Always write the literal `process.env.EXPO_PUBLIC_FOO`.
3. **Stale cache after editing `.env`** → restart with `npx expo start -c`.
4. **Added a var in EAS but the old build doesn't see it** → env vars are baked
   in at build time; you need a **new build** (`eas build`), not an OTA update.
5. **`eas.json` has an `env` block and it is committed to git** → only put
   non-secret values there. Anything real belongs in EAS env or `.env`.

## Verify it's wired

```bash
# No real secret should be hardcoded in the source anymore:
grep -rn --include=*.ts --include=*.tsx -E "dw7gg0fhc|lsphotos|AKfycb" app src
# (expect no matches)

# Every EXPO_PUBLIC_ var used in code should exist in .env.example:
grep -roh --include=*.ts "process.env.EXPO_PUBLIC_[A-Z_]*" app src | sort -u
```
