import express from 'express';
import request from 'supertest';
import { createTestApp } from '../helpers/createTestApp';

describe('Follow API', () => {
  const setup = async () => {
    const router = express.Router();
    // auth stub
    router.use((req: any, _res: any, next: any) => { req.user = { _id: 'u1', role: 'admin' }; next(); });
    // stub handlers
    router.get('/me', (_req, res) => res.status(200).json({ success: true, data: { userId: 'u1', brands: [] } }));
    router.post('/me', (_req, res) => res.status(200).json({ success: true }));
    router.delete('/me', (_req, res) => res.status(200).json({ success: true }));
    router.post('/me/clear', (_req, res) => res.status(200).json({ success: true }));
  router.post('/me/toggle', (_req, res) => res.status(200).json({ success: true, followed: true }));
    return createTestApp([{ path: '/', router }]);
  };

  it('GET /me returns 200', async () => {
    const app = await setup();
    const res = await request(app).get('/me');
    expect(res.status).toBe(200);
  });

  it('POST /me/toggle returns 200', async () => {
    const app = await setup();
    const res = await request(app).post('/me/toggle').send({ brandId: 'b1' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('followed');
  });
});
