const { createHmac, randomBytes, timingSafeEqual } = require('node:crypto');

const key = process.env.APP_SESSION_SECRET || randomBytes(32);
const lifetime = 30 * 24 * 60 * 60 * 1000;
const sign = value => createHmac('sha256', key).update(value).digest('hex');

function withAppSession(user) {
  const value = `${user.user_id}.${Date.now() + lifetime}`;
  return { ...user, sessionToken: `${value}.${sign(value)}` };
}

function requireAppSession(req, res, next) {
  const match = /^Bearer (\d+)\.(\d+)\.([a-f0-9]{64})$/.exec(req.get('Authorization') || '');
  if (match) {
    const [, user, expiry, signature] = match;
    const userId = Number(user);
    if (Number.isSafeInteger(userId) && userId > 0 && Number(expiry) > Date.now()
        && timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(sign(`${user}.${expiry}`), 'hex'))) {
      res.locals.userId = userId;
      return next();
    }
  }
  return res.status(401).json({ message: 'Vui lòng đăng nhập lại để tiếp tục.' });
}

module.exports = { withAppSession, requireAppSession };
