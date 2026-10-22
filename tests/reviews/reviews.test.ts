import request from 'supertest';
import { createTestApp } from '../helpers/createTestApp';

jest.mock('../../src/services/reviewServices', () => ({
  listReviews: jest.fn((req: any, res: any) => res.status(200).json({ success: true, data: [] })),
  getReviewById: jest.fn((req: any, res: any) => res.status(200).json({ success: true, data: { id: req.params.id } })),
  createReview: jest.fn((req: any, res: any) => res.status(201).json({ success: true, data: { id: 'r1' } })),
  updateReview: jest.fn((req: any, res: any) => res.status(200).json({ success: true })),
  deleteReview: jest.fn((req: any, res: any) => res.status(200).json({ success: true })),
}));

jest.mock('../../src/api/Auth/middlewares/authenticateJWT', () => ({
  authenticateJWT: () => (req: any, _res: any, next: any) => { req.user = { _id: 'u1', role: 'admin' }; next(); },
}));

describe('Reviews API', () => {
  const setup = async () => {
    const router = (await import('../../src/api/reviews')).default;
    return createTestApp([{ path: '/', router }]);
  };

  it('GET / returns 200', async () => {
    const app = await setup();
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
  });
});
