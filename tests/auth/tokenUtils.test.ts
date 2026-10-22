import { generateAccessToken, verifyAccessToken } from '../../src/Utils/tokenUtils';

describe('tokenUtils', () => {
  it('generates and verifies an access token', () => {
    const token = generateAccessToken({ id: 'u1', email: 'u@test.dev', name: 'U', role: 'admin' });
    const payload = verifyAccessToken(token);
    expect(payload.id).toBe('u1');
    expect(payload.email).toBe('u@test.dev');
  });
});
