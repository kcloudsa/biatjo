import express, { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import {
  registerLocalStrategy,
  registerJwtStrategy,
  registerGoogleStrategy,
  isGoogleStrategyEnabled,
  registerSessionSerialization,
} from './strategies';
import { authenticateJWT } from './middlewares';
import {
  registerHandler,
  otpRegisterHandler,
  otpVerifyHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  passwordResetRequestHandler,
  passwordResetValidateHandler,
  passwordResetCompleteHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
  meHandler,
  googleCallbackHandler,
  registerDriverHandler,
  loginDashHandler,
} from './controllers';

const router = express.Router();

// Register strategies and session serialization
registerLocalStrategy(passport);
registerJwtStrategy(passport);
registerGoogleStrategy(passport);
registerSessionSerialization(passport);

// Auth routes
router.post('/register', registerHandler);
router.post('/registerDriver', registerDriverHandler);
router.post('/otp/register', otpRegisterHandler);
router.post('/otp/verify', otpVerifyHandler);
router.post('/forgot-password', forgotPasswordHandler);
router.post('/reset-password', resetPasswordHandler);
router.post('/password-reset/request', passwordResetRequestHandler);
router.post('/password-reset/validate', passwordResetValidateHandler);
router.post('/password-reset/complete', passwordResetCompleteHandler);

router.post('/login', (req, res, next) =>
  loginHandler(req, res, next, passport),
);
router.post('/login/dash', (req, res, next) =>
  loginDashHandler(req, res, next, passport),
);
router.post('/refresh', refreshHandler);
router.post('/logout', logoutHandler);

router.get('/me', authenticateJWT(passport), meHandler);

// Google OAuth routes
router.get(
  '/google',
  (req: Request, res: Response, next: NextFunction) => {
    if (!isGoogleStrategyEnabled()) {
      return res.status(501).json({
        success: false,
        message: 'Google OAuth is not configured or strategy not registered',
        error: 'OAUTH_NOT_CONFIGURED',
      });
    }
    const origin = req.get('Origin') || req.get('Referer');
    req.session = req.session || {};
    (req.session as any).returnUrl = origin;
    next();
  },
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: true,
  }),
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: true }),
  (req: Request, res: Response) => googleCallbackHandler(req, res, passport),
);

// Debug routes guarded in production
const requireNonProduction = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Debug routes are disabled in production',
    });
  }
  next();
};

// import { debugRoutes } from './controllers';
// router.use('/', requireNonProduction, debugRoutes);

// Error handler
import { authErrorHandler } from './middlewares';
router.use(authErrorHandler);

export const AuthAPI = router;
