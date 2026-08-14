// Opens the eSewa or Khalti hosted checkout page for a subscription payment.
//
// Both gateways are wired to their OFFICIAL SANDBOX/UAT endpoints using the
// publicly documented test credentials (safe to ship — they only work
// against each provider's sandbox and cannot move real money). This lets the
// whole "Subscribe → pay → return → pending → admin approves → active" flow
// be exercised end-to-end before either card's `enabled` flag is switched on
// for real customers.
//
// GOING LIVE LATER — two things must change together, not separately:
//  1. In Firestore (app_subscription_settings/config) set esewa.enabled /
//     khalti.enabled to true and replace merchantCode/publicKey/secretKey
//     with the real values from each provider's merchant dashboard.
//  2. Move the eSewa HMAC-SHA256 signing step (see hmacSha256.ts) to a small
//     server endpoint. eSewa's signature must be computed with a secret key
//     that should never ship inside a client app bundle — the UAT test key
//     used here is meant to be public, but a live merchant secret key is
//     not. Khalti's ePayment `initiate` call has the same requirement: it
//     must be a server-to-server POST with the secret key in an
//     Authorization header, which is why this file calls it directly from
//     the client only in test mode, clearly flagged below.
import * as WebBrowser from 'expo-web-browser';
import * as FileSystem from 'expo-file-system/legacy';
import { hmacSha256Base64 } from './hmacSha256';

// ===== Official public UAT/sandbox test credentials =====
// eSewa: https://developer.esewa.com.np/pages/Test-credentials
export const ESEWA_TEST = {
  productCode: 'EPAYTEST',
  secretKey: '8gBm/:&EnhH.1/q',
  formUrl: 'https://rc-epay.esewa.com.np/api/epay/main/v2/form',
};

// Khalti: https://docs.khalti.com/khalti-epayment/ (test-admin.khalti.com sandbox)
// Khalti does NOT publish a shared public test secret key the way eSewa
// does — every merchant (even a test one) must sign up free at
// test-admin.khalti.com to get their own sandbox live_secret_key. There is
// no safe placeholder to embed here, so KHALTI_TEST.secretKey stays blank
// until an admin pastes their own sandbox key into
// app_subscription_settings/config.khalti.secretKey via Firestore. Until
// then the Khalti card falls back to showing "Coming Soon" even if
// `enabled` is accidentally left true with an empty key — see the
// isMethodReady() check in checkout.tsx.
export const KHALTI_TEST = {
  initiateUrl: 'https://dev.khalti.com/api/v2/epayment/initiate/',
};

function randomTxnId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

/**
 * Builds an eSewa ePay v2 signed auto-submit HTML form, writes it to a cache
 * file, and opens it in the in-app browser. eSewa's redirect is a form POST
 * (not a plain link), so an auto-submitting HTML page is the standard way to
 * trigger it from a mobile app with no backend.
 */
export async function openEsewaCheckout(params: {
  amount: number;
  transactionUuid?: string;
  successUrl: string;
  failureUrl: string;
  merchantCode?: string;
  secretKey?: string;
}): Promise<{ transactionUuid: string }> {
  const productCode = params.merchantCode || ESEWA_TEST.productCode;
  const secretKey = params.secretKey || ESEWA_TEST.secretKey;
  const transactionUuid = params.transactionUuid ?? randomTxnId('LS');
  const totalAmount = params.amount;

  const signedFieldNames = 'total_amount,transaction_uuid,product_code';
  const messageToSign = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
  const signature = hmacSha256Base64(messageToSign, secretKey);

  const fields: Record<string, string> = {
    amount: String(totalAmount),
    tax_amount: '0',
    total_amount: String(totalAmount),
    transaction_uuid: transactionUuid,
    product_code: productCode,
    product_service_charge: '0',
    product_delivery_charge: '0',
    success_url: params.successUrl,
    failure_url: params.failureUrl,
    signed_field_names: signedFieldNames,
    signature,
  };

  const inputs = Object.entries(fields)
    .map(([key, value]) => `<input type="hidden" name="${key}" value="${escapeHtml(value)}" />`)
    .join('\n');

  const html = `<!DOCTYPE html><html><body onload="document.forms[0].submit()">
    <form action="${ESEWA_TEST.formUrl}" method="POST">${inputs}</form>
  </body></html>`;

  const fileUri = `${FileSystem.cacheDirectory}esewa-redirect-${Date.now()}.html`;
  await FileSystem.writeAsStringAsync(fileUri, html);
  await WebBrowser.openBrowserAsync(fileUri);

  return { transactionUuid };
}

/**
 * Initiates a Khalti ePayment and opens the returned hosted checkout URL.
 * NOTE: this call is normally server-to-server (it carries the secret key in
 * an Authorization header). It's called directly from the client here only
 * because this app has no backend yet, and only ever with the public
 * sandbox test secret key above — never do this with a live secret key.
 */
export async function openKhaltiCheckout(params: {
  amount: number;
  purchaseOrderId?: string;
  purchaseOrderName: string;
  returnUrl: string;
  websiteUrl: string;
  customerName?: string | null;
  customerEmail?: string | null;
  secretKey: string;
}): Promise<{ purchaseOrderId: string; pidx: string | null }> {
  const purchaseOrderId = params.purchaseOrderId ?? randomTxnId('LS');
  if (!params.secretKey) throw new Error('KHALTI_SECRET_KEY_MISSING');

  const response = await fetch(KHALTI_TEST.initiateUrl, {
    method: 'POST',
    headers: {
      Authorization: `Key ${params.secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      return_url: params.returnUrl,
      website_url: params.websiteUrl,
      amount: Math.round(params.amount * 100), // Khalti expects paisa
      purchase_order_id: purchaseOrderId,
      purchase_order_name: params.purchaseOrderName,
      customer_info: {
        name: params.customerName ?? undefined,
        email: params.customerEmail ?? undefined,
      },
    }),
  });

  if (!response.ok) {
    throw new Error('KHALTI_INITIATE_FAILED');
  }

  const data = (await response.json()) as { payment_url?: string; pidx?: string };
  if (!data.payment_url) throw new Error('KHALTI_NO_PAYMENT_URL');

  await WebBrowser.openBrowserAsync(data.payment_url);
  return { purchaseOrderId, pidx: data.pidx ?? null };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
