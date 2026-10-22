import request from 'supertest';
import { createTestApp } from '../helpers/createTestApp';

// Mock the apiKey model methods used by the router
jest.mock('../../src/models/apiKeyModel', () => ({
  __esModule: true,
  default: {
    create: jest.fn(async (doc: any) => ({ key: doc.key, label: doc.label })),
    find: jest.fn(async () => [{ userID: 'u1', key: 'k', label: 'lab', active: true, createdAt: new Date() }]),
    updateOne: jest.fn(async () => ({})),
  },
}));

describe('API Key API', () => {
  const setup = async () => {
    const router = (await import('../../src/api/apiKey')).default;
    return createTestApp([{ path: '/', router }]);
  };

  it('POST /create returns 201', async () => {
    const app = await setup();
    const res = await request(app).post('/create').send({ label: 'test', userID: 'u1' });
    expect(res.status).toBe(201);
  });

  it('GET / lists keys', async () => {
    const app = await setup();
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('PATCH /deactivate/:key returns 200', async () => {
    const app = await setup();
    const res = await request(app).patch('/deactivate/abc');
    expect(res.status).toBe(200);
  });

  it('PATCH /activate/:key returns 200', async () => {
    const app = await setup();
    const res = await request(app).patch('/activate/abc');
    expect(res.status).toBe(200);
  });
});
