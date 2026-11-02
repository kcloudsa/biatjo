import type { ExtendedError, Socket } from 'socket.io';
import UserModel from '../models/userModel';
import { verifyAccessToken } from '../../Utils/tokenUtils';
import { EMAIL_NOT_VERIFIED, isEmailVerified } from '../lib/emailVerification';

/**
 * Socket identity
 * ---------------
 * A socket gets an identity in one of two ways:
 *  1. Access token in the handshake (recommended):
 *       io(URL, { auth: { token: '<accessToken>' } })
 *     or an `Authorization: Bearer <token>` header.
 *  2. Legacy `user:identify` event with `{ userId, role }`.
 *
 * Every action checks that the socket has an identity, that the user's email
 * is verified, and that ids sent in the payload (riderId, driverId, userId)
 * belong to that identity.
 *
 * Set SOCKET_REQUIRE_AUTH=true to refuse connections without a valid token.
 * Leave it unset while mobile clients are still being updated.
 */

type SocketNext = (err?: ExtendedError) => void;
type Ack = ((res: any) => void) | undefined;

export const SOCKET_ERRORS = {
  NOT_IDENTIFIED: 'NOT_IDENTIFIED',
  NOT_ALLOWED: 'NOT_ALLOWED',
  EMAIL_NOT_VERIFIED,
} as const;

export const socketAuthRequired = () =>
  String(process.env.SOCKET_REQUIRE_AUTH || '').toLowerCase() === 'true';

const tokenFromHandshake = (socket: Socket): string | undefined => {
  const fromAuth = socket.handshake.auth?.token;
  if (typeof fromAuth === 'string' && fromAuth) {
    return fromAuth.replace(/^Bearer\s+/i, '');
  }
  const header = socket.handshake.headers?.authorization;
  if (typeof header === 'string' && /^Bearer\s+/i.test(header)) {
    return header.replace(/^Bearer\s+/i, '');
  }
  return undefined;
};

const reject = (next: SocketNext, code: string, message: string) => {
  const err = new Error(message) as ExtendedError;
  err.data = { code, message };
  next(err);
};

/** Loads a user and checks it may use real-time features. */
export const loadActiveVerifiedUser = async (userId: string) => {
  const user: any = await UserModel.findOne({ userID: userId }).lean();
  if (!user) return { error: 'User not found', code: SOCKET_ERRORS.NOT_IDENTIFIED };
  if (user.active === false)
    return { error: 'Account is disabled', code: SOCKET_ERRORS.NOT_ALLOWED };
  if (!isEmailVerified(user))
    return {
      error: 'Email is not verified',
      code: SOCKET_ERRORS.EMAIL_NOT_VERIFIED,
    };
  return { user };
};

/** Socket.IO middleware: binds the identity from the access token, if any. */
export const socketAuthMiddleware = async (socket: Socket, next: SocketNext) => {
  try {
    const token = tokenFromHandshake(socket);
    if (!token) {
      if (socketAuthRequired())
        return reject(next, 'UNAUTHORIZED', 'Access token is required');
      return next(); // legacy: identify later with user:identify
    }

    let payload: any;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return reject(next, 'UNAUTHORIZED', 'Invalid or expired access token');
    }

    const result = await loadActiveVerifiedUser(payload?.id);
    if (!result.user)
      return reject(next, result.code || 'UNAUTHORIZED', result.error || 'Not allowed');

    socket.data.userId = result.user.userID;
    socket.data.accountRole = result.user.role;
    socket.data.authenticated = true;
    return next();
  } catch (err) {
    console.error('Socket auth error:', err);
    return reject(next, 'AUTH_ERROR', 'Authentication error');
  }
};

const fail = (cb: Ack, error: string, code: string) => {
  cb?.({ success: false, error, err: error, code });
  return null;
};

/**
 * Returns the socket's user id, or answers the callback with an error and
 * returns null. `ids` are payload ids that must equal the socket's user.
 */
export const requireIdentity = (
  socket: Socket,
  cb: Ack,
  ...ids: (string | undefined | null)[]
): string | null => {
  const me = socket.data?.userId as string | undefined;
  if (!me)
    return fail(
      cb,
      'Not identified. Connect with an access token or send user:identify first.',
      SOCKET_ERRORS.NOT_IDENTIFIED,
    );
  for (const id of ids) {
    if (id !== undefined && id !== null && id !== '' && String(id) !== me)
      return fail(
        cb,
        'Not allowed to act for another user',
        SOCKET_ERRORS.NOT_ALLOWED,
      );
  }
  return me;
};

/** Answers the callback with a NOT_ALLOWED error. */
export const notAllowed = (cb: Ack, message = 'Not allowed for this trip') =>
  fail(cb, message, SOCKET_ERRORS.NOT_ALLOWED);
