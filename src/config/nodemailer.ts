import nodemailer, { Transporter } from 'nodemailer';

const hasResend = Boolean(process.env.RESEND_API_KEY);
const hasSmtp = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

let transporter: Transporter;

if (hasSmtp && !hasResend) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 50,
  });
} else {
  transporter = nodemailer.createTransport({ jsonTransport: true });
}

if (hasResend) {
  console.log('Email delivery configured with Resend HTTP API.');
} else if (hasSmtp) {
  void transporter
    .verify()
    .then(() => console.log('Nodemailer SMTP transporter is ready.'))
    .catch((error) =>
      console.error('Nodemailer SMTP transporter verification failed:', error),
    );
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