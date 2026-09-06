// Single source of truth (PRD §5). Every environment/branding/key value lives here.
// No screen or component may hardcode these values.

export const AppConfig = {
  identity: {
    appName: 'Loksewa Solution',
    packageId: 'com.loksewasolutionnp.hub',
    version: '1.0.0',
    buildNumber: 1,
    tagline: 'Prepare Smarter, Score Higher',
    logoAsset: require('../../../assets/images/logo.png'),
    splashAsset: require('../../../assets/images/logo_nobg.png'),
  },
  api: {
    baseUrl: 'https://api.loksewasolution.com.np/v1',
    timeoutMs: 15000,
    versionHeader: 'v1',
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
      appsScriptUrl: 'https://script.google.com/macros/s/AKfycbzBvEYD5q7hbqApGLrdeKlNoJmlyNdbs4VgA7vTaqY4lrCySIaX39xXXMM-UnrCxJeo/exec',
    },
  },
  media: {
    // Cloudinary free tier is used for user-uploaded images (profile photos)
    // because Firebase Storage needs a paid plan. Unsigned preset — safe to
    // ship, contains no secret.
    cloudinary: {
      cloudName: 'dw7gg0fhc',
      uploadPreset: 'lsphotos',
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
    currentAffairsSourceId: 'loksewa-current-affairs',
    features: {
      discussion: true,
      leaderboard: true,
      liveExam: true,
      ads: false,
    },
  },
  notifications: {
    defaultTopic: 'all-users',
    iconAsset: require('../../../assets/images/logo.png'),
    sound: 'default',
  },
  localization: {
    defaultLanguage: 'en' as const,
    supportedLanguages: ['en', 'ne'] as const,
  },
};

export type AppConfigType = typeof AppConfig;
