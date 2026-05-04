import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { verifySignature } from '@/lib/signature';

const SECRET = 'test-signing-secret';

function makeSignature(secret: string, body: string): string {
  return createHmac('sha256', secret).update(Buffer.from(body)).digest('hex');
}

function makePrefixedSignature(secret: string, body: string): string {
  return 'sha256=' + makeSignature(secret, body);
}

describe('verifySignature', () => {
  it('returns true for a valid signature', () => {
    const body = '{"id":"whe_1","object_type":"selling_price"}';
    const sig = makeSignature(SECRET, body);
    expect(verifySignature(SECRET, Buffer.from(body), sig)).toBe(true);
  });

  it('returns false for a wrong signature', () => {
    const body = '{"id":"whe_1"}';
    expect(verifySignature(SECRET, Buffer.from(body), 'deadbeef')).toBe(false);
  });

  it('returns false when signature length differs (prevents timing oracle)', () => {
    const body = '{"id":"whe_1"}';
    expect(verifySignature(SECRET, Buffer.from(body), 'short')).toBe(false);
  });

  it('returns false for empty signature', () => {
    const body = '{"id":"whe_1"}';
    expect(verifySignature(SECRET, Buffer.from(body), '')).toBe(false);
  });

  it('returns true for a valid sha256= prefixed signature (Senvo format)', () => {
    const body = '{"id":"whe_1","object_type":"selling_price"}';
    const sig = makePrefixedSignature(SECRET, body);
    expect(verifySignature(SECRET, Buffer.from(body), sig)).toBe(true);
  });

  it('returns false for a wrong sha256= prefixed signature', () => {
    const body = '{"id":"whe_1"}';
    expect(verifySignature(SECRET, Buffer.from(body), 'sha256=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef')).toBe(false);
  });
});
