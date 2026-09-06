// Minimal, dependency-free HMAC-SHA256 — used only to sign the eSewa ePay v2
// test-mode redirect (see checkout.tsx). No crypto/HMAC library is currently
// installed in this project (no crypto-js, no expo-crypto HMAC support), so
// this is a small self-contained implementation rather than adding a new
// native dependency for one call site.
//
// SECURITY NOTE: eSewa's signature is meant to be computed server-side so the
// secret key never ships in a client bundle. This app has no backend, so for
// now the OFFICIAL PUBLIC UAT TEST secret key is used (it is published in
// eSewa's own developer docs and only works against their sandbox — it
// cannot move real money). Before going live with `esewa.enabled: true` and
// a real merchant secret key, move this signing step to a small server
// endpoint and stop shipping the secret key in the app.
//
// Output is base64, matching eSewa's expected format.

function toWords(bytes: Uint8Array): Uint32Array {
  const words = new Uint32Array(Math.ceil(bytes.length / 4));
  for (let i = 0; i < bytes.length; i++) {
    words[i >>> 2] |= bytes[i] << (24 - (i % 4) * 8);
  }
  return words;
}

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function sha256(message: Uint8Array): Uint8Array {
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const bitLen = message.length * 8;
  const withOne = new Uint8Array(message.length + 1);
  withOne.set(message);
  withOne[message.length] = 0x80;

  let totalLen = withOne.length;
  while (totalLen % 64 !== 56) totalLen++;
  const padded = new Uint8Array(totalLen + 8);
  padded.set(withOne);
  // 64-bit big-endian bit length (low 32 bits are enough for any realistic input here)
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen >>> 0, false);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 2 ** 32), false);

  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    const chunk = toWords(padded.subarray(offset, offset + 64));
    for (let i = 0; i < 16; i++) w[i] = chunk[i];
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  [h0, h1, h2, h3, h4, h5, h6, h7].forEach((h, i) => outView.setUint32(i * 4, h, false));
  return out;
}

function utf8Bytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}

/** HMAC-SHA256(message, key) → base64 string, matching eSewa's expected signature format. */
export function hmacSha256Base64(message: string, key: string): string {
  const blockSize = 64;
  let keyBytes = utf8Bytes(key);
  if (keyBytes.length > blockSize) keyBytes = sha256(keyBytes);
  if (keyBytes.length < blockSize) {
    const padded = new Uint8Array(blockSize);
    padded.set(keyBytes);
    keyBytes = padded;
  }

  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = keyBytes[i] ^ 0x5c;
    iKeyPad[i] = keyBytes[i] ^ 0x36;
  }

  const messageBytes = utf8Bytes(message);
  const inner = new Uint8Array(iKeyPad.length + messageBytes.length);
  inner.set(iKeyPad);
  inner.set(messageBytes, iKeyPad.length);
  const innerHash = sha256(inner);

  const outer = new Uint8Array(oKeyPad.length + innerHash.length);
  outer.set(oKeyPad);
  outer.set(innerHash, oKeyPad.length);
  const finalHash = sha256(outer);

  return bytesToBase64(finalHash);
}
