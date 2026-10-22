import request from 'supertest';
import { createTestApp } from '../helpers/createTestApp';

jest.mock('../../src/services/orderServices', () => ({
  listOrders: jest.fn((req: any, res: any) => res.status(200).json({ success: true, data: [] })),
  getOrderById: jest.fn((req: any, res: any) => res.status(200).json({ success: true, data: { id: req.params.id } })),
  createOrder: jest.fn((req: any, res: any) => res.status(201).json({ success: true, data: { id: 'o1' } })),
  updateOrder: jest.fn((req: any, res: any) => res.status(200).json({ success: true })),
  deleteOrder: jest.fn((req: any, res: any) => res.status(200).json({ success: true })),
  addOrderStatus: jest.fn((req: any, res: any) => res.status(200).json({ success: true })),
}));

jest.mock('../../src/api/Auth/middlewares/authenticateJWT', () => ({
  authenticateJWT: () => (req: any, _res: any, next: any) => { req.user = { _id: 'u1', role: 'admin' }; next(); },
}));

describe('Orders API', () => {
  const setup = async () => {
    const router = (await import('../../src/api/orders')).default;
    return createTestApp([{ path: '/', router }]);
  };

  it('GET / returns 200', async () => {
    const app = await setup();
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
  });
});
