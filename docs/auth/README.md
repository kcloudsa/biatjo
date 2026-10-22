# Auth API

Base: /auth

Routes:
- POST /auth/register
- POST /auth/otp/register
- POST /auth/otp/verify
- POST /auth/forgot-password
- POST /auth/reset-password
- POST /auth/password-reset/request
- POST /auth/password-reset/validate
- POST /auth/password-reset/complete
- POST /auth/login
- POST /auth/refresh
- POST /auth/logout
- GET /auth/me (JWT)
- GET /auth/google
- GET /auth/google/callback

Notes:
- JWT is used for API protection. Some public GETs accept optional JWT to record history.
- Google OAuth can be enabled via environment configuration.
