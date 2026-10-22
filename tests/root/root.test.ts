import express from 'express';
import request from 'supertest';

describe('API root (router only)', () => {
  it('GET / should respond with API message when mounting API router at /', async () => {
    const apiRouter = (await import('../../src/api')).default;
    const app = express();
    app.use('/', apiRouter);
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('API');
  });
});
