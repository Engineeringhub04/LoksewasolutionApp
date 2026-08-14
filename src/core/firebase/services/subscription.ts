// Subscription service — plans, gateway settings, per-user subscription
// requests, and coupon codes.
//
// Gateway model: the QR/Manual method is ALWAYS available (it never has an
// on/off switch — it's the fallback that always works). eSewa and Khalti are
// each independently gated by their own `enabled` flag in
// app_subscription_settings/config. When `enabled` is false the checkout
// screen shows that method as a dimmed "Coming Soon" card; when true it's a
// live, tappable card that opens the gateway. There is no single global
// "auto vs manual" switch anymore — each method decides for itself.
//
// Real eSewa/Khalti merchant credentials require provider onboarding and a
// secure backend. The existing config document therefore contains only the
// independent enabled flags and public identifiers. Keep the flags false until
// the corresponding provider backend and verification flow are ready. The
// manual QR method remains the fully operational zero-budget fallback.
//
// Full docs shape:
//
// app_subscription_settings/config
//   activeMode: 'manual'
//   esewa: { enabled, merchantCode }
//   khalti: { enabled, publicKey }
//   manual: { qrImageUrl, bankDetails, instructions }
//   updatedAt
//
// Provider secret keys are intentionally not part of the client-readable
// config document. Production keys belong in a secure backend/secret manager.
//
// app_subscription_plans/{planId}
//   id, name, billingCycle: 'monthly' | 'yearly' | 'free', price, currency,
//   durationDays, features: string[], isActive, order, colorFrom, colorTo
//
// app_subscriptions/{id}
//   uid, planId, planName, billingCycle, amount, currency,
//   method: 'esewa' | 'khalti' | 'qr',
//   status: 'pending' | 'active' | 'rejected' | 'expired',
//   transactionRef, screenshotUrl, customerMessage, adminMessage,
//   submittedAt, reviewedAt, reviewedBy, rejectionReason, startDate,
//   expiryDate, couponCode, createdAt, updatedAt
//
// app_coupon_codes/{code}
//   code, discountType: 'percent' | 'flat', discountValue, maxUses, usedCount,
//   validFrom, validUntil, isActive, appliesToBillingCycle: 'monthly'|'yearly'|'all'
import {
  getDocument,
  setDocument,
  updateDocument,
  listDocuments,
  runQuery,
  commitWrites,
  setWrite,
  serverTimestamp,
  increment,
} from '@/src/core/firebase/firestoreRest';
import { Collections } from '@/src/core/firebase/collections';

// ===================== Types =====================

export type BillingCycle = 'monthly' | 'yearly' | 'free';
export type PaymentMethod = 'esewa' | 'khalti' | 'qr';
export type SubscriptionStatus = 'pending' | 'active' | 'rejected' | 'expired';

export interface SubscriptionPlan {
  id: string;
  name: string;
  billingCycle: BillingCycle;
  price: number;
  currency: string;
  durationDays: number;
  features: string[];
  isActive: boolean;
  order: number;
  /** Gradient start/end for this plan's card — each plan gets its own colour identity. */
  colorFrom: string;
  colorTo: string;
}

export interface GatewayKeys {
  enabled: boolean;
  merchantCode: string;
}

export interface KhaltiKeys {
  enabled: boolean;
  publicKey: string;
}

export type GatewayMode = 'auto' | 'manual';

export interface ManualPaymentConfig {
  qrImageUrl: string;
  bankDetails: string;
  instructions: string;
}

export interface SubscriptionSettings {
  activeMode: GatewayMode;
  esewa: GatewayKeys;
  khalti: KhaltiKeys;
  manual: ManualPaymentConfig;
  /** True only when app_subscription_settings/config was read successfully. */
  sourceAvailable: boolean;
}

export type BankDetails = ManualPaymentConfig;

