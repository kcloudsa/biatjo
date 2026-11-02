import nodemailer, { Transporter } from 'nodemailer';

const hasResend = Boolean(process.env.RESEND_API_KEY);
const hasSmtp = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
const useGmailSmtp = hasSmtp && !hasResend;

let transporter: Transporter;

if (useGmailSmtp) {
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS?.replace(/\s+/g, ''),
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 50,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
} else {
  transporter = nodemailer.createTransport({ jsonTransport: true });
}

if (useGmailSmtp) {
  void transporter
    .verify()
    .then(() => console.log('Gmail SMTP email delivery is ready.'))
    .catch((error) =>
      console.error('Gmail SMTP transporter verification failed:', error),
    );
} else if (hasResend) {
  console.log('Email delivery configured with Resend HTTP API.');
} else {
  console.warn(
    process.env.NODE_ENV === 'production'
      ? 'No email provider configured. Production email delivery requires RESEND_API_KEY and EMAIL_FROM, or EMAIL_USER and EMAIL_PASS.'
      : 'No real email provider configured. Development uses a JSON transport; configure RESEND_API_KEY or EMAIL_USER and EMAIL_PASS.',
  );
}

export const isEmailDeliveryConfigured = () => hasResend || hasSmtp;
export const getMailerUser = () => process.env.EMAIL_USER || 'dev@example.com';
export default transporter;