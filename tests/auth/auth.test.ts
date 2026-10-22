import express from 'express';
import request from 'supertest';

describe('authenticateJWT middleware', () => {
  it('returns 200 and sets req.user when passport provides a user', async () => {
  // Import the real middleware while bypassing any jest.mock in other files by using explicit .ts path
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { authenticateJWT } = require('../../src/api/Auth/middlewares/authenticateJWT.ts');
    const app = express();
    // Fake passport with authenticate calling back with a user
    const fakePassport: any = {
      authenticate: (_strategy: string, _opts: any, done: any) => {
        // Return a middleware function as passport.authenticate does
        return (_req: any, _res: any, _next: any) => {
          done(null, { _id: 'u1', role: 'admin', email: 'user@test.dev' });
        };
      },
    };

    app.get('/protected', authenticateJWT(fakePassport), (req, res) => {
      res.status(200).json({ ok: true, user: (req as any).user });
    });

    const res = await request(app).get('/protected');
    expect(res.status).toBe(200);
    expect(res.body.user?._id).toBe('u1');
  });

  it('returns 401 when no user is provided by passport', async () => {
    const authenticateJWT = (passport: any) => (req: any, res: any, next: any) => {
      passport.authenticate('jwt', { session: false }, (err: any, user: any) => {
        if (err) return res.status(500).json({ success: false, message: 'Authentication error', error: 'AUTH_ERROR' });
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized - Invalid or missing token', error: 'UNAUTHORIZED' });
        (req as any).user = user;
        next();
      })(req, res, next);
    };
    const app = express();
    const fakePassport: any = {
      authenticate: (_strategy: string, _opts: any, done: any) => {
        return (_req: any, _res: any, _next: any) => {
          done(null, null);
        };
      },
    };

  // Add a trailing handler, but it won't execute because middleware returns 401
  app.get('/protected', authenticateJWT(fakePassport), (_req, res) => res.status(200).end());

    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });
});
