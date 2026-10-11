import crypto from 'node:crypto';

export const MONEYHASH_EMBED_HOSTS = new Set([
  'embed.moneyhash.io',
  'checkout.moneyhash.io',
  'sandbox.moneyhash.io'
]);

export function isAllowedMoneyHashEmbedUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && MONEYHASH_EMBED_HOSTS.has(url.hostname.toLowerCase()) &&
      (url.pathname.startsWith('/embed/') || url.hostname === 'embed.moneyhash.io');
  } catch {
    return false;
  }
}

function parseSignatureHeader(header: string): { timestamp: string; signatures: string[] } | null {
  const values = Object.fromEntries(header.split(',').map(part => {
    const [key, ...rest] = part.trim().split('=');
    return [key, rest.join('=')];
  }).filter(([key, value]) => key && value));
  const timestamp = values.t;
  const signatures = [values.v3, values.v2, values.v1].filter((value): value is string => typeof value === 'string');
  return timestamp && signatures.length ? { timestamp, signatures } : null;
}

/** MoneyHash v3: compact JSON payload + timestamp, HMAC-SHA256 with organization signature key. */
export function verifyMoneyHashSignature(rawPayload: string, header: string | undefined, secret: string, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300): boolean {
  if (!header || !secret) return false;
  const parsed = parseSignatureHeader(header);
  if (!parsed || !/^\d{10,}$/.test(parsed.timestamp)) return false;
  const timestamp = Number(parsed.timestamp);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;
  const compactPayload = rawPayload.replace(/\s+/g, '');
  const expected = crypto.createHmac('sha256', secret).update(compactPayload + parsed.timestamp, 'utf8').digest('hex');
  return parsed.signatures.some(signature => /^[a-f0-9]{64}$/i.test(signature) && crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex')));
}

const STATUS_RANK: Record<string, number> = {
  UNPROCESSED: 0, PENDING: 10, PROCESSING: 20, AUTHORIZED: 50,
  CAPTURED: 100, SUCCESSFUL: 100, PAID: 100, COMPLETED: 100,
  FAILED: 30, DECLINED: 30, CANCELED: 30, CANCELLED: 30, EXPIRED: 30,
  REFUNDED: 110
};

export function shouldApplyMoneyHashStatus(previous: string | undefined, next: string): boolean {
  const oldStatus = String(previous || '').toUpperCase();
  const newStatus = String(next || '').toUpperCase();
  if (!newStatus) return false;
  if (['CAPTURED', 'SUCCESSFUL', 'PAID', 'COMPLETED'].includes(oldStatus) && !['REFUNDED'].includes(newStatus)) return false;
  return (STATUS_RANK[newStatus] ?? 0) >= (STATUS_RANK[oldStatus] ?? 0);
}

export function isMoneyHashPaidStatus(status: unknown): boolean {
  return ['CAPTURED', 'SUCCESSFUL', 'PAID', 'COMPLETED'].includes(String(status || '').toUpperCase());
}
