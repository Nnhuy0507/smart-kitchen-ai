const { test } = require('node:test');
const assert = require('node:assert/strict');
const { OAuth2Client } = require('google-auth-library');
const db = require('../config/db');
const login = require('./googleAuthController');

test('Google login validates credentials and uses verified Google identity', async (t) => {
  const originalVerify = OAuth2Client.prototype.verifyIdToken;
  const originalQuery = db.query;
  const originalAudience = process.env.GOOGLE_WEB_CLIENT_ID;
  t.after(async () => {
    OAuth2Client.prototype.verifyIdToken = originalVerify;
    db.query = originalQuery;
    if (originalAudience === undefined) delete process.env.GOOGLE_WEB_CLIENT_ID;
    else process.env.GOOGLE_WEB_CLIENT_ID = originalAudience;
    await db.end();
  });
  async function invoke(body) {
    const response = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await login({ body }, response);
    return response;
  }
  delete process.env.GOOGLE_WEB_CLIENT_ID;
  assert.equal((await invoke({ idToken: 'token' })).code, 503);
  process.env.GOOGLE_WEB_CLIENT_ID = 'test.apps.googleusercontent.com';
  assert.equal((await invoke({})).code, 400);
  OAuth2Client.prototype.verifyIdToken = async () => { throw new Error('invalid signature'); };
  db.query = async () => { throw new Error('must not access DB for invalid token'); };
  assert.equal((await invoke({ idToken: 'invalid' })).code, 401);
  OAuth2Client.prototype.verifyIdToken = async ({ audience }) => {
    assert.equal(audience, process.env.GOOGLE_WEB_CLIENT_ID);
    return { getPayload: () => ({ sub: 'google-user', email: 'test@gmail.com', email_verified: true, name: 'Test' }) };
  };
  db.query = async (sql, values) => {
    assert.match(sql, /WHERE google_id/);
    assert.equal(values[0], 'google-user');
    return [[{ user_id: 7, full_name: 'Test', phone: null, email: 'test@gmail.com' }]];
  };
  const existing = await invoke({ idToken: 'verified', user_id: 999 });
  assert.equal(existing.body.data.user_id, 7);
  assert.equal(existing.body.data.isNewAccount, false);
  let call = 0;
  db.query = async () => ++call === 1 ? [[]] : [[{ user_id: 8 }]];
  assert.equal((await invoke({ idToken: 'verified' })).code, 409);
  call = 0;
  db.query = async (sql, values) => {
    if (++call < 3) return [[]];
    assert.match(sql, /INSERT INTO users/);
    assert.equal(values[2], 'google-user');
    return [{ insertId: 9 }];
  };
  const created = await invoke({ idToken: 'verified' });
  assert.equal(created.body.data.user_id, 9);
  assert.equal(created.body.data.isNewAccount, true);
});
