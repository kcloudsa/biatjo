import nodemailer, { Transporter } from 'nodemailer';

export type EmailProvider = 'brevo' | 'gmail' | 'resend' | 'none';

// Read an env var, tolerating values pasted with surrounding quotes (common in hosting dashboards).
export const readEnv = (name: string): string =>
  (process.env[name] ?? '').trim().replace(/^["']|["']$/g, '').trim();

const hasBrevo = Boolean(readEnv('BREVO_API_KEY'));
const hasGmail = Boolean(readEnv('EMAIL_USER') && readEnv('EMAIL_PASS'));
const hasResend = Boolean(readEnv('RESEND_API_KEY'));

const isConfigured: Record<EmailProvider, boolean> = {
  brevo: hasBrevo,
  gmail: hasGmail,
  resend: hasResend,
  none: false,
};

/**
 * Provider selection:
 * - EMAIL_PROVIDER=brevo|gmail|resend forces a provider.
 * - Otherwise: Brevo (HTTPS, no custom domain needed) > Gmail SMTP > Resend (needs a verified domain).
 * Brevo is preferred because hosts such as Railway (Free/Hobby) block outbound SMTP ports.
 */
const resolveProvider = (): EmailProvider => {
  const forced = readEnv('EMAIL_PROVIDER').toLowerCase() as EmailProvider;
  if (forced && forced in isConfigured) {
    if (!isConfigured[forced]) {
      console.warn(
        `EMAIL_PROVIDER=${forced} is set but its credentials are missing; falling back to auto-detection.`,
      );
    } else {
      return forced;
    }
  }
  if (hasBrevo) return 'brevo';
  if (hasGmail) return 'gmail';
  if (hasResend) return 'resend';
  return 'none';
};

export const emailProvider: EmailProvider = resolveProvider();

let transporter: Transporter;

if (emailProvider === 'gmail') {
  const port = Number(readEnv('EMAIL_SMTP_PORT')) || 465;
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: {
      user: readEnv('EMAIL_USER'),
      // Gmail app passwords are shown with spaces; strip them.
      pass: readEnv('EMAIL_PASS').replace(/\s+/g, ''),
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });

  void transporter
    .verify()
    .then(() => console.log(`Email delivery: Gmail SMTP ready (port ${port}).`))
    .catch((error) =>
      console.error(
        'Gmail SMTP verification failed. If this times out in production, your host likely blocks SMTP; use BREVO_API_KEY instead.',
        error,
      ),
    );
} else {
  transporter = nodemailer.createTransport({ jsonTransport: true });
  if (emailProvider === 'none') {
    console.warn(
      'No email provider configured. Set BREVO_API_KEY (recommended), EMAIL_USER + EMAIL_PASS (Gmail SMTP), or RESEND_API_KEY + EMAIL_FROM.',
    );
  } else {
    console.log(`Email delivery: ${emailProvider} HTTP API.`);
  }
}

export const isEmailDeliveryConfigured = () => emailProvider !== 'none';
export const getMailerUser = () => readEnv('EMAIL_USER') || 'dev@example.com';

/** Sender used by HTTP providers: EMAIL_FROM, else "Byatjo <EMAIL_USER>". */
export const getSender = (): { name?: string; email: string } => {
  const raw = readEnv('EMAIL_FROM') || `Byatjo <${getMailerUser()}>`;
  const match = raw.match(/^(.*?)\s*<([^>]+)>$/);
  if (!match) return { email: raw };
  const name = match[1].replace(/^["']|["']$/g, '').trim();
  return { name: name || undefined, email: match[2].trim() };
};

export default transporter;
