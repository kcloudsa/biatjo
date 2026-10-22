import { NextFunction, Request, Response } from 'express';
import { PassportStatic } from 'passport';

export const authenticateJWT =
  (passport: PassportStatic) =>
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('jwt', { session: false }, (err: any, user: any) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Authentication error',
          error: 'AUTH_ERROR',
        });
      }
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized - Invalid or missing token',
          error: 'UNAUTHORIZED',
        });
      }
      (req as any).user = user;
      next();
    })(req, res, next);
  };
