import request from 'supertest';
import { createTestApp } from '../helpers/createTestApp';

jest.mock('../../src/services/brandServices', () => ({
  listBrands: jest.fn((req: any, res: any) => res.status(200).json({ success: true, data: [] })),
  getBrandById: jest.fn((req: any, res: any) => res.status(200).json({ success: true, data: { id: req.params.id } })),
  createBrand: jest.fn((req: any, res: any) => res.status(201).json({ success: true, data: { id: 'new' } })),
  updateBrand: jest.fn((req: any, res: any) => res.status(200).json({ success: true, data: { id: req.params.id } })),
  deleteBrand: jest.fn((req: any, res: any) => res.status(200).json({ success: true, message: 'Brand deleted' })),
  getBrandFollowersCount: jest.fn((req: any, res: any) => res.status(200).json({ success: true, data: { brandId: req.params.id, followersCount: 7 } })),
}));

jest.mock('../../src/api/Auth/middlewares/authenticateJWT', () => ({
  authenticateJWT: () => (req: any, _res: any, next: any) => { req.user = { _id: 'u1', role: 'admin' }; next(); },
}));

describe('Brands API', () => {
  const setup = async () => {
    const router = (await import('../../src/api/brands')).default;
    return createTestApp([{ path: '/', router }]);
  };

  it('GET / returns 200', async () => {
    const app = await setup();
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
  });

  it('GET /:id returns 200', async () => {
    const app = await setup();
    const res = await request(app).get('/b1');
    expect(res.status).toBe(200);
  });

  it('GET /:id/followers-count returns 200', async () => {
    const app = await setup();
    const res = await request(app).get('/b1/followers-count');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data.followersCount');
  });

  it('POST / creates brand', async () => {
    const app = await setup();
    const res = await request(app).post('/').send({ name: 'Brand' });
    expect(res.status).toBe(201);
  });

  it('PATCH /:id updates brand', async () => {
    const app = await setup();
    const res = await request(app).patch('/b1').send({ name: 'New' });
    expect(res.status).toBe(200);
  });

  it('DELETE /:id deletes brand', async () => {
    const app = await setup();
    const res = await request(app).delete('/b1');
    expect(res.status).toBe(200);
  });
});
