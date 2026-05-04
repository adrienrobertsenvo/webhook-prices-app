import { createHmac, timingSafeEqual } from 'crypto';

export function verifySignature(secret: string, body: Buffer, signature: string): boolean {
  if (!signature) return false;
  // Senvo sends the signature as "sha256=<hex>" — strip the prefix if present
  const hex = signature.startsWith('sha256=') ? signature.slice(7) : signature;
  const digest = createHmac('sha256', secret).update(body).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(hex));
  } catch {
    return false;
  }
}
