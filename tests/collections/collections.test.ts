import request from 'supertest';
import { createTestApp } from '../helpers/createTestApp';

jest.mock('../../src/services/collectionServices', () => ({
  listCollections: jest.fn((req: any, res: any) => res.status(200).json({ success: true, data: [] })),
  getCollectionById: jest.fn((req: any, res: any) => res.status(200).json({ success: true, data: { id: req.params.id } })),
  createCollection: jest.fn((req: any, res: any) => res.status(201).json({ success: true, data: { id: 'new' } })),
  updateCollection: jest.fn((req: any, res: any) => res.status(200).json({ success: true, data: { id: req.params.id } })),
  deleteCollection: jest.fn((req: any, res: any) => res.status(200).json({ success: true, message: 'Collection deleted' })),
}));

jest.mock('../../src/api/Auth/middlewares/authenticateJWT', () => ({
  authenticateJWT: () => (req: any, _res: any, next: any) => { req.user = { _id: 'u1', role: 'admin' }; next(); },
}));

describe('Collections API', () => {
  const setup = async () => {
    const router = (await import('../../src/api/collection')).default;
    return createTestApp([{ path: '/', router }]);
  };

  it('GET / returns 200', async () => {
    const app = await setup();
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
  });
});
