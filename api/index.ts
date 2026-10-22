import { createServer } from 'http';
import app from '../src/app';
import { setupSocket } from '../Utils/SocketIO';
// import { initTripWatch } from '../RealTime/TripWatch';
// import { initDriverWatch } from '../RealTime/DriverWatch';
const port = Number(process.env.PORT) || 8000;
const hostname = '0.0.0.0';

// For local development
// if (process.env.NODE_ENV !== 'production') {

// Create HTTP server from Express app
const httpServer = createServer(app);
// setupSocket now returns io
// Wire Socket.IO and expose io on app
const io = setupSocket(httpServer, app);
// Initialize DB change watchers
// initTripWatch(io);
// initDriverWatch(io);

httpServer.listen(port, hostname, () => {
  console.log('port', port);
  /* eslint-disable no-console */
  console.log(`Listening: http://localhost:${port}`);
  /* eslint-enable no-console */
});
// }
export default app;
