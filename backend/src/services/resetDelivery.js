const { Resend } = require('resend');

function deliveryConfig() {
  const key = process.env.RESEND_API_KEY?.trim();
  const sender = process.env.RESEND_FROM_EMAIL?.trim() || process.env.RESEND_EMAIL_SENDER?.trim();
  return key && sender ? { key, sender } : null;
}

async function sendResetCode(destination, code, { key, sender }) {
  const resend = new Resend(key);
  const { data, error } = await resend.emails.send({
    from: `SmartKitchen <${sender}>`,
    to: [destination],
    subject: 'Mã xác thực đặt lại mật khẩu SmartKitchen',
    text: [
      'Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản SmartKitchen.',
      `Mã xác thực của bạn: ${code}`,
      'Mã có hiệu lực trong 5 phút và chỉ dùng được một lần. Vui lòng giữ mã này riêng tư.',
      'Nếu bạn không yêu cầu đặt lại mật khẩu, bạn có thể bỏ qua email này.',
    ].join('\n\n'),
  }, { signal: AbortSignal.timeout(8000) });
  if (error || !data?.id) {
    const status = Number.isInteger(error?.statusCode) ? ` (HTTP ${error.statusCode})` : '';
    const message = error?.message ?? '';
    if (/only send testing emails|own email address/i.test(message)) {
      throw new Error('Resend chỉ cho phép gửi thử đến email của tài khoản Resend.');
    }
    if (/domain.*(?:not verified|verify)/i.test(message)) {
      throw new Error('Tên miền gửi email chưa được xác minh trong Resend.');
    }
    throw new Error(`Resend không chấp nhận email OTP${status}`);
  }
}

module.exports = { deliveryConfig, sendResetCode };
