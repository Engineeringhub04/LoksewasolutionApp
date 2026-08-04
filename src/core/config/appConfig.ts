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
    splashAsset: require('../../../assets/images/splash-icon.png'),
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
    website: 'https://loksewasolution.com.np',
    facebook: 'https://facebook.com/loksewasolution',
    youtube: 'https://youtube.com/@loksewasolution',
    instagram: 'https://instagram.com/loksewasolution',
    discord: 'https://discord.gg/loksewasolution',
  },
  legal: {
    privacyPolicyUrl: 'https://loksewasolution.com.np/privacy',
    termsUrl: 'https://loksewasolution.com.np/terms',
    supportEmail: 'support@loksewasolution.com.np',
    contactPhone: '+977-1-4444444',
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
    iconAsset: require('../../../assets/images/icon.png'),
    sound: 'default',
  },
  localization: {
    defaultLanguage: 'en' as const,
    supportedLanguages: ['en', 'ne'] as const,
  },
};

export type AppConfigType = typeof AppConfig;
