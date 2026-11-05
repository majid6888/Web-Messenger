import nodemailer, { type Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

// Initialize email transporter using environment variables or fallback test transport
export async function getEmailTransporter(): Promise<Transporter> {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

  if (user && pass) {
    if (user.toLowerCase().endsWith('@gmail.com') || process.env.GMAIL_USER) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      });
      console.log('[Email] Configured Gmail service transport for account:', user);
    } else if (host) {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      console.log('[Email] Configured SMTP transport with host:', host, 'port:', port);
    }
  }

  if (!transporter) {
    // Development fallback transporter
    transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true,
    });
    console.log('[Email] No external SMTP credentials configured in environment. Using stream transport (OTPs logged to console).');
  }

  return transporter;
}

export interface SendOtpOptions {
  to: string;
  code: string;
  purpose: 'login' | 'register' | 'recovery';
}

export async function sendOtpEmail(options: SendOtpOptions): Promise<{ success: boolean; previewUrl?: string }> {
  const { to, code, purpose } = options;
  const configuredUser = process.env.SMTP_USER || process.env.GMAIL_USER;
  const from = process.env.SMTP_FROM || (configuredUser ? `Web Messenger <${configuredUser}>` : 'Web Messenger <auth@webmessenger.app>');

  const subjectMap = {
    login: `${code} is your Web Messenger login code`,
    register: `${code} is your Web Messenger verification code`,
    recovery: `${code} is your Web Messenger account access code`,
  };

  const titleMap = {
    login: 'Sign In to Web Messenger',
    register: 'Verify your email address',
    recovery: 'Account Access Code',
  };

  const subject = subjectMap[purpose] || `${code} is your Web Messenger code`;
  const title = titleMap[purpose] || 'Your Web Messenger Code';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .logo { width: 44px; height: 44px; background: linear-gradient(135deg, #4f46e5, #4338ca); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; color: #ffffff; font-weight: bold; font-size: 20px; line-height: 44px; text-align: center; }
    h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 8px; }
    p { font-size: 14px; color: #475569; line-height: 1.5; margin: 0 0 16px; }
    .code-box { background: #f1f5f9; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 16px; text-align: center; margin: 24px 0; }
    .code { font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #4338ca; }
    .footer { font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">💬</div>
    <h1>${title}</h1>
    <p>Use the 6-digit code below to complete your authentication with Web Messenger. This code will expire in <strong>10 minutes</strong>.</p>
    <div class="code-box">
      <div class="code">${code}</div>
    </div>
    <p style="font-size: 13px; color: #64748b;">If you did not request this verification code, please ignore this email. Never share this code with anyone.</p>
    <div class="footer">
      Web Messenger Security • Automated Authentication Service
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Your Web Messenger code is: ${code}

Use this code to complete your ${purpose} request.
This code expires in 10 minutes.

If you did not request this code, you can safely ignore this email.
Never share your verification code with anyone.
  `.trim();

  try {
    const client = await getEmailTransporter();
    const info = await client.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });

    console.log(`[Email] OTP email sent to ${to} for ${purpose}. MessageId:`, info.messageId || 'local-stream');
    console.log(`[Email][DEV-SECURITY-NOTICE] OTP Code for ${to}: >>> ${code} <<<`);

    return { success: true };
  } catch (err: any) {
    console.error('[Email] Failed to send email:', err);
    // Even if sending failed over SMTP, log the code in console for development inspection
    console.log(`[Email][BACKUP-DEV-NOTICE] OTP Code for ${to}: >>> ${code} <<<`);
    return { success: false };
  }
}
