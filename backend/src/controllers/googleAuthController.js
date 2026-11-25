const { OAuth2Client } = require('google-auth-library');
const { withAppSession } = require('../services/appSession');
const db = require('../config/db');

const client = new OAuth2Client();

module.exports = async function googleLogin(req, res) {
  const audience = process.env.GOOGLE_WEB_CLIENT_ID?.trim();
  if (!audience || audience.startsWith('YOUR_')) {
    return res.status(503).json({ success: false, message: 'Hãy điền GOOGLE_WEB_CLIENT_ID trong backend/.env rồi khởi động lại backend.' });
  }
  const { idToken } = req.body || {};
  if (typeof idToken !== 'string' || !idToken || idToken.length > 10000) {
    return res.status(400).json({ success: false, message: 'Thiếu Google ID token hợp lệ.' });
  }

  let profile;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience });
    profile = ticket.getPayload();
    if (!profile?.sub || !profile.email || !profile.email_verified) throw new Error('Unverified account');
  } catch {
    return res.status(401).json({ success: false, message: 'Không xác minh được tài khoản Google. Vui lòng đăng nhập lại.' });
  }

  try {
    const [existing] = await db.query(
      'SELECT user_id, full_name, phone, email FROM users WHERE google_id = ? LIMIT 1', [profile.sub],
    );
    let user = existing[0];
    const isNewAccount = !user;
    if (!user) {
      const [matchingEmail] = await db.query('SELECT user_id FROM users WHERE email = ? LIMIT 1', [profile.email]);
      if (matchingEmail.length) {
        return res.status(409).json({ success: false, message: 'Email này đã có tài khoản. Hãy đăng nhập bằng phương thức cũ; chưa hỗ trợ liên kết Google.' });
      }
      const fullName = (profile.name || profile.email.split('@')[0]).slice(0, 100);
      const [result] = await db.query(
        'INSERT INTO users (full_name, email, google_id, avatar_url, created_at) VALUES (?, ?, ?, ?, NOW())',
        [fullName, profile.email, profile.sub, profile.picture || null],
      );
      user = { user_id: result.insertId, full_name: fullName, phone: null, email: profile.email };
    }
    return res.json({ success: true, data: { ...withAppSession(user), isNewAccount }, message: 'Đăng nhập Google thành công' });
  } catch (error) {
    // Another request may have created this Google account concurrently.
    if (error.code === 'ER_DUP_ENTRY') {
      const [rows] = await db.query('SELECT user_id, full_name, phone, email FROM users WHERE google_id = ? LIMIT 1', [profile.sub]);
      if (rows[0]) return res.json({ success: true, data: { ...withAppSession(rows[0]), isNewAccount: false } });
      return res.status(409).json({ success: false, message: 'Email đã được sử dụng bởi tài khoản khác.' });
    }
    console.error('Google login database error:', error.code);
    return res.status(500).json({ success: false, message: 'Không thể đăng nhập Google. Vui lòng kiểm tra cấu hình cơ sở dữ liệu.' });
  }
};
