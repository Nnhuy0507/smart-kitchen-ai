const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const router = require('./googleExpoRoutes');

test('Expo Google bridge verifies nonce and protects one-time results', async (t) => {
  const originalOrigin = process.env.GOOGLE_EXPO_WEB_ORIGIN;
  const originalAudience = process.env.GOOGLE_WEB_CLIENT_ID;
  const originalVerify = OAuth2Client.prototype.verifyIdToken;
  const app = express();
  app.use(express.json());
  app.use('/api/auth/google/expo', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/auth/google/expo`;
  t.after(async () => {
    OAuth2Client.prototype.verifyIdToken = originalVerify;
    for (const [name, value] of Object.entries({
      GOOGLE_EXPO_WEB_ORIGIN: originalOrigin,
      GOOGLE_WEB_CLIENT_ID: originalAudience,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await new Promise((resolve) => server.close(resolve));
  });
  const post = (path, body, origin) => fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(origin && { Origin: origin }) },
    body: JSON.stringify(body),
  });
  delete process.env.GOOGLE_EXPO_WEB_ORIGIN;
  assert.equal((await post('/session', {})).status, 503);
  process.env.GOOGLE_EXPO_WEB_ORIGIN = 'http://192.168.1.68:3000';
  assert.equal((await post('/session', {})).status, 503);
  process.env.GOOGLE_EXPO_WEB_ORIGIN = 'https://kitchen.example.com';
  process.env.GOOGLE_WEB_CLIENT_ID = 'test.apps.googleusercontent.com';

  const session = await (await post('/session', {})).json();
  assert.match(session.browserUrl, /^https:\/\/kitchen\.example\.com\/api\/auth\/google\/expo\/browser\//);
  const page = await (await fetch(`${base}/browser/${session.sessionId}`)).text();
  assert.ok(!page.includes(session.secret));
  const config = JSON.parse(page.match(/const config = (.*);/)[1]);
  const browserPath = `/browser/${session.sessionId}`;
  assert.equal((await post(browserPath, { idToken: 'token' }, 'https://attacker.example')).status, 403);
  OAuth2Client.prototype.verifyIdToken = async () => ({
    getPayload: () => ({ sub: 'user', email: 'test@example.com', email_verified: true, nonce: 'wrong' }),
  });
  assert.equal((await post(browserPath, { idToken: 'token' }, process.env.GOOGLE_EXPO_WEB_ORIGIN)).status, 401);
  OAuth2Client.prototype.verifyIdToken = async ({ audience }) => {
    assert.equal(audience, process.env.GOOGLE_WEB_CLIENT_ID);
    return { getPayload: () => ({ sub: 'user', email: 'test@example.com', email_verified: true, nonce: config.nonce }) };
  };
  assert.equal((await post(browserPath, { idToken: 'verified-token' }, process.env.GOOGLE_EXPO_WEB_ORIGIN)).status, 200);
  assert.equal((await post('/result', { sessionId: session.sessionId, secret: '0'.repeat(64) })).status, 410);
  assert.equal((await post(browserPath, { idToken: 'verified-token' }, process.env.GOOGLE_EXPO_WEB_ORIGIN)).status, 409);
  const result = await (await post('/result', session)).json();
  assert.equal(result.idToken, 'verified-token');
  assert.equal((await post('/result', session)).status, 410);

  const cancelled = await (await post('/session', {})).json();
  assert.equal((await post('/result', cancelled)).status, 400);
  assert.equal((await post('/result', cancelled)).status, 410);

  const expired = await (await post('/session', {})).json();
  const originalNow = Date.now;
  Date.now = () => originalNow() + 6 * 60 * 1000;
  try {
    assert.equal((await post('/result', expired)).status, 410);
  } finally {
    Date.now = originalNow;
  }
});
