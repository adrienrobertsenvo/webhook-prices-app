import { createHmac, timingSafeEqual } from 'crypto';

export function verifySignature(secret: string, body: Buffer, signature: string): boolean {
  if (!signature) return false;
  const digest = createHmac('sha256', secret).update(body).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    // timingSafeEqual throws if lengths differ
    return false;
  }
}
