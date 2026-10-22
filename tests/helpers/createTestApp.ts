import express from 'express';

export const createTestApp = (mounts: Array<{ path: string; router: any }>) => {
  const app = express();
  app.use(express.json());
  for (const m of mounts) app.use(m.path, m.router);
  // generic 404 for test visibility
  app.use((req, res) => res.status(404).json({ success: false, message: 'not found' }));
  // error handler to surface errors in responses during tests
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: any, res: any, _next: any) => {
    const status = err?.status || 500;
    res.status(status).json({ success: false, message: err?.message || 'Internal Error', error: err?.name || 'Error' });
  });
  return app;
};

export default createTestApp;
