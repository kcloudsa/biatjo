import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import * as middlewares from './middlewares';
import api from './api';
import MessageResponse from './interfaces/MessageResponse';
import DBConnection, { mongoClientPromise } from '../Utils/DBConnection';
import { AuthAPI } from './api/Auth';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import passport from 'passport';
import actionsRouter from '../Routes/actions';
import DriversRouter from './api/Drivers';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './config/swagger';

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// Hide Express signature
app.disable('x-powered-by');

app.get('/docs.json', (_req, res) => res.json(swaggerDocument));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Connect to DB
DBConnection();

// Trust the first proxy (required on Vercel/behind proxies) so req.ip uses X-Forwarded-For
// This also resolves express-rate-limit's ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
app.set('trust proxy', 1);

// Request ID middleware (use incoming X-Request-Id if valid, otherwise generate one)
app.use((req, res, next) => {
  const incoming = req.headers['x-request-id'] as string | undefined;
  const isSafe = incoming && /^[A-Za-z0-9_.\-]{1,64}$/.test(incoming);
  const gen = (() => {
    try {
      const { randomUUID } = require('crypto');
      return randomUUID ? randomUUID() : Math.random().toString(36).slice(2);
    } catch {
      return Math.random().toString(36).slice(2);
    }
  })();
  const reqId = isSafe ? (incoming as string) : gen;
  (req as any).id = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
});

// Morgan logging with request id
imported_morgan_token_id: morgan.token('id', (req: any) => req.id || 'no-id');
const devFormat =
  ':id :method :url :status :res[content-length] - :response-time ms';
const prodFormat =
  ':id :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"';
app.use(morgan(isProd ? prodFormat : devFormat));

// JSON body parsing (stricter in production)
app.use(express.json({ limit: isProd ? '1mb' : '10mb' }));
// Enforce JSON-only for state-changing methods in production
if (isProd) {
  app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const ct = req.headers['content-type'] || '';
      if (!String(ct).toLowerCase().startsWith('application/json')) {
        return res.status(415).json({
          success: false,
          message: 'Content-Type must be application/json',
          code: 'UNSUPPORTED_MEDIA_TYPE',
        });
      }
    }
    next();
  });
}
app.set('case sensitive routing', true);
app.set('strict routing', true);
app.use(cookieParser());
// app.set('trust proxy', true); // legacy note (we set it explicitly above)

// Explicitly handle preflight for all routes
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', req.headers.origin as string);
    res.header(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    );
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token, Cache-Control, Cookie',
    );
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Expose-Headers', 'Set-Cookie, X-CSRF-Token');
    return res.status(200).end();
  }
  next();
});

// Helmet for security headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Adjust based on frontend needs
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // Enable HSTS only in production (helps prevent protocol downgrade attacks)
    hsts: isProd ? { maxAge: 31536000 } : false,
  }),
);

// Enable compression in production
if (isProd) {
  try {
    const compression = require('compression');
    app.use(compression());
  } catch (e) {
    console.warn('compression not available, skipping');
  }
}

