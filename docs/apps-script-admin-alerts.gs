/**
 * Loksewa Solution — Admin Alert relay (Expo push).
 *
 * WHAT THIS IS FOR
 * When any user files a report from the app, every ADMIN device should get a tray
 * push. The app cannot do that by itself: Firestore rules only let an admin read
 * another user's push tokens, so a normal user's phone can never see the admin
 * tokens it would need to send to. The only way to keep those tokens secret is to
 * hold them somewhere the app cannot read — this script.
 *
 * The admin's own phone registers its push token here once. After that, any
 * user's phone can ask this script "alert the admins", and the script does the
 * actual Expo push with tokens the app never sees.
 *
 * This is a BRAND-NEW, SEPARATE Apps Script project. It does not touch, read or
 * replace the existing Discord relay (Google Form -> Sheet -> Apps Script ->
 * Discord). That one keeps running exactly as it is.
 *
 * ---------------------------------------------------------------------------
 * SETUP — do these in order
 *
 *  1. Open https://script.google.com and click "New project".
 *  2. Rename the project (top-left) to: Loksewa Admin Alerts
 *  3. Delete everything in the default Code.gs and paste this ENTIRE file in.
 *  4. Set the shared secret:
 *       Left sidebar -> Project Settings (gear icon)
 *       -> scroll to "Script properties" -> "Add script property"
 *       Property: SHARED_SECRET
 *       Value:    (any long random string you invent, e.g. lsp_7Qx19ZbK4mVt2Ra)
 *     Click "Save script properties".
 *  5. Deploy -> New deployment -> click the gear next to "Select type"
 *     -> choose "Web app". Then set:
 *       Description:      admin alerts v1
 *       Execute as:       Me
 *       Who has access:   Anyone
 *     Click Deploy. Google will ask you to authorise — Review permissions ->
 *     pick your account -> "Advanced" -> "Go to Loksewa Admin Alerts (unsafe)"
 *     -> Allow. (It says "unsafe" only because the script is unpublished/yours.)
 *  6. Copy the "Web app URL" it shows you. It ends in /exec.
 *  7. Open src/core/config/appConfig.ts in the app and fill in BOTH values under
 *     messaging.adminAlertWebhook:
 *       appsScriptUrl: '<the /exec URL from step 6>'
 *       sharedSecret:  '<the exact same string you used in step 4>'
 *  8. Rebuild the app (EAS). On first launch of an ADMIN account, that phone
 *     registers itself here automatically.
 *  9. To check it worked, open this URL in a browser (replace YOUR_SECRET):
 *       <your /exec URL>?secret=YOUR_SECRET
 *     It should answer with {"ok":true,"devices":1,...}. Push tokens are never
 *     included in that answer.
 *
 * IF YOU EDIT THIS SCRIPT LATER: Deploy -> Manage deployments -> pencil icon
 * -> Version: "New version" -> Deploy. Without that, the live /exec URL keeps
 * serving the old code.
 * ---------------------------------------------------------------------------
 *
 * SECURITY NOTE, honestly stated. The shared secret ships inside the app bundle,
 * so a determined person could extract it and call this endpoint. What they
 * could do with it is limited on purpose: this script only ever sends the fixed
 * "new report" notification, and it never returns a push token to the caller.
 * They could not read your admin tokens or send arbitrary push content. That is
 * the whole reason the tokens live here instead of in a Firestore document the
 * app can read.
 */

/** Expo's public push endpoint. No key needed unless you enable Expo's
 *  "Enhanced Security for Push Notifications", which this app does not. */
var EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Script property holding the JSON map of admin devices. */
var DEVICES_KEY = 'ADMIN_DEVICES';

/** A device that has not checked in for this long is dropped. Tokens go stale
 *  when the app is reinstalled, and Expo rejects them forever after that. */
var DEVICE_TTL_DAYS = 120;

/** Expo accepts at most 100 messages per request. */
var PUSH_BATCH_SIZE = 100;

/* =========================================================================
 * Entry points
 * ========================================================================= */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json({ ok: false, error: 'EMPTY_BODY' });
    }
    var body = JSON.parse(e.postData.contents);

    if (!secretOk(body.secret)) {
      return json({ ok: false, error: 'BAD_SECRET' });
    }

    switch (body.action) {
      case 'admin_register':
        return json(registerAdminDevice(body));
      case 'admin_unregister':
        return json(unregisterAdminDevice(body));
      case 'report_created':
        return json(alertAdminsOfReport(body));
      default:
        return json({ ok: false, error: 'UNKNOWN_ACTION' });
    }
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/**
 * Health check only, for step 9 of the setup. Deliberately returns the device
 * COUNT and harmless labels — never a push token, even to a caller who has the
 * secret, so pasting the URL somewhere by accident cannot leak anything usable.
 */
function doGet(e) {
  var secret = e && e.parameter ? e.parameter.secret : '';
  if (!secretOk(secret)) {
    return json({ ok: false, error: 'BAD_SECRET' });
  }
  var devices = readDevices();
  var list = [];
  for (var deviceId in devices) {
    if (!Object.prototype.hasOwnProperty.call(devices, deviceId)) continue;
    var d = devices[deviceId];
    list.push({
      name: d.name || '(unnamed)',
      uid: d.uid || '',
      platform: d.platform || '',
      updatedAt: d.updatedAt || '',
    });
  }
  return json({ ok: true, devices: list.length, list: list });
}

