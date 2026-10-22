import nodemailer, { Transporter } from 'nodemailer';

const REQUIRED_VARS = ['EMAIL_USER', 'EMAIL_PASS'] as const;

// Basic env validation (non-fatal in development if missing – falls back to JSON transport)
const missing = REQUIRED_VARS.filter((k) => !process.env[k]);
if (missing.length) {
    console.warn(
        `⚠️  Nodemailer: Missing environment variables: ${missing.join(', ')}. ` +
            'Emails will use a JSON transport (logged to console) until these are provided.'
    );
}

// Decide which transport to use
let transporter: Transporter;

if (!missing.length) {
    // Gmail SMTP with App Password
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS, // MUST be an App Password (16 chars)
        },
        // Connection pooling for burst sends
        pool: true,
        maxConnections: 5,
        maxMessages: 50,
    });
} else {
    // Fallback transport that just outputs the message to console (no real sending)
    transporter = nodemailer.createTransport({
        jsonTransport: true,
    });
}

// Run a one-time verification (non-blocking)
(async () => {
    try {
        await transporter.verify();
        console.log('✅ Nodemailer transporter is ready.');
    } catch (err) {
        console.error('❌ Nodemailer transporter verification failed:', err);
    }
})();

export const getMailerUser = () => process.env.EMAIL_USER || 'dev@example.com';
export default transporter;