export interface SubscriptionRecord {
  id: string;
  uid: string;
  planId: string;
  planName: string;
  billingCycle: BillingCycle;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: SubscriptionStatus;
  transactionRef: string | null;
  screenshotUrl: string;
  /** Optional note the user attaches when submitting (e.g. "paid from my brother's account"). */
  customerMessage: string | null;
  /** Optional note the admin attaches when approving/rejecting — shown back to the user. */
  adminMessage: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  startDate: string | null;
  expiryDate: string | null;
  couponCode: string | null;
  userName: string | null;
  userEmail: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface CouponCode {
  code: string;
  discountType: 'percent' | 'flat';
  discountValue: number;
  maxUses: number;
  usedCount: number;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
  appliesToBillingCycle: BillingCycle | 'all';
}

// ===================== Settings (eSewa / Khalti enable flags) =====================

const SETTINGS_DOC = `${Collections.subscriptionSettings}/config`;

const DEFAULT_SETTINGS: SubscriptionSettings = {
  activeMode: 'manual',
  esewa: { enabled: false, merchantCode: '' },
  khalti: { enabled: false, publicKey: '' },
  manual: { qrImageUrl: '', bankDetails: '', instructions: '' },
  sourceAvailable: false,
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asBoolean(value: unknown): boolean {
  // Firestore stores these as booleans. Accepting the legacy string form too
  // keeps the toggle usable if an older admin form saved "true"/"false".
  return value === true || value === 'true';
}

/**
 * Converts only client-safe fields. Secret keys are deliberately discarded even
 * if an old config document still contains them.
 */
function normalizeSettings(...documents: (Record<string, unknown> | null)[]): SubscriptionSettings {
  const merged = documents.reduce<Record<string, unknown>>((result, document) => ({ ...result, ...(document ?? {}) }), {});
  const esewa = documents.reduce<Record<string, unknown>>((result, document) => ({ ...result, ...asRecord(document?.esewa) }), {});
  const khalti = documents.reduce<Record<string, unknown>>((result, document) => ({ ...result, ...asRecord(document?.khalti) }), {});
  const manual = documents.reduce<Record<string, unknown>>((result, document) => ({ ...result, ...asRecord(document?.manual) }), {});

  return {
    activeMode: merged.activeMode === 'auto' ? 'auto' : 'manual',
    esewa: {
      enabled: asBoolean(esewa.enabled),
      merchantCode: asString(esewa.merchantCode),
    },
    khalti: {
      enabled: asBoolean(khalti.enabled),
      publicKey: asString(khalti.publicKey),
    },
    manual: {
      qrImageUrl: asString(manual.qrImageUrl ?? merged.qrImageUrl ?? manual.qrUrl),
      bankDetails: asString(manual.bankDetails ?? merged.bankDetails),
      instructions: asString(manual.instructions ?? merged.instructions),
    },
    sourceAvailable: true,
  };
}

export async function fetchSubscriptionSettings(): Promise<SubscriptionSettings> {
  try {
    const doc = await getDocument(SETTINGS_DOC);
    return doc ? normalizeSettings(doc) : { ...DEFAULT_SETTINGS, sourceAvailable: true };
  } catch (error) {
    // Keep the screen resilient for normal users, but do not hide the root cause
    // during development. In particular, a config containing secretKey fields
    // is intentionally denied by Firestore rules until it is cleaned.
    if (__DEV__) {
      console.warn('[SubscriptionSettings] Failed to read app_subscription_settings/config', error);
    }
    return DEFAULT_SETTINGS;
  }
}

/** Admin-only: update flags and manual details in the existing config document. */
export async function updateSubscriptionSettings(patch: Partial<SubscriptionSettings>): Promise<void> {
  await setDocument(SETTINGS_DOC, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}

// ===================== Manual payment details =====================
// QR URL, bank details, and instructions are read from config.manual.

/** Admin-only helper; writes manual payment details to config.manual. */
export async function updateBankDetails(patch: Partial<BankDetails>): Promise<void> {
  const settings = await fetchSubscriptionSettings();
  await updateSubscriptionSettings({
    manual: { ...settings.manual, ...patch },
  });
}

// ===================== Plans =====================

export async function fetchSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const docs = await listDocuments(Collections.subscriptionPlans);
  return (docs as unknown as SubscriptionPlan[])
    .filter((p) => p.isActive !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

// ===================== User's own subscription =====================

/** Fetches the current user's most relevant subscription record (active, else latest by submission). */
export async function fetchMySubscription(uid: string): Promise<SubscriptionRecord | null> {
  const docs = await runQuery(Collections.subscriptions, {
    where: [{ field: 'uid', op: '==', value: uid }],
  });
  const records = docs as unknown as SubscriptionRecord[];
  if (records.length === 0) return null;

  const active = records.find((r) => r.status === 'active');
  if (active) return active;

  return records.sort((a, b) => {
    const at = typeof a.submittedAt === 'string' ? a.submittedAt : '';
    const bt = typeof b.submittedAt === 'string' ? b.submittedAt : '';
    return bt.localeCompare(at);
  })[0];
}

/** All of the current user's subscription requests, newest first — used to show full history with status tags. */
export async function fetchMySubscriptionHistory(uid: string): Promise<SubscriptionRecord[]> {
  const docs = await runQuery(Collections.subscriptions, {
    where: [{ field: 'uid', op: '==', value: uid }],
  });
  const records = docs as unknown as SubscriptionRecord[];
  return records.sort((a, b) => {
    const at = typeof a.submittedAt === 'string' ? a.submittedAt : '';
    const bt = typeof b.submittedAt === 'string' ? b.submittedAt : '';
    return bt.localeCompare(at);
  });
}

export interface SubmitPaymentInput {
  uid: string;
  userName: string | null;
  userEmail: string | null;
  planId: string;
  planName: string;
  billingCycle: BillingCycle;
  amount: number;
  method: PaymentMethod;
  transactionRef: string;
  /** Required — a receipt/screenshot URL is mandatory for every submission, gateway or manual. */
  screenshotUrl: string;
  customerMessage: string | null;
  couponCode: string | null;
}

/** Submits a payment (gateway or QR/manual) — always lands as `status: 'pending'` for admin review. */
export async function submitPayment(input: SubmitPaymentInput): Promise<string> {
  const id = `${input.uid}_${Date.now()}`;
  await setDocument(`${Collections.subscriptions}/${id}`, {
    uid: input.uid,
    userName: input.userName,
    userEmail: input.userEmail,
    planId: input.planId,
    planName: input.planName,
    billingCycle: input.billingCycle,
    amount: input.amount,
    currency: 'NPR',
    method: input.method,
    status: 'pending',
    transactionRef: input.transactionRef,
    screenshotUrl: input.screenshotUrl,
    customerMessage: input.customerMessage,
    adminMessage: null,
    couponCode: input.couponCode,
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    startDate: null,
    expiryDate: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (input.couponCode) {
    await incrementCouponUsage(input.couponCode);
  }
  return id;
}

// ===================== Admin review =====================

/** All requests, newest first — the admin desk shows every request with a status tag, never removing a card after review. */
export async function fetchAllSubscriptions(): Promise<SubscriptionRecord[]> {
  const docs = await listDocuments(Collections.subscriptions);
  const records = docs as unknown as SubscriptionRecord[];
  return records.sort((a, b) => {
    const at = typeof a.submittedAt === 'string' ? a.submittedAt : '';
    const bt = typeof b.submittedAt === 'string' ? b.submittedAt : '';
    return bt.localeCompare(at);
  });
}

export async function fetchSubscriptionById(id: string): Promise<SubscriptionRecord | null> {
  const doc = await getDocument(`${Collections.subscriptions}/${id}`);
  if (!doc) return null;
  return doc as unknown as SubscriptionRecord;
}

/**
 * Lets the signed-in owner correct their own payment reference, receipt URL,
 * or customer note. Firestore rules enforce ownership and reject every other
 * field, including status and adminMessage.
 */
export async function updateMySubscriptionDetails(
  id: string,
  input: { transactionRef: string; screenshotUrl: string; customerMessage: string | null },
): Promise<void> {
  await updateDocument(`${Collections.subscriptions}/${id}`, {
    transactionRef: input.transactionRef,
    screenshotUrl: input.screenshotUrl,
    customerMessage: input.customerMessage,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Admin-only approve. Sets status: 'active', computes the expiry window from
 * the plan's durationDays, and mirrors isPremium + premiumPlanName +
 * premiumExpiryDate onto the user document so the rest of the app (profile
 * badge, gating) can read one document instead of querying subscriptions.
 * The request document itself is NEVER deleted — only its status/tag
 * changes, so it always stays visible in the admin list.
 */
export async function approveSubscription(id: string, reviewerUid: string, durationDays: number, adminMessage: string | null): Promise<void> {
  const record = await fetchSubscriptionById(id);
  if (!record) throw new Error('SUBSCRIPTION_NOT_FOUND');

  const startDate = new Date();
  const expiryDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

  await commitWrites([
    setWrite(`${Collections.subscriptions}/${id}`, {
      status: 'active',
      reviewedAt: new Date().toISOString(),
      reviewedBy: reviewerUid,
      adminMessage,
      rejectionReason: null,
      startDate: startDate.toISOString(),
      expiryDate: expiryDate.toISOString(),
      updatedAt: serverTimestamp(),
    }, { merge: true }),
    setWrite(`${Collections.users}/${record.uid}`, {
      isPremium: true,
      premiumPlanName: record.planName,
      premiumBillingCycle: record.billingCycle,
      premiumExpiryDate: expiryDate.toISOString(),
      updatedAt: serverTimestamp(),
    }, { merge: true }),
  ]);
}

/** Admin-only reject. Tags the record `rejected` with a reason — the card stays in the list, it just changes tag/colour. */
export async function rejectSubscription(id: string, reviewerUid: string, reason: string, adminMessage: string | null): Promise<void> {
  await updateDocument(`${Collections.subscriptions}/${id}`, {
    status: 'rejected',
    reviewedAt: new Date().toISOString(),
    reviewedBy: reviewerUid,
    rejectionReason: reason,
    adminMessage,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Sweeps an expired active subscription back to 'expired' + clears the
 * user's premium flags. Called opportunistically from the Subscription
 * page's load (cheap: one query scoped to the current user, not a global
 * cron — there's no server runtime in this stack to run a real cron on).
 */
export async function expireIfPastDue(uid: string): Promise<void> {
  const record = await fetchMySubscription(uid);
  if (!record || record.status !== 'active' || !record.expiryDate) return;
  if (new Date(record.expiryDate).getTime() > Date.now()) return;

  await commitWrites([
    setWrite(`${Collections.subscriptions}/${record.id}`, { status: 'expired', updatedAt: serverTimestamp() }, { merge: true }),
    setWrite(`${Collections.users}/${uid}`, { isPremium: false, updatedAt: serverTimestamp() }, { merge: true }),
  ]);
}

// ===================== Coupon codes =====================

export async function fetchCouponCode(code: string): Promise<CouponCode | null> {
  const doc = await getDocument(`${Collections.couponCodes}/${code.toUpperCase()}`);
  if (!doc) return null;
  return doc as unknown as CouponCode;
}

export interface CouponValidationResult {
  valid: boolean;
  reason?: string;
  discountedAmount?: number;
  discountLabel?: string;
}

/** Validates a coupon against a plan's billing cycle + current usage/date window. */
export async function validateCoupon(code: string, billingCycle: BillingCycle, originalAmount: number): Promise<CouponValidationResult> {
  const coupon = await fetchCouponCode(code);
  if (!coupon) return { valid: false, reason: 'Coupon code not found' };
  if (!coupon.isActive) return { valid: false, reason: 'This coupon is no longer active' };
  if (coupon.appliesToBillingCycle !== 'all' && coupon.appliesToBillingCycle !== billingCycle) {
    return { valid: false, reason: 'This coupon does not apply to the selected plan' };
  }
  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, reason: 'This coupon has reached its usage limit' };
  }
  const now = Date.now();
  if (coupon.validFrom && now < new Date(coupon.validFrom).getTime()) {
    return { valid: false, reason: 'This coupon is not active yet' };
  }
  if (coupon.validUntil && now > new Date(coupon.validUntil).getTime()) {
    return { valid: false, reason: 'This coupon has expired' };
  }

  const discountedAmount =
    coupon.discountType === 'percent'
      ? Math.max(0, Math.round(originalAmount * (1 - coupon.discountValue / 100)))
      : Math.max(0, originalAmount - coupon.discountValue);

  const discountLabel = coupon.discountType === 'percent' ? `${coupon.discountValue}% off` : `Rs. ${coupon.discountValue} off`;

  return { valid: true, discountedAmount, discountLabel };
}

async function incrementCouponUsage(code: string): Promise<void> {
  try {
    await updateDocument(`${Collections.couponCodes}/${code.toUpperCase()}`, { usedCount: increment(1) });
  } catch {
    // Coupon may not exist / no-code path — nothing to increment.
  }
}
