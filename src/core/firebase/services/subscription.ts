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
// Real eSewa/Khalti merchant credentials require a registered business
// (PAN/VAT + business verification), which the app doesn't have yet — so
// `esewa.enabled` / `khalti.enabled` should stay `false` in production until
// that exists. The checkout screen is fully wired for the redirect flow
// using the OFFICIAL SANDBOX/UAT test credentials (see the checkout screen's
// TEST_KEYS constant) so the whole flow can be exercised end-to-end before
// going live — just flip `enabled: true` and swap the test keys for live
// ones in Firestore.
//
// Full docs shape:
//
// app_subscription_settings/config
//   esewa: { enabled, merchantCode, secretKey }
//   khalti: { enabled, publicKey, secretKey }
//   updatedAt
//
// app_subscription_bank_details/config
//   bankName, accountNumber, receiverName, branch, updatedAt
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
  secretKey: string;
}

export interface KhaltiKeys {
  enabled: boolean;
  publicKey: string;
  secretKey: string;
}

export interface SubscriptionSettings {
  esewa: GatewayKeys;
  khalti: KhaltiKeys;
}

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  receiverName: string;
  branch: string;
}

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
  esewa: { enabled: false, merchantCode: '', secretKey: '' },
  khalti: { enabled: false, publicKey: '', secretKey: '' },
};

export async function fetchSubscriptionSettings(): Promise<SubscriptionSettings> {
  const doc = await getDocument(SETTINGS_DOC);
  if (!doc) return DEFAULT_SETTINGS;
  return {
    esewa: { ...DEFAULT_SETTINGS.esewa, ...(doc.esewa as object) },
    khalti: { ...DEFAULT_SETTINGS.khalti, ...(doc.khalti as object) },
  };
}

/** Admin-only: toggle eSewa/Khalti on or off, or update their merchant keys. */
export async function updateSubscriptionSettings(patch: Partial<SubscriptionSettings>): Promise<void> {
  await setDocument(SETTINGS_DOC, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}

// ===================== Bank details (for the QR/Manual method) =====================

const BANK_DETAILS_DOC = `${Collections.subscriptionBankDetails}/config`;

const DEFAULT_BANK_DETAILS: BankDetails = {
  bankName: '',
  accountNumber: '',
  receiverName: '',
  branch: '',
};

export async function fetchBankDetails(): Promise<BankDetails> {
  const doc = await getDocument(BANK_DETAILS_DOC);
  if (!doc) return DEFAULT_BANK_DETAILS;
  return { ...DEFAULT_BANK_DETAILS, ...(doc as object) };
}

/** Admin-only: update bank name / account number / receiver name / branch shown on the QR page. */
export async function updateBankDetails(patch: Partial<BankDetails>): Promise<void> {
  await setDocument(BANK_DETAILS_DOC, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
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

// ===================== Seed (dev/admin utility) =====================

/**
 * Seeds ONLY the bank details document (app_subscription_bank_details/config)
 * with placeholder values the admin then edits from Firestore console. This
 * is deliberately narrow — plans, gateway settings and coupons are
 * configured by the admin directly (via Firestore console), not seeded with
 * sample data, so nothing fake ever ends up looking "real" on the checkout
 * screen.
 */
export async function seedBankDetails(): Promise<void> {
  await setDocument(BANK_DETAILS_DOC, {
    bankName: 'Sample Bank Ltd.',
    accountNumber: '0000000000000',
    receiverName: 'Loksewa Solution',
    branch: 'Kathmandu',
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
