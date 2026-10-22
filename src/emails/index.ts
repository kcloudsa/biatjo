import transporter, { getMailerUser } from '../config/nodemailer';

// Generic type for send result (can be nodemailer response or logged JSON transport)
interface SendResult {
  messageId?: string;
  accepted?: string[];
  rejected?: string[];
  response?: string;
  previewURL?: string;
  [key: string]: any; // allow additional nodemailer fields
}

// Helper to build a base HTML email wrapper
const buildEmailWrapper = (title: string, contentHtml: string): string => {
  return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>${title}</title>
		<style>
			:root { color-scheme: light dark; }
			body { margin:0; padding:0; background:#f5f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', Arial, sans-serif; }
			.container { width:100%; padding:24px 12px; box-sizing:border-box; }
			.card { max-width:560px; margin:0 auto; background:#ffffff; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.06); overflow:hidden; border:1px solid #e6ecf1; }
			.header { background:linear-gradient(135deg,#2563eb,#3b82f6); padding:20px 28px; color:#fff; }
			.header h1 { margin:0; font-size:20px; font-weight:600; }
			.content { padding:28px; color:#334155; line-height:1.5; font-size:15px; }
			h2 { font-size:18px; margin:0 0 12px; color:#0f172a; }
			p { margin:0 0 16px; }
			.otp { font-size:32px; letter-spacing:6px; font-weight:700; color:#1d4ed8; background:#eff6ff; padding:16px 24px; text-align:center; border-radius:10px; border:1px solid #dbeafe; font-family:'SFMono-Regular',Menlo,Monaco,'Courier New',monospace; }
			.button { display:inline-block; background:#dc2626; color:#fff !important; padding:14px 22px; border-radius:8px; text-decoration:none; font-weight:600; letter-spacing:0.4px; box-shadow:0 2px 6px rgba(220,38,38,0.4); }
			.button:hover { background:#b91c1c; }
			.footer { padding:18px 28px; font-size:12px; color:#64748b; background:#f1f5f9; text-align:center; }
			@media (max-width:620px){ .content { padding:20px; } .header, .footer { padding:18px 20px; } .otp { font-size:28px; } }
		</style>
	</head>
	<body>
		<div class="container">
			<div class="card">
				<div class="header"><h1>${title}</h1></div>
				<div class="content">${contentHtml}</div>
				<div class="footer">This is an automated message. If you did not initiate this request, you can safely ignore this email.</div>
			</div>
		</div>
	</body>
	</html>`;
};

// Internal core send function
const sendEmail = async (
  to: string,
  subject: string,
  html: string,
): Promise<SendResult | null> => {
  try {
    const result = await transporter.sendMail({
      from: `Byatjo <${getMailerUser()}>`,
      to,
      subject,
      html,
    });
    return result as SendResult;
  } catch (err) {
    console.error(`Email send failed (${subject}) to ${to}:`, err);
    return null;
  }
};

// 6-digit OTP generator (exported for router usage if desired)
export const generateOTP = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

// Public email functions
export const sendVerificationEmail = async (to: string, otp: string) => {
  const subject = 'Verify Your Email Address';
  const html = buildEmailWrapper(
    'Email Verification',
    `<h2>Welcome!</h2>
		 <p>Use the following one-time verification code to complete your registration. This code will expire in <strong>10 minutes</strong>.</p>
		 <div class="otp">${otp}</div>
		 <p>If you did not create an account, please ignore this email.</p>`,
  );
  return sendEmail(to, subject, html);
};

export const sendPasswordResetEmail = async (to: string, otp: string) => {
  const subject = 'Your Password Reset Code';
  const html = buildEmailWrapper(
    'Password Reset Request',
    `<h2>Password Reset Requested</h2>
		 <p>We received a request to reset the password for your account.</p>
		 <p>Use the following one-time code to proceed. It expires in <strong>10 minutes</strong>.</p>
		 <div class="otp">${otp}</div>
		 <p>If you did <strong>not</strong> request this change, you can safely ignore this email and your password will remain the same.</p>`,
  );
  return sendEmail(to, subject, html);
};

export const sendPasswordChangeNotificationEmail = async (to: string) => {
  const subject = 'Your Password Has Been Changed';
  const html = buildEmailWrapper(
    'Password Updated',
    `<h2>Password Changed Successfully</h2>
		 <p>The password for your account was recently changed. If this was you, no further action is required.</p>
		 <p>If you did <strong>not</strong> perform this change, please secure your account immediately.</p>
		 <p style="text-align:center; margin:32px 0;">
			 <a href="http://yourfrontend.com/forgot-password" class="button">I didn't do this</a>
		 </p>`,
  );
  return sendEmail(to, subject, html);
};

export const sendPasswordResetLinkEmail = async (
  to: string,
  resetLink: string,
) => {
  const subject = 'Reset Your Password';
  const html = buildEmailWrapper(
    'Password Reset',
    `<h2>Reset Your Password</h2>
		 <p>You requested to reset your password. Click the button below to choose a new one. This link will expire in <strong>30 minutes</strong>.</p>
		 <p style="text-align:center; margin:32px 0;">
			 <a href="${resetLink}" class="button" style="background:#2563eb; box-shadow:0 2px 6px rgba(37,99,235,0.4);">Reset Password</a>
		 </p>
		 <p>If you did not request this, you can ignore this email and your password will remain unchanged.</p>`,
  );
  return sendEmail(to, subject, html);
};

export default {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangeNotificationEmail,
  sendPasswordResetLinkEmail,
  generateOTP,
};
