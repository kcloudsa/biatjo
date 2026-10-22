# byatjo API Server

Modern e-commerce backend built with Express 5, TypeScript, and Mongoose. It provides JWT and OAuth-based authentication, user management, products, brands, categories, collections, carts, orders, reviews, saved items (wishlist), purchased items, addresses, and user history (recently viewed).

## Quick start

Prerequisites:

- Node.js 18+ (or Bun if you prefer) and npm
- A MongoDB connection string

Environment variables (create a .env at project root):

- `.env.example`

Install and run in development:

- `npm install`
- `npm run dev`

Run the tests:

- `npm test`
- `npm run test:watch`

Build and start (production):

- `npm run build`
- `npm start`

## Base URLs

- Health: `GET /`
- Auth: `/auth`
- API: `/api`
- Interactive Swagger UI: `/docs`
- OpenAPI JSON: `/docs.json`

## Documentation

- HTTP actions: [docs/actions.md](docs/actions.md)
- Socket.IO events: [docs/sockets.md](docs/sockets.md)

## API Documentation

The full per-route documentation is organized under the docs/ folder, one file per route:

- `docs/auth` — Authentication (register, OTP, login, refresh, logout, me, Google OAuth)
- `docs/api` — API index and resources
  - `docs/api/apikeys` — API key management
  - `docs/api/brands` — Brand CRUD and queries
  - `docs/api/products` — Product CRUD and queries
  - `docs/api/users` — User read/update, password change
  - `docs/api/saved` — Wishlist
  - `docs/api/reviews` — Reviews
  - `docs/api/cart` — Cart
  - `docs/api/addresses` — Addresses (self and admin)
  - `docs/api/purchased`-items — Purchase snapshots
  - `docs/api/orders` — Orders and status history
  - `docs/api/category` — Category CRUD and tree listing
  - `docs/api/collection` — Collection CRUD (with products)
  - `docs/api/history` — Recently viewed and admin history

Start with `docs/api/GET-index.md` for the API root response.

## Postman collection

An up-to-date collection is available at postman/collection.json with pre-request and test scripts to attach Authorization headers from a saved token.

## Testing

- Framework: Jest + Supertest.
- Strategy: Lightweight router-only tests with mocks/stubs (no MongoDB server required).

## Security

- Helmet, rate-limit, and input sanitizers are enabled (stricter in production).
- JWT-protected routes use Passport (JWT strategy). Optional JWT is used to record recently viewed items for public GETs.
"# Byatjo" 
"# Byatjo" 
