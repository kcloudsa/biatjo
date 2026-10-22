import request from 'supertest';
import { createTestApp } from '../helpers/createTestApp';

jest.mock('../../src/services/categoryServices', () => ({
  listCategories: jest.fn((req: any, res: any) => res.status(200).json({ success: true, data: [] })),
  getCategoryById: jest.fn((req: any, res: any) => res.status(200).json({ success: true, data: { id: req.params.id } })),
  createCategory: jest.fn((req: any, res: any) => res.status(201).json({ success: true, data: { id: 'new' } })),
  updateCategory: jest.fn((req: any, res: any) => res.status(200).json({ success: true, data: { id: req.params.id } })),
  deleteCategory: jest.fn((req: any, res: any) => res.status(200).json({ success: true, message: 'Category deleted' })),
}));

jest.mock('../../src/api/Auth/middlewares/authenticateJWT', () => ({
  authenticateJWT: () => (req: any, _res: any, next: any) => { req.user = { _id: 'u1', role: 'admin' }; next(); },
}));

describe('Categories API', () => {
  const setup = async () => {
    const router = (await import('../../src/api/category')).default;
    return createTestApp([{ path: '/', router }]);
  };

  it('GET / returns 200', async () => {
    const app = await setup();
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
  });

  it('POST / creates category', async () => {
    const app = await setup();
    const res = await request(app).post('/').send({ name: 'Cat' });
    expect(res.status).toBe(201);
  });
});
