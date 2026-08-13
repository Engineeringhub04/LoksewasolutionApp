// Subscription service — plans, gateway settings, per-user subscription
// requests (manual + auto), and coupon codes.
//
// Real eSewa/Khalti merchant credentials require a registered business
// (PAN/VAT + business verification), which the app doesn't have yet. Until
// then BOTH flows exist side-by-side and the admin controls which one is
// live via `subscriptionSettings.activeMode` ('auto' | 'manual'). Switching
// this one field is the only thing needed to go live later — no code change.
//
// Full docs shape:
//
// app_subscription_settings/config
//   activeMode: 'auto' | 'manual'
//   esewa: { enabled, merchantCode, secretKey }
//   khalti: { enabled, publicKey, secretKey }
//   manual: { qrImageUrl, bankDetails, instructions }
//   updatedAt
//
// app_subscription_plans/{planId}
//   id, name, billingCycle: 'monthly' | 'yearly' | 'free', price, currency,
//   durationDays, features: string[], isActive, order
//
// app_subscriptions/{id}
//   uid, planId, planName, billingCycle, amount, currency,
//   method: 'esewa' | 'khalti' | 'fonepay' | 'manual',
//   status: 'pending' | 'active' | 'rejected' | 'expired',
//   transactionRef, screenshotUrl, submittedAt, reviewedAt, reviewedBy,
//   rejectionReason, startDate, expiryDate, couponCode, createdAt, updatedAt
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
export type PaymentMethod = 'esewa' | 'khalti' | 'fonepay' | 'manual';
export type SubscriptionStatus = 'pending' | 'active' | 'rejected' | 'expired';
export type GatewayMode = 'auto' | 'manual';

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
  /** True when this row came from recordAutoPaymentSuccess() (gateway SDK reported success client-side, not yet admin-verified). */
  autoReported: boolean;
  transactionRef: string | null;
  screenshotUrl: string | null;
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

// ===================== Settings =====================

const SETTINGS_DOC = `${Collections.subscriptionSettings}/config`;

const DEFAULT_SETTINGS: SubscriptionSettings = {
  activeMode: 'manual',
  esewa: { enabled: false, merchantCode: '', secretKey: '' },
  khalti: { enabled: false, publicKey: '', secretKey: '' },
  manual: { qrImageUrl: '', bankDetails: '', instructions: '' },
};

export async function fetchSubscriptionSettings(): Promise<SubscriptionSettings> {
  const doc = await getDocument(SETTINGS_DOC);
  if (!doc) return DEFAULT_SETTINGS;
  return {
    activeMode: (doc.activeMode as GatewayMode) ?? 'manual',
    esewa: { ...DEFAULT_SETTINGS.esewa, ...(doc.esewa as object) },
    khalti: { ...DEFAULT_SETTINGS.khalti, ...(doc.khalti as object) },
    manual: { ...DEFAULT_SETTINGS.manual, ...(doc.manual as object) },
  };
}