// Production-only sanitizers (avoid friction in development)
// Use an in-place sanitizer for query/params/body to avoid assigning to
// read-only properties (some serverless runtimes expose getter-only req.query).
if (isProd) {
  try {
    // Lightweight in-place sanitizer: remove keys that begin with '$' or contain '.'
    // This mirrors the default behavior of express-mongo-sanitize but avoids
    // assigning to `req.query` (which can be getter-only in serverless envs).
    const sanitizeObject = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      for (const key of Object.keys(obj)) {
        // Remove keys that could be used for Mongo query injection
        if (key.startsWith('$') || key.includes('.')) {
          try {
            delete obj[key];
          } catch (_) {
            // ignore if deletion fails (defensive)
          }
          continue;
        }
        // Recurse into nested objects/arrays
        try {
          const val = obj[key];
          if (val && typeof val === 'object') sanitizeObject(val);
        } catch (_) {
          // ignore and continue
        }
      }
    };

    app.use((req, _res, next) => {
      try {
        sanitizeObject((req as any).body);
        sanitizeObject((req as any).params);

        // req.query can be getter-only in some hosts; mutate in-place without reassigning
        const q = (req as any).query;
        if (q && typeof q === 'object') {
          for (const k of Object.keys(q)) {
            if (k.startsWith('$') || k.includes('.')) {
              try {
                delete q[k];
              } catch (_) {
                // ignore
              }
              continue;
            }
            try {
              const v = q[k];
              if (v && typeof v === 'object') sanitizeObject(v);
            } catch (_) {}
          }
        }
      } catch (err) {
        // Never allow sanitizer issues to block requests
        console.warn('Request sanitization failed:', err);
      }
      next();
    });
  } catch (e) {
    console.warn('in-place sanitizer failed, skipping', e);
  }

  // Replace xss-clean with an in-place sanitizer to avoid assigning to req.query
  // (some serverless platforms expose getter-only req.query objects).
  try {
    const escapeHtml = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const sanitizeStrings = (obj: any) => {
      if (obj == null) return;
      if (typeof obj === 'string') return escapeHtml(obj);
      if (typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          try {
            const v = obj[i];
            if (typeof v === 'string') obj[i] = escapeHtml(v);
            else if (typeof v === 'object') sanitizeStrings(v);
          } catch (_) {}
        }
        return obj;
      }
      for (const k of Object.keys(obj)) {
        try {
          const val = obj[k];
          if (typeof val === 'string') obj[k] = escapeHtml(val);
          else if (typeof val === 'object') sanitizeStrings(val);
        } catch (_) {
          // ignore non-writable properties
        }
      }
      return obj;
    };

    app.use((req, _res, next) => {
      try {
        sanitizeStrings((req as any).body);
        sanitizeStrings((req as any).params);

        // Mutate query in-place (do not reassign req.query)
        const q = (req as any).query;
        if (q && typeof q === 'object') {
          for (const key of Object.keys(q)) {
            try {
              const v = q[key];
              if (typeof v === 'string') q[key] = escapeHtml(v);
              else if (typeof v === 'object') sanitizeStrings(v);
            } catch (_) {
              // ignore
            }
          }
        }
      } catch (err) {
        console.warn('XSS sanitization failed:', err);
      }
      next();
    });
  } catch (e) {
    console.warn('in-place xss sanitizer failed, skipping', e);
  }
}

// Rate Limiter
const RATE_LIMIT_WINDOW_MS = Number(
  process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 1000);
if (isProd) {
  const limiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      code: 'GLOBAL_RATE_LIMIT_EXCEEDED',
    },
  });
  app.use(limiter);
}

// Build CORS allowlist (env can extend defaults in production)
const defaultAllowedOrigins = [
  'https://byatjo.shop',
  'https://www.byatjo.shop',
  'https://byatjo-dashboard.vercel.app',
  '*',
];
// Include FRONTEND_URL (commonly set on Vercel) and any ALLOWED_ORIGINS env var
// in a forgiving way (commas, trailing slashes ignored).
const rawEnvOrigins = [
  process.env.ALLOWED_ORIGINS || '',
  process.env.FRONTEND_URL || '',
]
  .filter(Boolean)
  .join(',');
const envAllowedOrigins = rawEnvOrigins
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);
const allowedOrigins = Array.from(
  new Set([...defaultAllowedOrigins, ...envAllowedOrigins]),
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!isProd) {
        // In development, allow requests from any origin to reduce friction
        return callback(null, true);
      }
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(
        new Error('Not allowed by CORS; Get the hell out of here'),
      );
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-CSRF-Token',
      'Cache-Control',
      'Cookie',
    ],
    exposedHeaders: ['Set-Cookie', 'X-CSRF-Token'],
    optionsSuccessStatus: 200,
  }),
);

// Add session middleware for OAuth state management
// Configure session store backed by MongoDB so sessions survive server restarts
const sessionTtlSeconds = Number(
  process.env.SESSION_TTL_SECONDS || 24 * 60 * 60 * 15,
); // default 24h
app.use(
  session({
    name: 'sid',
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    proxy: isProd, // trust proxy for secure cookies when behind a proxy
    store: MongoStore.create({
      clientPromise: mongoClientPromise(),
      ttl: sessionTtlSeconds,
      stringify: false,
      autoRemove: 'native',
    }),
    cookie: {
      secure: isProd,
      httpOnly: true,
      // For cross-site requests from the browser (frontend hosted on a different
      // domain), SameSite must be 'none' and Secure must be true. In development
      // keep 'lax' to avoid changing local workflows.
      sameSite: isProd ? 'none' : 'lax',
      maxAge: sessionTtlSeconds * 1000,
    },
  }),
);

// Initialize Passport and restore authentication state from session
app.use(passport.initialize());
app.use(passport.session());

