process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'access-secret';
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'refresh-secret';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';
process.env.CALLBACK_URI = process.env.CALLBACK_URI;
process.env.FRONTEND_URL = process.env.FRONTEND_URL;

// For integration tests we will spin up the full app via import when needed.
// DB connection is established by app.ts using DB_URI; tests that hit DB should provide a test DB URI via env before importing app.
