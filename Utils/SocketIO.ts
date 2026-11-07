import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import type { Express } from 'express';
import passport from 'passport';
import driverEvents from '../src/SocketEvent/Driver';
import riderEvents from '../src/SocketEvent/Rider';
import joinEvents from '../src/SocketEvent/Join';
import tripEvents from '../src/SocketEvent/Trip';
import {
  startScheduledTripPromoter,
  syncUserTrips,
} from '../src/SocketEvent/scheduledTrips';
import userIdentifyEvents from '../src/SocketEvent/UserIdentify';
import { socketAuthMiddleware } from '../src/SocketEvent/socketAuth';
import {
  trackJoin,
  trackLeave,
  userLastSeen,
  userRooms,
} from '../src/SocketEvent/Rooms';

export const setupSocket = (httpServer: HttpServer, app: Express) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    path: '/socket.io/',
    allowEIO3: true,
    transports: ['websocket'],
    // For authentication via JWT
    //   auth: {
    //   token: 'JWT_HERE',
    // },
  });
  // Make io available everywhere via req.app.get('io')
  app.set('io', io);

  // Moves 'scheduled' trips to 'accepted' 10 minutes before tripTime
  startScheduledTripPromoter(io);

  // Binds the user from handshake auth.token (see src/SocketEvent/socketAuth.ts)
  io.use(socketAuthMiddleware);
  io.on('connection', (socket) => {
    console.log('⚡ User connected:', socket.id);
    // Token-authenticated: rejoin trip rooms and send current trip state
    // (anything missed while offline). Legacy clients sync on user:identify.
    if (socket.data.userId) {
      syncUserTrips(socket, socket.data.userId).catch((err) =>
        console.error('Error syncing user trips', err),
      );
    }
    //    const userId = socket.handshake.auth?.userId as string | undefined;
    // if (userId) {
    //   userLastSeen.set(userId, Date.now());

    //   const rooms = userRooms.get(userId);
    //   if (rooms && rooms.size > 0) {
    //     for (const roomName of rooms) {
    //       socket.join(roomName);
    //       // Track this new socket in the membership registry:
    //       trackJoin(roomName, {
    //         userId,
    //         role: 'rider', // unknown here; see note below
    //         socketId: socket.id,
    //         joinedAt: Date.now(),
    //       });
    //     }

    //     socket.emit('trip:rejoin:status', {
    //       success: true,
    //       message: 'Rejoined previous trip rooms.',
    //       userId,
    //       rooms: Array.from(rooms),
    //     });
    //   }
    // }
    userIdentifyEvents(socket);
    // Debug broadcast to every client: disabled in production
    if (process.env.NODE_ENV !== 'production') {
      socket.on('listen:test', (data) => {
        console.log('listen:test', data);
        socket.broadcast.emit('listen:res', {
          ok: true,
          from: socket.id,
          data,
          at: new Date().toISOString(),
        });
      });
    }
    joinEvents(io, socket);
    driverEvents(io, socket);
    riderEvents(io, socket);
    tripEvents(io, socket);
    socket.on('disconnect', () => {
      console.log('❌ User disconnected:', socket.id);
      //      for (const roomName of socket.rooms) {
      //     if (roomName.startsWith('trip:')) trackLeave(roomName, socket.id);
      //   }
      // });
    });
  });
  return io;
};
