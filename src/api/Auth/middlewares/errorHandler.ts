import { NextFunction, Request, Response } from 'express';

export const authErrorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  console.error('Auth error:', err);

  if (err.message.includes('Invalid credentials')) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password',
      error: 'INVALID_CREDENTIALS',
    });
  }

  if (err.message.includes('User not found')) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
      error: 'USER_NOT_FOUND',
    });
  }

  return res.status(500).json({
    success: false,
    message: 'Authentication error',
    error: 'AUTH_ERROR',
  });
};