/** Admin-only: update gateway settings (mode toggle, merchant keys, QR/bank info). */
export async function updateSubscriptionSettings(patch: Partial<SubscriptionSettings>): Promise<void> {
  await setDocument(SETTINGS_DOC, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}

// ===================== Plans =====================

export async function fetchSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const docs = await listDocuments(Collections.subscriptionPlans);
  return (docs as unknown as SubscriptionPlan[])
    .filter((p) => p.isActive !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

// ===================== User's own subscription =====================

/** Fetches the current user's most relevant subscription record (active, else latest pending/rejected). */
export async function fetchMySubscription(uid: string): Promise<SubscriptionRecord | null> {
  const docs = await runQuery(Collections.subscriptions, {
    where: [{ field: 'uid', op: '==', value: uid }],
  });
  const records = docs as unknown as SubscriptionRecord[];
  if (records.length === 0) return null;

  // Prefer an active one; otherwise the most recently submitted.
  const active = records.find((r) => r.status === 'active');
  if (active) return active;

  return records.sort((a, b) => {
    const at = typeof a.submittedAt === 'string' ? a.submittedAt : '';
    const bt = typeof b.submittedAt === 'string' ? b.submittedAt : '';
    return bt.localeCompare(at);
  })[0];
}

export interface SubmitManualPaymentInput {
  uid: string;
  userName: string | null;
  userEmail: string | null;
  planId: string;
  planName: string;
  billingCycle: BillingCycle;
  amount: number;
  method: PaymentMethod; // esewa | khalti | fonepay
  transactionRef: string;
  screenshotUrl: string | null;
  couponCode: string | null;
}

/** Submits a manual payment request — lands as `status: 'pending'` for admin review. */
export async function submitManualPayment(input: SubmitManualPaymentInput): Promise<string> {
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

export interface AutoPaymentResultInput {
  uid: string;
  userName: string | null;
  userEmail: string | null;
  planId: string;
  planName: string;
  billingCycle: BillingCycle;
  amount: number;
  method: 'esewa' | 'khalti';
  transactionRef: string;
  couponCode: string | null;
}

/**
 * Records an AUTO gateway payment attempt that the provider's SDK reported
 * as successful on-device.
 *
 * IMPORTANT — this deliberately does NOT self-activate the subscription.
 * A client-side "the SDK said success" claim is not proof of payment (it can
 * be forged/replayed), so this writes the same `status: 'pending'` shape as
 * a manual submission — just tagged `autoReported: true` so the admin desk
 * can show "Auto-reported, verify in provider dashboard" instead of asking
 * for a QR/reference. Real auto-activation requires a server-side step
 * (a Cloud Function verifying eSewa/Khalti's signed callback) that doesn't
 * exist yet — see the firebase.rules comment on app_subscriptions for the
 * exact rule that would need to change alongside it. Until that exists, an
 * admin still taps Approve, which is what keeps this un-hackable: no write
 * path in firebase.rules lets a client set status to 'active' directly.
 */
export async function recordAutoPaymentSuccess(input: AutoPaymentResultInput): Promise<string> {
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
    autoReported: true,
    transactionRef: input.transactionRef,
    screenshotUrl: null,
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

export async function fetchPendingSubscriptions(): Promise<SubscriptionRecord[]> {
  const docs = await runQuery(Collections.subscriptions, {
    where: [{ field: 'status', op: '==', value: 'pending' }],
  });
  return docs as unknown as SubscriptionRecord[];
}

export async function fetchSubscriptionById(id: string): Promise<SubscriptionRecord | null> {
  const doc = await getDocument(`${Collections.subscriptions}/${id}`);
  if (!doc) return null;
  return doc as unknown as SubscriptionRecord;
}

/**
 * Admin-only approve. Sets status: 'active', computes the expiry window from
 * the plan's durationDays, and mirrors isPremium + premiumExpiryDate onto the
 * user document so the rest of the app can gate features with one field read.
 */
export async function approveSubscription(id: string, reviewerUid: string, durationDays: number): Promise<void> {
  const record = await fetchSubscriptionById(id);
  if (!record) throw new Error('SUBSCRIPTION_NOT_FOUND');

  const startDate = new Date();
  const expiryDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

  await commitWrites([
    setWrite(`${Collections.subscriptions}/${id}`, {
      status: 'active',
      reviewedAt: new Date().toISOString(),
      reviewedBy: reviewerUid,
      rejectionReason: null,
      startDate: startDate.toISOString(),
      expiryDate: expiryDate.toISOString(),
      updatedAt: serverTimestamp(),
    }, { merge: true }),
    setWrite(`${Collections.users}/${record.uid}`, {
      isPremium: true,
      premiumExpiryDate: expiryDate.toISOString(),
      updatedAt: serverTimestamp(),
    }, { merge: true }),
  ]);
}

/**
 * Admin-only reject. Tags the record `rejected` with a reason; the user's
 * card then shows a "View Details" button for 1 day (enforced client-side by
 * checking `reviewedAt` against now — see subscription/index.tsx).
 */
export async function rejectSubscription(id: string, reviewerUid: string, reason: string): Promise<void> {
  await updateDocument(`${Collections.subscriptions}/${id}`, {
    status: 'rejected',
    reviewedAt: new Date().toISOString(),
    reviewedBy: reviewerUid,
    rejectionReason: reason,
    updatedAt: serverTimestamp(),
  });
}

/** True if a rejected record's 1-day "why it failed" visibility window is still open. */
export function isRejectionStillVisible(reviewedAt: string | null): boolean {
  if (!reviewedAt) return false;
  const reviewedTime = new Date(reviewedAt).getTime();
  if (Number.isNaN(reviewedTime)) return false;
  return Date.now() - reviewedTime < 24 * 60 * 60 * 1000;
}

/**
 * Sweeps expired active subscriptions back to 'expired' + clears isPremium.
 * Called opportunistically from the Subscription page's load (cheap: one
 * query scoped to the current user, not a global cron — there's no server
 * runtime in this stack to run a real cron on).
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

  return { valid: true, discountedAmount };
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
 * Seeds sample plans, default gateway settings (manual mode, all keys
 * blank/placeholder), and one sample coupon — so every field in the
 * collections exists and the Subscription page has real data to render
 * without hand-typing it into Firestore. Safe to call once; re-running just
 * overwrites the same doc ids. Remove the in-app button once seeded (see
 * subscription/index.tsx comment) — same pattern as seedCourseData().
 */
export async function seedSubscriptionData(): Promise<void> {
  const writes = [
    setWrite(`${Collections.subscriptionPlans}/plan-free`, {
      id: 'plan-free',
      name: 'Free',
      billingCycle: 'free',
      price: 0,
      currency: 'NPR',
      durationDays: 0,
      features: ['Limited mock tests', 'Basic study materials', 'Ads supported'],
      isActive: true,
      order: 1,
    }),
    setWrite(`${Collections.subscriptionPlans}/plan-monthly`, {
      id: 'plan-monthly',
      name: 'Premium Monthly',
      billingCycle: 'monthly',
      price: 299,
      currency: 'NPR',
      durationDays: 30,
      features: ['Unlimited mock tests', 'All study materials', 'Ad-free experience', 'Priority support', 'Downloadable PDFs'],
      isActive: true,
      order: 2,
    }),
    setWrite(`${Collections.subscriptionPlans}/plan-yearly`, {
      id: 'plan-yearly',
      name: 'Premium Yearly',
      billingCycle: 'yearly',
      price: 2499,
      currency: 'NPR',
      durationDays: 365,
      features: ['Everything in Monthly', '2 months free', 'Early access to new features', 'Exclusive live exams'],
      isActive: true,
      order: 3,
    }),
    setWrite(SETTINGS_DOC, {
      activeMode: 'manual',
      esewa: { enabled: false, merchantCode: 'EPAYTEST', secretKey: '' },
      khalti: { enabled: false, publicKey: '', secretKey: '' },
      manual: {
        qrImageUrl: 'https://via.placeholder.com/400x400.png?text=Scan+QR+to+Pay',
        bankDetails: 'Bank: Sample Bank Ltd.\nAccount Name: Loksewa Solution\nAccount No: 0000000000000\nBranch: Kathmandu',
        instructions:
          'Scan the QR code or transfer to the bank account above. After payment, enter the transaction reference / remarks and submit. Your subscription will show as Pending until an admin approves it — this usually takes a few hours.',
      },
      updatedAt: serverTimestamp(),
    }),
    setWrite(`${Collections.couponCodes}/WELCOME10`, {
      code: 'WELCOME10',
      discountType: 'percent',
      discountValue: 10,
      maxUses: 100,
      usedCount: 0,
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      appliesToBillingCycle: 'all',
    }),
  ];

  await commitWrites(writes);
}
