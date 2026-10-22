import request from 'supertest';
import { createTestApp } from '../helpers/createTestApp';

jest.mock('../../src/services/cartServices', () => ({
  getMyCart: jest.fn((req: any, res: any) => res.status(200).json({ success: true, data: { items: [] } })),
  addOrUpdateItemMyCart: jest.fn((req: any, res: any) => res.status(200).json({ success: true })),
  removeItemMyCart: jest.fn((req: any, res: any) => res.status(200).json({ success: true })),
  clearMyCart: jest.fn((req: any, res: any) => res.status(200).json({ success: true })),
  incrementKeyQtyMyCart: jest.fn((req: any, res: any) => res.status(200).json({ success: true })),
  setKeyQtyMyCart: jest.fn((req: any, res: any) => res.status(200).json({ success: true })),
  adminGetCartByUser: jest.fn((req: any, res: any) => res.status(200).json({ success: true })),
  adminClearCartByUser: jest.fn((req: any, res: any) => res.status(200).json({ success: true })),
}));

jest.mock('../../src/api/Auth/middlewares/authenticateJWT', () => ({
  authenticateJWT: () => (req: any, _res: any, next: any) => { req.user = { _id: 'u1', role: 'admin' }; next(); },
}));

describe('Cart API', () => {
  const setup = async () => {
    const router = (await import('../../src/api/cart')).default;
    return createTestApp([{ path: '/', router }]);
  };

  it('GET /me returns 200', async () => {
    const app = await setup();
    const res = await request(app).get('/me');
    expect(res.status).toBe(200);
  });
});
