// Single source of truth (PRD §5). Every environment/branding/key value lives here.
// No screen or component may hardcode these values.
//
// SECRETS / ENVIRONMENT KEYS
// The webhook URLs, the admin-alert shared secret and the Cloudinary account are
// read from EXPO_PUBLIC_* environment variables (see .env / .env.example) rather
// than being written in this file. This keeps them out of git — .env is
// gitignored — and lets each build (dev / preview / production) point at its own
// values without a code change. See docs/env-setup.md for the EAS commands.
//
// Reality check on what this does and does NOT buy: an EXPO_PUBLIC_* value is
// inlined into the JS bundle at build time, so it still ships inside the APK and
// can be extracted from it. That is unavoidable for any client app. The real
// protection for the admin push tokens is server-side (they live in the Apps
// Script, the app never sees them); these env vars are about git hygiene and easy
// rotation, not about hiding a string from a determined APK inspector.

// Small helper: use the env value when it is a non-empty string, else the
// placeholder. IMPORTANT: `process.env.EXPO_PUBLIC_*` must be referenced as a
// literal at each call site (never `process.env[dynamicKey]`) — Expo replaces
// these tokens by static text substitution at build time, so a dynamic lookup
// would resolve to undefined in a release build.
function envOr(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export const AppConfig = {
  identity: {
    appName: 'Loksewa Solution',
    packageId: 'com.loksewasolutionnp.hub',
    version: '1.0.0',
    buildNumber: 1,
    tagline: 'Prepare Smarter, Score Higher',
    logoAsset: require('../../../assets/images/icon.png'),
    // One master brand mark for the entire app UI: the same square icon that
    // ships on the launcher/stores (assets/images/icon.png — 1024², fully opaque,
    // deep-navy #000030 field with the amber "LS" mark). It must always be
    // rendered as a rounded SQUARE (squircle), never a circle, so it reads
    // exactly like the app icon does on the home screen. No Platform split here:
    // the per-platform launcher/store icons (logo-android-512 / logo-ios-1024)
    // are declared in app.json and are never used inside the app UI.
    splashAsset: require('../../../assets/images/icon.png'),
  },
  ads: {
    enabled: false,
    providerAppId: 'REPLACE_WITH_ADMOB_APP_ID',
    appOpenUnitId: 'REPLACE_WITH_AD_UNIT_ID',
    bannerUnitId: 'REPLACE_WITH_AD_UNIT_ID',
    interstitialUnitId: 'REPLACE_WITH_AD_UNIT_ID',
    rewardedUnitId: 'REPLACE_WITH_AD_UNIT_ID',
    nativeUnitId: 'REPLACE_WITH_AD_UNIT_ID',
  },
  branding: {
    primary: '#1D4ED8',
    secondary: '#0F766E',
    accent: '#F59E0B',
    success: '#16A34A',
    warning: '#F59E0B',
    error: '#DC2626',
    info: '#2563EB',
    gradient: ['#1D4ED8', '#1E3A8A'] as const,
    gradients: {
      primary: ['#1D4ED8', '#1E3A8A'] as const,
      premiumGold: ['#F59E0B', '#D97706'] as const,
      splash: ['#0B1746', '#132B6E', '#1D4ED8'] as const,
    },
    fontFamily: 'System',
  },
  links: {
    // Store listings — placeholders until the app is actually published.
    // Rate Us picks the right one per platform.
    playStore: 'https://play.google.com/store/apps/details?id=com.loksewasolutionnp.hub',
    appStore: 'https://apps.apple.com/app/id0000000000',
    website: 'https://kbr.com.np',
    facebook: 'https://www.facebook.com/profile.php?id=61580182268110',
    instagram: 'https://www.instagram.com/loksewasolution?igsh=dmtlc3Zza2F1Y2xr&utm_source=qr',
    youtube: 'https://www.youtube.com/loksewasolution0',
    twitter: 'https://x.com/loksewa_soln',
  },
  messaging: {
    // Contact / Feedback / Report submissions go to a Google Form, whose
    // responses land in a Google Sheet. An Apps Script bound to that sheet then
    // routes each row to the right tab AND posts a rich embed to Discord.
    //
    // Why not Firestore: a Sheet is a far better support inbox (search, filter,
    // status column, export) and keeps the Firestore quota free for real app
    // data. Why not a Discord webhook straight from the app: a webhook URL
    // shipped in the bundle can be extracted and abused to spam the channel —
    // the Apps Script keeps it server-side. The Form endpoint below is public by
    // design and holds no secret.
    // The Form endpoint below is public BY DESIGN and holds no secret, so it
    // stays inline (not in .env): the `entry.*` field ids are already visible to
    // anyone who opens the form's "Get pre-filled link", and knowing them only
    // lets you POST a new response — never read existing ones (those land in a
    // private Sheet). Moving 11 ids into env vars would add 11 chances to
    // mis-map a field and silently send reports/feedback to the wrong column,
    // with zero security gain. Treat this as the form's schema, not a secret.
    googleForm: {
      formId: '1FAIpQLSc8fAOhc793cp8aMOAKymwtGYLT504S-yjBNixCSE8dgokGQQ',
      // Field ids taken from the form's "Get pre-filled link".
      entries: {
        type: 'entry.592505579',
        name: 'entry.1756370732',
        email: 'entry.2059602454',
        message: 'entry.633453203',
        rating: 'entry.2878998',
        questionReference: 'entry.168055861',
        issueCategory: 'entry.1740941696',
        appVersion: 'entry.1821448113',
        platform: 'entry.458970457',
        userId: 'entry.2072267690',
      },
    },
    // Theory Answer Upload notifications go straight to a small Apps Script web
    // app (deployed from script.google.com, "Anyone" access) which relays a
    // Discord embed. Kept as its own endpoint rather than reusing the Google
    // Form above because a submission carries structured data (student, exam,
    // PDF link) that doesn't fit the Form's fixed field set. Replace the URL
    // below with your deployed Apps Script /exec URL — see the deployment
    // guide provided alongside this change.
    examAnswerWebhook: {
      appsScriptUrl: envOr(
        process.env.EXPO_PUBLIC_EXAM_ANSWER_WEBHOOK_URL,
        'REPLACE_WITH_EXAM_ANSWER_WEBHOOK_URL',
      ),
    },
    // Admin alerts: when ANY user files a report, every admin device gets a tray
    // push. This needs its own relay because of a hard rules constraint — only an
    // admin may read another user's push tokens, so a normal user's phone can
    // never see the admin tokens it would have to send to. The tokens therefore
    // live inside the Apps Script (Script Properties), where the app cannot read
    // them, and the app only ever asks the script to "alert the admins".
    //
    // A SEPARATE Apps Script project from examAnswerWebhook and from the Google
    // Form -> Discord relay, both of which stay untouched.
    // Setup guide + code: docs/apps-script-admin-alerts.gs
    adminAlertWebhook: {
      appsScriptUrl: envOr(
        process.env.EXPO_PUBLIC_ADMIN_ALERT_WEBHOOK_URL,
        'REPLACE_WITH_ADMIN_ALERT_WEBHOOK_URL',
      ),
      // Must match the SHARED_SECRET script property in that project. This still
      // ships in the bundle, so treat it as a spam gate rather than a real
      // secret: the relay only ever sends the one fixed report alert and never
      // hands a push token back to the caller, so extracting this cannot leak
      // admin tokens. Kept in .env purely so it can be rotated without a code
      // change and stays out of git.
      sharedSecret: envOr(
        process.env.EXPO_PUBLIC_ADMIN_ALERT_SHARED_SECRET,
        'REPLACE_WITH_ADMIN_ALERT_SHARED_SECRET',
      ),
    },
  },
  media: {
    // Cloudinary free tier is used for user-uploaded images (profile photos)
    // because Firebase Storage needs a paid plan. cloudName + uploadPreset come
    // from .env; the unsigned preset is safe to ship (it contains no secret —
    // the real guardrails are set on the preset itself in the Cloudinary
    // dashboard: allowed folder, max size, formats, moderation). `folder` is a
    // plain organisational path, so it stays inline.
    cloudinary: {
      cloudName: envOr(process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME, 'REPLACE_WITH_CLOUDINARY_CLOUD_NAME'),
      uploadPreset: envOr(process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET, 'REPLACE_WITH_CLOUDINARY_UPLOAD_PRESET'),
      folder: 'profile-photos',
    },
  },
  legal: {
    privacyPolicyUrl: 'https://www.kbr.com.np/privacy',
    termsUrl: 'https://www.kbr.com.np/terms',
    supportEmail: 'contact@kbr.com.np',
    contactPhone: '+977-9810768297',
  },
  behavior: {
    maintenanceMode: false,
    maintenanceMessage: 'We are performing scheduled maintenance. Please check back soon.',
    forceUpdate: false,
    minimumVersion: '1.0.0',
    latestVersion: '1.0.0',
    defaultExamTimerMinutes: 60,
    features: {
      discussion: true,
      leaderboard: true,
      liveExam: true,
      ads: false,
    },
  },
  notifications: {
    defaultTopic: 'all-users',
    iconAsset: require('../../../assets/images/icon.png'),
    sound: 'default',
  },
  localization: {
    defaultLanguage: 'en' as const,
    supportedLanguages: ['en', 'ne'] as const,
  },
};

export type AppConfigType = typeof AppConfig;
