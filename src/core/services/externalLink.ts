// Opening a link that somebody typed by hand.
//
// Every URL in the app that came from the admin console rather than from
// AppConfig arrives here, because a hand-typed address is allowed to be
// imperfect and `Linking.openURL` is not forgiving about it.
//
// The bug this exists to kill: an admin saved a notice's download link as
// `kbr.com.np`. With no scheme that is a RELATIVE url, so iOS resolved it
// against the app bundle and tried to open
//
//   file:///private/var/containers/Bundle/Application/…/Expo Go.app/kbr.com.np
//
// which does not exist. The rejection was unhandled, so instead of "that link
// is broken" the user got a full-screen red console error and no link.
import { Linking } from 'react-native';
import { showToast } from '@/src/core/store/toastStore';

/**
 * Schemes we pass through untouched. Anything already carrying one of these is
 * a complete address and second-guessing it would break `mailto:` and `tel:`.
 */
const KNOWN_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Turn whatever the admin typed into something openable, or return null if
 * there is nothing there at all.
 *
 * The rules, in the order they are applied:
 *  - trim, because a trailing space is enough to break `canOpenURL`
 *  - `//example.com`  → `https://example.com` (protocol-relative, a web habit)
 *  - `example.com`    → `https://example.com` (the actual bug above)
 *  - `www.example.com`→ `https://www.example.com`
 *  - `http://…`, `https://…`, `mailto:…`, `tel:…` → untouched
 *
 * Deliberately NOT encoded: the stored value may already contain percent
 * escapes, and re-encoding would turn `%20` into `%2520`.
 */
export function normalizeExternalUrl(raw: string | null | undefined): string | null {
  const url = (raw ?? '').trim();
  if (!url) return null;
  if (url.startsWith('//')) return `https:${url}`;
  if (KNOWN_SCHEME.test(url)) return url;
  return `https://${url}`;
}

/**
 * Open an admin-authored link, and never throw.
 *
 * `canOpenURL` is checked first so a genuinely malformed address produces a
 * toast the user can act on instead of a red box they can only dismiss. The
 * failure message is deliberately plain English on both app languages — it
 * names a problem with the notice, not with the reader.
 */
export async function openExternalUrl(raw: string | null | undefined): Promise<boolean> {
  const url = normalizeExternalUrl(raw);
  if (!url) {
    showToast('This link is not available.', 'warning');
    return false;
  }
  try {
    // Android can answer `false` for perfectly good https links when no browser
    // has been queried in the manifest, so a negative answer is a reason to try
    // anyway — not a reason to stop. Only a thrown error is treated as failure.
    const supported = await Linking.canOpenURL(url).catch(() => true);
    if (!supported && !/^https?:/i.test(url)) {
      showToast('No app on this device can open this link.', 'warning');
      return false;
    }
    await Linking.openURL(url);
    return true;
  } catch {
    showToast('Could not open this link. Please try again later.', 'error');
    return false;
  }
}
