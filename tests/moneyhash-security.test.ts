import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { isAllowedMoneyHashEmbedUrl, verifyMoneyHashSignature, shouldApplyMoneyHashStatus } from '../utils/moneyHashSecurity';

test('accepts only official HTTPS MoneyHash embed URLs', () => {
  assert.equal(isAllowedMoneyHashEmbedUrl('https://embed.moneyhash.io/embed/payment/abc'), true);
  assert.equal(isAllowedMoneyHashEmbedUrl('https://evil.example/embed/payment/abc'), false);
  assert.equal(isAllowedMoneyHashEmbedUrl('http://embed.moneyhash.io/embed/payment/abc'), false);
});

test('verifies MoneyHash v3 signature using compact payload and timestamp', () => {
  const payload = '{ "data": { "id": "intent-1" } }';
  const secret = 'test-org-secret';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const digest = crypto.createHmac('sha256', secret).update(payload.replace(/\s+/g, '') + timestamp).digest('hex');
  assert.equal(verifyMoneyHashSignature(payload, `t=${timestamp},v3=${digest}`, secret), true);
  assert.equal(verifyMoneyHashSignature(payload, `t=${timestamp},v3=${'0'.repeat(64)}`, secret), false);
});

test('does not allow stale events to regress a paid order', () => {
  assert.equal(shouldApplyMoneyHashStatus('SUCCESSFUL', 'PENDING'), false);
  assert.equal(shouldApplyMoneyHashStatus('PENDING', 'SUCCESSFUL'), true);
});
