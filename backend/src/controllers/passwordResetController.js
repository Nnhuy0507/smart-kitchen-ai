const { randomBytes, randomInt, createHash, createHmac, timingSafeEqual } = require('node:crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { deliveryConfig, sendResetCode } = require('../services/resetDelivery');

const randomToken = () => randomBytes(32).toString('hex');
const tokenPattern = /^[0-9a-f]{64}$/;
const isToken = value => typeof value === 'string' && tokenPattern.test(value);
const digest = value => createHash('sha256').update(value).digest('hex');
const codeDigest = (id, code) => createHmac('sha256', process.env.PASSWORD_RESET_SECRET)
  .update(id + ':' + code).digest('hex');

const invalidCode = 'Mã OTP không hợp lệ hoặc đã hết hạn.';
const invalidReset = 'Phiên đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu mã mới.';
const requestMessage = 'Nếu thông tin khớp với tài khoản, bạn sẽ nhận được mã OTP.';
const fail = (res, status, message) => res.status(status).json({ success: false, message });

// Limit requests before hitting the database or delivery provider.
const ipCounts = new Map();
const resendAtByEmail = new Map();
const resendDelayMs = 60_000;
let renewAt = 0;
function endpoint(handler) {
  return async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const now = Date.now();
    if (now >= renewAt) {
      ipCounts.clear();
      for (const [email, resendAt] of resendAtByEmail) {
        if (resendAt <= now) resendAtByEmail.delete(email);
      }
      renewAt = now + 60_000;
    }
    const key = handler.name + ':' + req.ip;
    const count = ipCounts.get(key) ?? 0;
    const limit = handler === requestCode ? 5 : 20;
    if (count >= limit || (!count && ipCounts.size >= 10_000)) {
      return fail(res, 429, 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.');
    }
    ipCounts.set(key, count + 1);
    try {
      return await handler(req.body ?? {}, res);
    } catch (error) {
      console.error('Password reset error:', error.code ?? error.name);
      return fail(res, 500, 'Không thể đặt lại mật khẩu lúc này. Vui lòng thử lại.');
    }
  };
}

async function requestCode({ channel, identifier }, res) {
  const contact = typeof identifier === 'string' ? identifier.trim().toLowerCase() : '';
  if (channel !== undefined && channel !== 'email') {
    return fail(res, 400, 'Chỉ hỗ trợ gửi mã OTP qua email.');
  }
  if (contact.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
    return fail(res, 400, 'Email không hợp lệ.');
  }
  const config = deliveryConfig();
  if (!config || (process.env.PASSWORD_RESET_SECRET ?? '').length < 32) {
    return fail(res, 503, 'Kênh gửi mã này chưa sẵn sàng. Vui lòng thử lại sau.');
  }

  // Apply the same resend policy to registered and unregistered addresses.
  const now = Date.now();
  const resendAt = resendAtByEmail.get(contact) ?? 0;
  if (resendAt > now) {
    const seconds = Math.ceil((resendAt - now) / 1000);
    res.set('Retry-After', String(seconds));
    return fail(res, 429, `Bạn có thể gửi mã mới sau ${seconds} giây.`);
  }
  if (!resendAt && resendAtByEmail.size >= 10_000) {
    return fail(res, 429, 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.');
  }
  resendAtByEmail.set(contact, now + resendDelayMs);

  const [users] = await db.query(
    'SELECT user_id, email AS destination FROM users WHERE LOWER(email) = ? LIMIT 2',
    [contact],
  );
  const challengeId = randomToken();
  if (users.length === 1) {
    const user = users[0];
    const code = String(randomInt(1_000_000)).padStart(6, '0');
    await db.query('INSERT IGNORE INTO password_resets (user_id) VALUES (?)', [user.user_id]);
    const [reserved] = await db.query(
      `UPDATE password_resets r JOIN users u ON u.user_id = r.user_id
       SET r.challenge_id = ?, r.code_digest = ?, r.reset_digest = NULL,
           r.channel = 'email', r.destination = ?, r.password_hash_snapshot = u.password_hash,
           r.attempts = 0, r.last_sent_at = NOW(), r.expires_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE)
       WHERE r.user_id = ? AND u.is_active = 1 AND (u.password_hash IS NOT NULL OR u.google_id IS NOT NULL)
         AND BINARY u.email = BINARY ?
         AND (r.last_sent_at IS NULL OR r.last_sent_at <= DATE_SUB(NOW(), INTERVAL 60 SECOND))`,
      [challengeId, codeDigest(challengeId, code), user.destination, user.user_id, user.destination],
    );
    if (reserved.affectedRows) {
      try {
        await sendResetCode(user.destination, code, config);
      } catch (error) {
        console.error('Password reset delivery failed:', error.message);
        await db.query('UPDATE password_resets SET code_digest = NULL WHERE challenge_id = ?', [challengeId]);
      }
    }
  }
  return res.status(202).json({ success: true, challengeId, message: requestMessage });
}

async function verifyCode({ challengeId, code }, res) {
  if (!isToken(challengeId) || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return fail(res, 400, invalidCode);
  }
  const [attempt] = await db.query(
    `UPDATE password_resets SET attempts = attempts + 1
     WHERE challenge_id = ? AND channel = 'email' AND code_digest IS NOT NULL AND attempts < 5 AND expires_at > NOW()`,
    [challengeId],
  );
  if (!attempt.affectedRows) return fail(res, 400, invalidCode);

  const [rows] = await db.query('SELECT code_digest FROM password_resets WHERE challenge_id = ?', [challengeId]);
  const expected = rows[0]?.code_digest;
  const supplied = codeDigest(challengeId, code);
  if (!expected || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return fail(res, 400, invalidCode);
  }
  const resetToken = randomToken();
  const [verified] = await db.query(
    `UPDATE password_resets
     SET code_digest = NULL, reset_digest = ?, expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE)
     WHERE challenge_id = ? AND channel = 'email' AND code_digest = ? AND expires_at > NOW()`,
    [digest(resetToken), challengeId, expected],
  );
  if (!verified.affectedRows) return fail(res, 400, invalidCode);
  return res.json({ success: true, resetToken });
}

async function resetPassword({ challengeId, resetToken, password }, res) {
  if (!isToken(challengeId) || !isToken(resetToken)) return fail(res, 400, invalidReset);
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72) {
    return fail(res, 400, 'Mật khẩu phải có ít nhất 8 ký tự và tối đa 72 byte.');
  }
  const tokenDigest = digest(resetToken);
  const [matches] = await db.query(
    "SELECT user_id FROM password_resets WHERE challenge_id = ? AND channel = 'email' AND reset_digest = ? AND expires_at > NOW()",
    [challengeId, tokenDigest],
  );
  if (!matches.length) return fail(res, 400, invalidReset);
  const passwordHash = await bcrypt.hash(password, 10);
  const [updated] = await db.query(
    `UPDATE users u JOIN password_resets r ON r.user_id = u.user_id
     SET u.password_hash = ?, r.reset_digest = NULL, r.challenge_id = NULL,
         r.destination = NULL, r.password_hash_snapshot = NULL
     WHERE r.challenge_id = ? AND r.channel = 'email' AND r.reset_digest = ? AND r.expires_at > NOW()
       AND u.is_active = 1
       AND (u.password_hash IS NOT NULL OR u.google_id IS NOT NULL)
       AND (BINARY u.password_hash <=> BINARY r.password_hash_snapshot)
       AND BINARY u.email = BINARY r.destination`,
    [passwordHash, challengeId, tokenDigest],
  );
  if (!updated.affectedRows) return fail(res, 400, invalidReset);
  return res.json({ success: true });
}

module.exports = {
  requestCode: endpoint(requestCode),
  verifyCode: endpoint(verifyCode),
  resetPassword: endpoint(resetPassword),
};
