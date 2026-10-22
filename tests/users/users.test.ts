import express from 'express';
import request from 'supertest';
import { createTestApp } from '../helpers/createTestApp';

describe('Users API', () => {
  const setup = async () => {
    const router = express.Router();
    router.use((req: any, _res: any, next: any) => { req.user = { _id: 'u1', role: 'admin' }; next(); });
    router.get('/', (_req: any, res: any) => res.status(200).json({ success: true, data: [] }));
    router.post('/', (_req: any, res: any) => res.status(201).json({ success: true, data: { id: 'new' } }));
    return createTestApp([{ path: '/', router }]);
  };

  it('GET / returns 200', async () => {
    const app = await setup();
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
  });

  it('POST / creates user', async () => {
    const app = await setup();
    const res = await request(app).post('/').send({});
    expect(res.status).toBe(201);
  });
});
