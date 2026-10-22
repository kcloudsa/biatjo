import request from 'supertest';
import { createTestApp } from '../helpers/createTestApp';

jest.mock('../../src/services/addressServices', () => ({
  listMyAddresses: jest.fn((req: any, res: any) => res.status(200).json({ success: true, data: [] })),
  getMyAddressById: jest.fn((req: any, res: any) => res.status(200).json({ success: true, data: { id: req.params.id } })),
  createMyAddress: jest.fn((req: any, res: any) => res.status(201).json({ success: true, data: { id: 'a1' } })),
  updateMyAddress: jest.fn((req: any, res: any) => res.status(200).json({ success: true })),
  deleteMyAddress: jest.fn((req: any, res: any) => res.status(200).json({ success: true })),
  setDefaultMyAddress: jest.fn((req: any, res: any) => res.status(200).json({ success: true })),
  adminListAddressesByUser: jest.fn((req: any, res: any) => res.status(200).json({ success: true })),
  adminCreateAddressForUser: jest.fn((req: any, res: any) => res.status(201).json({ success: true })),
  adminUpdateAddress: jest.fn((req: any, res: any) => res.status(200).json({ success: true })),
  adminDeleteAddress: jest.fn((req: any, res: any) => res.status(200).json({ success: true })),
}));

jest.mock('../../src/api/Auth/middlewares/authenticateJWT', () => ({
  authenticateJWT: () => (req: any, _res: any, next: any) => { req.user = { _id: 'u1', role: 'admin' }; next(); },
}));

describe('Addresses API', () => {
  const setup = async () => {
    const router = (await import('../../src/api/addresses')).default;
    return createTestApp([{ path: '/', router }]);
  };

  it('GET /me returns 200', async () => {
    const app = await setup();
    const res = await request(app).get('/me');
    expect(res.status).toBe(200);
  });
});