// Health check (GET / and GET /health)
const buildHealthPayload = async () => {
  const startedAt = new Date(
    Date.now() - Math.floor(process.uptime() * 1000),
  ).toISOString();
  const nowIso = new Date().toISOString();

  // Database check (Mongoose + ping)
  const dbStateMap: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  const dbReadyState = mongoose.connection.readyState;
  let dbPingMs: number | undefined;
  let dbOk = false;
  try {
    const t0 = Date.now();
    if (mongoose.connection.db) {
      await mongoose.connection.db.admin().command({ ping: 1 });
      dbPingMs = Date.now() - t0;
      dbOk = true;
    } else {
      dbOk = false;
    }
  } catch {
    dbOk = false;
  }

  // Session store check (MongoStore client)
  let sessionPingMs: number | undefined;
  let sessionOk = false;
  try {
    const t0 = Date.now();
    const mongoClient = await mongoClientPromise();
    await mongoClient.db().admin().ping();
    sessionPingMs = Date.now() - t0;
    sessionOk = true;
  } catch {
    sessionOk = false;
  }

  const overallOk = dbOk && sessionOk;
  const payload = {
    status: overallOk ? 'ok' : 'error',
    timestamp: nowIso,
    uptimeSec: Math.round(process.uptime()),
    startedAt,
    environment: process.env.NODE_ENV || 'development',
    version:
      process.env.APP_VERSION || process.env.npm_package_version || undefined,
    dependencies: {
      database: {
        status: dbOk ? 'up' : 'down',
        state: dbStateMap[dbReadyState] || String(dbReadyState),
        pingMs: dbPingMs,
      },
      sessionStore: {
        status: sessionOk ? 'up' : 'down',
        pingMs: sessionPingMs,
      },
    },
  };

  return { payload, overallOk };
};

app.get('/', async (req, res) => {
  try {
    const { payload, overallOk } = await buildHealthPayload();
    res.status(overallOk ? 200 : 503).json(payload);
  } catch (err) {
    console.error('Health check failed:', err);
    res.status(500).json({ status: 'error', message: 'Health check failed' });
  }
});

// Alias /health (GET + HEAD)
app.get('/health', async (req, res) => {
  try {
    const { payload, overallOk } = await buildHealthPayload();
    res.status(overallOk ? 200 : 503).json(payload);
  } catch (err) {
    console.error('Health check failed (alias):', err);
    res.status(500).json({ status: 'error', message: 'Health check failed' });
  }
});

app.head('/health', async (_req, res) => {
  // Run the same checks used by GET / to decide status code only
  let dbOk = false;
  try {
    if (mongoose.connection.db) {
      await mongoose.connection.db.admin().command({ ping: 1 });
      dbOk = true;
    }
  } catch {}
  let sessionOk = false;
  try {
    const mongoClient = await mongoClientPromise();
    await mongoClient.db().admin().ping();
    sessionOk = true;
  } catch {}
  res.status(dbOk && sessionOk ? 200 : 503).end();
});

// Dynamic sitemap.xml generation
app.get('/sitemap.xml', async (req, res) => {
  try {
    const baseUrlEnv = process.env.FRONTEND_URL;
    // Ensure no trailing slash
    const BASE_URL = baseUrlEnv?.replace(/\/$/, '');

    // Static public routes (extend if new marketing pages are added)
    interface SitemapRoute {
      path: string;
      changefreq: string;
      priority: number;
      lastmod?: string;
    }
    const staticRoutes: SitemapRoute[] = [
      { path: '/', changefreq: 'daily', priority: 1.0 },
      { path: '/login', changefreq: 'monthly', priority: 0.4 },
    ];

    const today = new Date().toISOString().split('T')[0];
    const languages = [
      { code: 'en-US', hrefLang: 'en-US' },
      { code: 'ar-SA', hrefLang: 'ar-SA' },
      { code: 'x-default', hrefLang: 'x-default' },
    ];

    const urlsXml = staticRoutes
      // .concat(dynamicUnitRoutes)
      .map((route) => {
        const loc = `${BASE_URL}${route.path}`;
        const lastmod = route.lastmod || today;
        const alternates = languages
          .map(
            (l) =>
              `    <xhtml:link rel="alternate" hreflang="${l.hrefLang}" href="${loc}" />`,
          )
          .join('\n');
        return `  <url>\n    <loc>${loc}</loc>\n${alternates}\n    <changefreq>${route.changefreq}</changefreq>\n    <priority>${route.priority}</priority>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urlsXml}\n</urlset>`;

    res.header('Content-Type', 'application/xml');
    // Cache sitemap for 12 hours
    res.header('Cache-Control', 'public, max-age=43200');
    return res.status(200).send(xml);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return res.status(500).send('<!-- sitemap generation error -->');
  }
});

// API routes
app.use('/auth', AuthAPI);
app.use('/api/auth', AuthAPI);
app.use('/api', api);
app.use('/api', actionsRouter);
app.use('/api', DriversRouter);
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found or incorrect casing.' });
});

// 404 and error handler
app.use(middlewares.notFound);
app.use(middlewares.errorHandler);

export default app;
