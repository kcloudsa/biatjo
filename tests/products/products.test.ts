import request from 'supertest';
import { createTestApp } from '../helpers/createTestApp';

// Mock product services to avoid DB interactions
jest.mock('../../src/services/productServices', () => ({
  listProducts: jest.fn((req: any, res: any) => res.status(200).json({ success: true, data: [] })),
  getProductById: jest.fn((req: any, res: any) => res.status(200).json({ success: true, data: { id: req.params.id } })),
  createProduct: jest.fn((req: any, res: any) => res.status(201).json({ success: true, data: { id: 'new' } })),
  updateProduct: jest.fn((req: any, res: any) => res.status(200).json({ success: true, data: { id: req.params.id, ...req.body } })),
  deleteProduct: jest.fn((req: any, res: any) => res.status(200).json({ success: true, message: 'Product deleted' })),
}));

// Mock JWT middleware to inject a user
jest.mock('../../src/api/Auth/middlewares/authenticateJWT', () => ({
  authenticateJWT: () => (req: any, _res: any, next: any) => {
    req.user = { _id: 'u1', role: 'admin' };
    next();
  },
}));

describe('Products API', () => {
  const setup = async () => {
    const router = (await import('../../src/api/product')).default;
    const app = createTestApp([{ path: '/', router }]);
    return app;
  };

  it('GET / should return 200 and array', async () => {
    const app = await setup();
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /:id should return 200', async () => {
    const app = await setup();
    const res = await request(app).get('/123');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('123');
  });

  it('POST / should create (auth)', async () => {
    const app = await setup();
    const res = await request(app).post('/').send({ title: 'T' });
    expect(res.status).toBe(201);
  });

  it('PATCH /:id should update (auth)', async () => {
    const app = await setup();
    const res = await request(app).patch('/p1').send({ title: 'New' });
    expect(res.status).toBe(200);
  });

  it('DELETE /:id should delete (auth)', async () => {
    const app = await setup();
    const res = await request(app).delete('/p1');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Product deleted');
  });
});
