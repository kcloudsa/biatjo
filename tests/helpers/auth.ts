import request from 'supertest';
import { getApp } from './testDb';

export const registerAndLogin = async (overrides?: Partial<{ email: string; password: string; firstName: string; lastName: string }>) => {
  const app = await getApp();
  const email = overrides?.email || `user${Date.now()}@test.dev`;
  const password = overrides?.password || 'P@ssw0rd!123';
  // Register
  await request(app)
    .post('/auth/register')
    .send({
      userName: { firstName: overrides?.firstName || 'Test', lastName: overrides?.lastName || 'User' },
      contactInfo: { email: { email }, phone: { phoneNumber: `555${Math.floor(Math.random()*1000000)}` } },
      password,
    })
    .expect((res) => {
      if (res.status >= 400) throw new Error('Failed to register');
    });

  // Set email as verified to allow login
  const UserModel = (await import('../../src/models/userModel')).default as any;
  await UserModel.updateOne(
    { $or: [ { 'contactInfo.email.value': email }, { 'contactInfo.email.email': email } ] },
    { $set: { 'contactInfo.email.verified': true } }
  );

  // Login
  const loginRes = await request(app)
    .post('/auth/login')
    .send({ email, password })
    .expect(200);

  const token = loginRes.body?.data?.accessToken || loginRes.body?.data?.token;
  if (!token) throw new Error('No token returned from login');
  return { app, token, email };
};
