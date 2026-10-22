// middlewares/socketOptionalAuth.ts
import type { ExtendedError, Socket } from 'socket.io';
import type { NextFunction } from 'express';
import type { PassportStatic } from 'passport';
import { optionalAuthenticateJWT } from '../src/services/historyServices';

type SocketNext = (err?: ExtendedError) => void;
export const socketOptionalAuthenticateJWT =
  (passport: PassportStatic) => (socket: Socket, next: SocketNext) => {
    const req = socket.request as any;
    const res = {} as any;

    // Ensure headers exists
    req.headers = req.headers || {};

    // 1) Prefer Authorization header if client sends it (some do)
    // 2) Otherwise take token from handshake auth (recommended)
    const authHeader = socket.handshake.headers?.authorization as
      | string
      | undefined;
    const tokenFromAuth = socket.handshake.auth?.token as string | undefined;

    if (authHeader) {
      req.headers.authorization = authHeader;
    } else if (tokenFromAuth) {
      req.headers.authorization = `Bearer ${tokenFromAuth}`;
    }
    const expressNext = (err?: any) => {
      if (!err) return next();

      // Socket.IO expects ExtendedError (an Error with optional data)
      const e: ExtendedError =
        err instanceof Error
          ? err
          : Object.assign(new Error(String(err)), { data: err });

      return next(e);
    };
    // Reuse your existing Express middleware
    return optionalAuthenticateJWT(passport)(req, res, expressNext);
  };
