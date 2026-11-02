import UserModel from '../models/userModel';

/** Error code returned when an action needs a verified email. */
export const EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED';

/** OTP lifetime used by every email verification / reset code. */
export const OTP_TTL_MS = 10 * 60 * 1000;

/** Canonical form used when storing emails. */
export const normalizeEmail = (email: unknown): string =>
  typeof email === 'string' ? email.trim().toLowerCase() : '';

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Mongo filter that matches a user by email, ignoring case and surrounding
 * spaces. Older accounts may store mixed-case emails or use the legacy
 * `contactInfo.email.email` field, so both are checked.
 */
export const emailFilter = (email: unknown) => {
  const normalized = normalizeEmail(email);
  const pattern = { $regex: `^${escapeRegex(normalized)}$`, $options: 'i' };
  return {
    $or: [
      { 'contactInfo.email.value': pattern },
      { 'contactInfo.email.email': pattern },
    ],
  };
};

export const findUserByEmail = async (email: unknown) => {
  if (!normalizeEmail(email)) return null;
  return UserModel.findOne(emailFilter(email));
};

/** The email address stored on the user (falls back to the legacy field). */
export const getStoredEmail = (user: any): string =>
  user?.contactInfo?.email?.value || user?.contactInfo?.email?.email || '';

/**
 * True when the user's email is verified. Accounts without any email record
 * (legacy data) are not blocked, matching the previous login behaviour.
 */
export const isEmailVerified = (user: any): boolean => {
  const emailInfo = user?.contactInfo?.email;
  if (!emailInfo) return true;
  return emailInfo.verified === true;
};

/**
 * Marks the email as verified on a loaded user document (does not save).
 * Used after any action that proves the user controls the inbox:
 * verification OTP, password-reset OTP, password-reset link, Google sign-in.
 */
export const applyEmailVerified = (user: any) => {
  user.contactInfo = user.contactInfo || {};
  user.contactInfo.email = user.contactInfo.email || {};
  if (!user.contactInfo.email.verified) {
    user.contactInfo.email.verified = true;
    user.contactInfo.email.verifiedAt = new Date();
  }
  user.contactInfo.email.verificationCode = null;
  user.contactInfo.email.verificationCodeExpiresAt = null;
  user.isVerified = true;
  return user;
};
