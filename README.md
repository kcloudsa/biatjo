# Byatjo API Server

Byatjo is a TypeScript + Express backend for a mobile/web commerce and transportation platform. The service exposes an API for user authentication, profile management, saved items, reviews, driver operations, search, and analytics.

## Stack

- Node.js 18+
- TypeScript
- Express 5
- MongoDB + Mongoose
- Passport.js
- JWT auth with refresh tokens
- Google OAuth
- Socket.IO

## Project structure

```text
src/
  api/
    Auth/
    users/
    search/
    analytics/
  models/
  services/
  utils/
  interfaces/
  middlewares/
api/
  index.ts
docs/
  auth/
  actions.md
  sockets.md
tests/
README.md
```

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root with the required variables:

```bash
PORT=3001
DB_URI=mongodb://localhost:27017/byatjo
JWT_SECRET=your_jwt_secret
ACCESS_TOKEN_SECRET=your_access_secret
REFRESH_TOKEN_SECRET=your_refresh_secret
SESSION_SECRET=your_session_secret
AUTH_GOOGLE_ID=your_google_client_id
AUTH_GOOGLE_SECRET=your_google_client_secret
FRONTEND_URL=http://localhost:5173
EMAIL_USER=your.address@gmail.com
EMAIL_PASS=your_gmail_app_password
BREVO_API_KEY=xkeysib-your_brevo_key
```

Email providers are picked in this order: Brevo (`BREVO_API_KEY`), Gmail SMTP (`EMAIL_USER` + `EMAIL_PASS`), then Resend (`RESEND_API_KEY` + `EMAIL_FROM`). Set `EMAIL_PROVIDER=brevo|gmail|resend` to force one.

- **Production on Railway (no custom domain):** Railway's Free/Hobby plans block outbound SMTP, so Gmail SMTP times out there. Create a free Brevo account, verify your Gmail address under *Senders*, create an API key under *SMTP & API*, and set `BREVO_API_KEY` and `EMAIL_USER` (used as the sender unless `EMAIL_FROM` is set) in the service Variables.
- **Gmail SMTP:** works locally and on hosts that allow SMTP. Enable 2-Step Verification and use a 16-character App Password as `EMAIL_PASS`. Set `EMAIL_SMTP_PORT=587` if port 465 is blocked.
- **Resend:** only delivers to arbitrary recipients after you verify a domain you own.

See [docs/email.md](docs/email.md) for the full setup, Railway deployment steps, the endpoints that send email, and troubleshooting.

3. Start the development server:

```bash
npm run dev
```

4. Production build:

```bash
npm run build
npm start
```

## Base URLs

- Health: `GET /`
- Auth API: `/auth`
- Main API: `/api`
- Swagger UI: `/docs`
- Swagger JSON: `/docs.json`

## Documentation

- Authentication reference: [docs/auth/README.md](docs/auth/README.md)
- HTTP actions: [docs/actions.md](docs/actions.md)
- Socket events: [docs/sockets.md](docs/sockets.md)

## Example auth flow

### Register

```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "userName": {"firstName": "Ahmed", "lastName": "Elasmar"},
    "contactInfo": {
      "email": {"email": "ahmed@example.com"},
      "phone": {"phoneNumber": "+218912345678"}
    },
    "password": "StrongPassword123!",
    "userInfo": {"gender": "male", "nationality": "Libya"}
  }'
```

### Login

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ahmed@example.com",
    "password": "StrongPassword123!"
  }'
```

### Protected request

```bash
curl http://localhost:3001/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### Refresh token

```bash
curl -X POST http://localhost:3001/auth/refresh \
  -H "Cookie: refreshToken=<REFRESH_TOKEN>"
```

### Forgot password with OTP

```bash
curl -X POST http://localhost:3001/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ahmed@example.com"
  }'
```

Then reset the password using the OTP returned by email:

```bash
curl -X POST http://localhost:3001/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ahmed@example.com",
    "otp": "123456",
    "newPassword": "NewSecurePassword123!"
  }'
```

## API conventions

- Successful requests return `{ "success": true, ... }`
- Errors return `{ "success": false, "message": "...", "error": "..." }`
- Access tokens are sent in the `Authorization: Bearer <token>` header
- Refresh tokens are usually sent via cookie and stored server-side

## Security notes

- JWT-protected routes use Passport middleware
- Refresh tokens are revoked on logout
- Google OAuth is optional and enabled by configuration
- Session/cookie settings are stricter in production

## Testing

```bash
npm test
npm run test:watch
```

The project includes Jest and Supertest-based router tests.
