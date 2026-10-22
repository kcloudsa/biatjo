# Auth module overview

This document explains the modular authentication system under `src/api/Auth`.

## Structure

- `index.ts` — Express Router that wires all strategies, controllers, and middleware
- `strategies.ts` — Passport strategies and session serialization
  - LocalStrategy (email + password)
  - JwtStrategy (protect APIs via Bearer token)
  - GoogleStrategy (OAuth 2.0)
  - Session serialize/deserialize
- `middlewares/`
  - `authenticateJWT.ts` — JWT guard for protected routes
  - `errorHandler.ts` — Centralized error mapping for auth routes
- `controllers/`
  - `authController.ts` — Handlers for register, OTP, password reset (OTP + link), login, refresh, logout, me, Google callback
  - `debugRoutes.ts` — Development-time helpers (disabled in production)

## Data model alignment

User model uses the following canonical fields (see `src/models/userModel.ts`):
- Name fields under `name`:
  - `name.firstName`, `name.lastName`, `name.displayName`
- Contact fields under `contactInfo`:
  - `contactInfo.email.value`, `verified`, `verifiedAt`, `verificationCode`, `verificationCodeExpiresAt`
  - `contactInfo.phone.value`, `countryCode`, `verified`, `verifiedAt`, `verificationCode`, `verificationCodeExpiresAt`
- Password fields under `password`:
  - `password.hashed`, `expirationDate`, `lastChangedAt`

The code gracefully supports legacy shapes (e.g., `userName.*`, `contactInfo.email.email`) where necessary for migration.

## Tokens

- Access token (JWT)
  - Purpose: authorize API calls
  - Transport: returned in JSON body as `token` and `accessToken`
  - Lifetime: short-lived (configured via secret and expiry inside token utils)
  - Header: `Authorization: Bearer <accessToken>`

- Refresh token (opaque string)
  - Purpose: rotate/refresh access tokens
  - Storage: persisted server-side (DB) and sent as httpOnly cookie `refreshToken`
  - Security: `SameSite=Strict`, `Secure` in production, httpOnly
  - Rotation/revocation: supported via `storeRefreshToken` and `deleteRefreshToken`

## Routes

Base path: `/auth`

- POST `/register`
  - Body: either `{ emailOnly: true, email }` to send OTP or full registration payload
  - Full payload example:
    - `name`: `{ firstName, lastName }`
    - `contactInfo.email.value`: string
    - `contactInfo.phone.value`: string
    - `password`: string or `{ hashed | password }`
  - On success: 201 with user summary

- POST `/otp/register`
  - Body: `{ email }`
  - Action: generates OTP, stores on user, sends email

- POST `/otp/verify`
  - Body: `{ email, otp }`
  - Action: checks stored OTP and expiry, sets `verified: true`

- POST `/forgot-password`
  - Body: `{ email }`
  - Action: sends OTP email (basic flow, optional)

- POST `/reset-password`
  - Body: `{ email, otp, newPassword }`
  - Action: validates OTP (stub), updates password, sends change notification

- POST `/password-reset/request`
  - Body: `{ email }`
  - Action: creates a hashed reset token with TTL and low-rate lockout; sends reset link

- POST `/password-reset/validate`
  - Body: `{ email, token }`
  - Action: validates token hash and TTL

- POST `/password-reset/complete`
  - Body: `{ email, token, newPassword }`
  - Action: validates token, sets new password, clears reset meta, sends change email

- POST `/login`
  - Body: `{ email, password }`
  - Action: Passport LocalStrategy; enforces verified email and migrates legacy plaintext passwords to bcrypt
  - Result: returns access token in JSON and sets `refreshToken` cookie

- POST `/refresh`
  - Uses cookie `refreshToken`
  - Action: verifies validity, returns a new access token

- POST `/logout`
  - Action: deletes refresh token record (if any), clears cookie, destroys session

- GET `/me`
  - Guarded by `authenticateJWT`
  - Action: returns the authenticated user summary from JWT

- GET `/google`
  - Starts Google OAuth; stores return URL in session

- GET `/google/callback`
  - Completes OAuth; issues tokens; redirects to frontend callback with `token` query

## Debug routes (non-production only)

Mounted from `controllers/debugRoutes.ts` and disabled when `NODE_ENV === 'production'`:
- GET `/auth/debug/auth-status`
- POST `/auth/migrate-passwords` (requires `ADMIN_SECRET` or dev value)
- POST `/auth/debug/test-password/:email`
- GET `/auth/debug/check-user/:email`
- POST `/auth/debug/reset-password/:email` (dev secret only)

These endpoints are for development and migration only.

## Environment variables

- `ACCESS_TOKEN_SECRET` — JWT secret for access tokens
- `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` — Google OAuth credentials
- `CALLBACK_URI` — Absolute base URL used for OAuth callback (e.g., `https://api.example.com`)
- `FRONTEND_URL` — Frontend base URL (used to build reset links and OAuth redirects)
- `SESSION_SECRET` — Express-session secret
- `SESSION_TTL_SECONDS` — Session TTL in seconds (default 24h if not set)
- `ADMIN_SECRET` — Admin secret for debug migrations
- `NODE_ENV` — `production` enables additional security

Optional (for cookies/CORS depending on your deployment):
- CORS allowlist is defined in `src/app.ts` and can be extended

## Security

- Access token in header; refresh token in httpOnly cookie
- Email must be verified before Local login is allowed (OTP resend if needed)
- Password reset tokens are hashed and time-bound; excessive invalid attempts lock the flow temporarily
- Debug routes are disabled in production

## Error responses

Errors generally follow the shape:
```
{
  success: false,
  message: string,
  error: CODE
}
```

Examples:
- `INVALID_CREDENTIALS` — wrong email/password
- `EMAIL_NOT_VERIFIED` — email not verified
- `NO_REFRESH_TOKEN`, `INVALID_REFRESH_TOKEN` — refresh issues
- `LOCKED`, `TOKEN_EXPIRED`, `INVALID_TOKEN` — reset/link issues

## Extending

- Add new providers by adding a Passport strategy in `strategies.ts`
- Add new auth endpoints in `controllers/authController.ts` and wire in `index.ts`
- For additional state, prefer model hooks when possible (consistent with the rest of the codebase)

---

Last updated: 2025-10-02
