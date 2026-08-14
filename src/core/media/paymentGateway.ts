// Payment gateway helpers for the subscription checkout.
//
// eSewa ePay v2 uses a signed POST form. Khalti ePayment uses a server-side
// initiate request and returns a hosted payment URL. This app supports the
// providers' sandbox/UAT flow for testing; live secret keys must never be
// shipped in the client bundle.
import * as WebBrowser from 'expo-web-browser';
import { hmacSha256Base64 } from './hmacSha256';

// Official eSewa UAT credentials documented at:
// https://developer.esewa.com.np/pages/Test-credentials
export const ESEWA_TEST = {
  productCode: 'EPAYTEST',
  secretKey: '8gBm/:&EnhH.1/q',
  formUrl: 'https://rc-epay.esewa.com.np/api/epay/main/v2/form',
};

// Khalti does not publish one shared secret key. A merchant must create a
// sandbox account at https://test-admin.khalti.com. Its secret key must be
// used only by a secure backend and must never be stored in client-readable
// Firestore config or bundled in the mobile app.
export const KHALTI_TEST = {
  initiateUrl: 'https://dev.khalti.com/api/v2/epayment/initiate/',
};

function randomTxnId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function createEsewaCheckoutHtml(params: {
  amount: number;
  transactionUuid?: string;
  successUrl: string;
  failureUrl: string;
  merchantCode?: string;
  secretKey?: string;
}): { html: string; transactionUuid: string } {
  const productCode = params.merchantCode || ESEWA_TEST.productCode;
  const secretKey = params.secretKey || ESEWA_TEST.secretKey;
  const transactionUuid = params.transactionUuid ?? randomTxnId('LS');
  const totalAmount = String(params.amount);
  const signedFieldNames = 'total_amount,transaction_uuid,product_code';
  const messageToSign = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
  const signature = hmacSha256Base64(messageToSign, secretKey);

  const fields: Record<string, string> = {
    amount: totalAmount,
    tax_amount: '0',
    total_amount: totalAmount,
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
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body onload="document.forms[0].submit()"><form action="${ESEWA_TEST.formUrl}" method="POST">${inputs}</form><p>Opening eSewa…</p></body></html>`;
  return { html, transactionUuid };
}

/**
 * Retained for callers that want to open eSewa directly in the system browser.
 * The checkout screen uses createEsewaCheckoutHtml in a WebView so the form
 * POST works reliably on Android and iOS.
 */
export async function openEsewaCheckout(params: Parameters<typeof createEsewaCheckoutHtml>[0]): Promise<{ transactionUuid: string }> {
  const { html, transactionUuid } = createEsewaCheckoutHtml(params);
  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  await WebBrowser.openBrowserAsync(dataUrl);
  return { transactionUuid };
}

/** Initiates Khalti and returns its hosted payment URL to the caller. */
export async function openKhaltiCheckout(params: {
  amount: number;
  purchaseOrderId?: string;
  purchaseOrderName: string;
  returnUrl: string;
  websiteUrl: string;
  customerName?: string | null;
  customerEmail?: string | null;
  secretKey: string;
}): Promise<{ purchaseOrderId: string; pidx: string | null; paymentUrl: string }> {
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
      amount: Math.round(params.amount * 100),
      purchase_order_id: purchaseOrderId,
      purchase_order_name: params.purchaseOrderName,
      customer_info: {
        name: params.customerName ?? undefined,
        email: params.customerEmail ?? undefined,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`KHALTI_INITIATE_FAILED:${detail.slice(0, 160)}`);
  }

  const data = (await response.json()) as { payment_url?: string; pidx?: string };
  if (!data.payment_url) throw new Error('KHALTI_NO_PAYMENT_URL');
  return { purchaseOrderId, pidx: data.pidx ?? null, paymentUrl: data.payment_url };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