/* =========================================================================
 * Actions
 * ========================================================================= */

/** An admin's phone stores/refreshes its own push token here. */
function registerAdminDevice(body) {
  var deviceId = String(body.deviceId || '').trim();
  var token = String(body.token || '').trim();
  if (!deviceId || !token) return { ok: false, error: 'MISSING_DEVICE_OR_TOKEN' };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var devices = readDevices();
    devices[deviceId] = {
      token: token,
      uid: String(body.uid || ''),
      name: String(body.name || ''),
      platform: String(body.platform || ''),
      appVersion: String(body.appVersion || ''),
      updatedAt: new Date().toISOString(),
    };
    devices = pruneStale(devices);
    writeDevices(devices);
    return { ok: true, devices: countKeys(devices) };
  } finally {
    lock.releaseLock();
  }
}

/** Called when an admin signs out on that device, so it stops getting alerts. */
function unregisterAdminDevice(body) {
  var deviceId = String(body.deviceId || '').trim();
  if (!deviceId) return { ok: false, error: 'MISSING_DEVICE' };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var devices = readDevices();
    delete devices[deviceId];
    writeDevices(devices);
    return { ok: true, devices: countKeys(devices) };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Sends the "new report" push to every registered admin device.
 *
 * The caller sends only display text — it does not choose recipients and cannot
 * learn who they are. Tokens Expo rejects as DeviceNotRegistered are removed so
 * the list cleans itself up over time.
 */
function alertAdminsOfReport(body) {
  var devices = readDevices();
  var deviceIds = Object.keys(devices);
  if (!deviceIds.length) {
    return { ok: true, sent: 0, failed: 0, note: 'NO_ADMIN_DEVICE_REGISTERED' };
  }

  var reporter = String(body.reporterName || 'A user').trim() || 'A user';
  var context = String(body.contextLabel || '').trim();
  var reason = String(body.reason || '').trim();
  var target = String(body.targetTitle || '').trim();
  var detail = String(body.description || '').trim();

  var title = context ? 'New report · ' + context : 'New report received';
  var lines = [reporter + ' reported' + (reason ? ': ' + reason : ' an issue') + '.'];
  if (target) lines.push('On: ' + clip(target, 90));
  if (detail) lines.push(clip(detail, 120));

  var message = {
    title: clip(title, 90),
    body: clip(lines.join(' '), 300),
    sound: 'default',
    priority: 'high',
    channelId: 'default',
    data: {
      deepLink: String(body.deepLink || '/admin/report-history'),
      reportId: String(body.reportId || ''),
      kind: 'admin_report_alert',
    },
  };

  var sent = 0;
  var failed = 0;
  var dead = [];

  for (var i = 0; i < deviceIds.length; i += PUSH_BATCH_SIZE) {
    var slice = deviceIds.slice(i, i + PUSH_BATCH_SIZE);
    var payload = slice.map(function (deviceId) {
      var copy = {
        to: devices[deviceId].token,
        title: message.title,
        body: message.body,
        sound: message.sound,
        priority: message.priority,
        channelId: message.channelId,
        data: message.data,
      };
      return copy;
    });

    var response = UrlFetchApp.fetch(EXPO_PUSH_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    var parsed = safeJson(response.getContentText());
    var tickets = parsed && parsed.data ? parsed.data : [];
    for (var t = 0; t < slice.length; t++) {
      var ticket = tickets[t];
      if (ticket && ticket.status === 'ok') {
        sent++;
      } else {
        failed++;
        var code = ticket && ticket.details ? ticket.details.error : '';
        if (code === 'DeviceNotRegistered') dead.push(slice[t]);
      }
    }
  }

  if (dead.length) {
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var fresh = readDevices();
      for (var d = 0; d < dead.length; d++) delete fresh[dead[d]];
      writeDevices(fresh);
    } finally {
      lock.releaseLock();
    }
  }

  return { ok: true, sent: sent, failed: failed, removed: dead.length };
}

/* =========================================================================
 * Helpers
 * ========================================================================= */

function secretOk(candidate) {
  var expected = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET');
  // An unset secret must FAIL closed, not open. A misconfigured deployment that
  // accepted everything would be worse than one that plainly does not work.
  if (!expected) return false;
  return String(candidate || '') === expected;
}

function readDevices() {
  var raw = PropertiesService.getScriptProperties().getProperty(DEVICES_KEY);
  if (!raw) return {};
  try {
    var parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    return {};
  }
}

function writeDevices(devices) {
  PropertiesService.getScriptProperties().setProperty(DEVICES_KEY, JSON.stringify(devices));
}

function pruneStale(devices) {
  var cutoff = Date.now() - DEVICE_TTL_DAYS * 24 * 60 * 60 * 1000;
  var kept = {};
  for (var deviceId in devices) {
    if (!Object.prototype.hasOwnProperty.call(devices, deviceId)) continue;
    var stamp = Date.parse(devices[deviceId].updatedAt || '');
    if (isNaN(stamp) || stamp >= cutoff) kept[deviceId] = devices[deviceId];
  }
  return kept;
}

function countKeys(obj) {
  return Object.keys(obj).length;
}

function clip(value, max) {
  var text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trim() + '…';
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch (err) {
    return null;
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
