const encoder = new TextEncoder();

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function parseSignature(signature) {
  const values = new Map();
  for (const rawPart of signature.split(',')) {
    const part = rawPart.trim();
    const separator = part.indexOf('=');
    if (separator <= 0) return null;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!name || !value || values.has(name)) return null;
    values.set(name, value);
  }
  return { ts: values.get('ts') ?? '', v1: values.get('v1') ?? '' };
}

export function buildManifest(dataId, requestId, timestamp) {
  return `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${timestamp};`;
}

export async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function createSignatureHeader({ secret, dataId, requestId, timestamp }) {
  const v1 = await hmacHex(secret, buildManifest(dataId, requestId, timestamp));
  return `ts=${timestamp},v1=${v1}`;
}

export async function verifyWebhookSignature({
  signature,
  requestId,
  dataId,
  secret,
  nowMs = Date.now(),
  toleranceSeconds = 300
}) {
  if (!signature || !requestId || !dataId || !secret) return false;
  const parsed = parseSignature(signature);
  if (!parsed?.ts || !/^[a-f\d]{64}$/i.test(parsed.v1)) return false;

  const rawTimestamp = Number(parsed.ts);
  if (!Number.isFinite(rawTimestamp) || rawTimestamp <= 0) return false;
  const timestampMs = rawTimestamp >= 1_000_000_000_000 ? rawTimestamp : rawTimestamp * 1000;
  if (Math.abs(nowMs - timestampMs) > toleranceSeconds * 1000) return false;

  const expected = await hmacHex(secret, buildManifest(dataId, requestId, parsed.ts));
  return constantTimeEqual(expected, parsed.v1.toLowerCase());
}
