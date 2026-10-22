import { Server, Socket } from 'socket.io';
import UserModel from '../models/userModel';
import { Driver } from '../models/DriverModel';
import { Trip } from '../models/TripModel';
import mongoose from 'mongoose';
import { trackJoin, trackLeave, tripRoom, userRooms } from './Rooms';

export default (io: Server, socket: Socket) => {
  // socket.on('trip:join', async ({ tripId, userId, role }) => {
  //   if (!tripId) {
  //     socket.emit('trip:join:error', {
  //       message: 'Missing tripId.',
  //       tripId,
  //     });
  //     return;
  //   }
  //   // Only allow join if user is identified
  //   if (!userId || !role) {
  //     console.warn(`Unauthenticated socket attempted trip:join (${socket.id})`);

  //     socket.emit('trip:join:error', {
  //       message: 'User must be identified before joining a trip.',
  //       socketId: socket.id,
  //     });
  //     return;
  //   }
  //   const user = await UserModel.findOne({ userID: userId });
  //   if (!user) {
  //     socket.emit('trip:join:error', {
  //       message: 'Rider not found',
  //       socketId: socket.id,
  //     });
  //     return;
  //   }
  //   const driver = await Driver.findOne({ driverId: userId });
  //   if (!driver) {
  //     socket.emit('trip:join:error', {
  //       message: 'Driver not found',
  //       socketId: socket.id,
  //     });
  //     return;
  //   }

  //   const roomName = `trip:${tripId}`;
  //   socket.join(roomName);

  //   console.log(
  //     `Socket ${socket.id} joined room ${roomName} as ${role} (${userId})`,
  //   );

  //   // Emit back success response
  //   socket.emit('trip:join:success', {
  //     message: 'Successfully joined trip.',
  //     tripId,
  //     userId,
  //     role,
  //     room: roomName,
  //   });

  //   // Optionally notify others in the room
  //   socket.to(roomName).emit('trip:user-joined', {
  //     userId,
  //     role,
  //     socketId: socket.id,
  //   });
  // });
  socket.on(
    'trip:join',
    async (
      data: {
        tripId: string;
        userId: string;
        role: 'rider' | 'driver';
      },
      cb?: any,
    ) => {
      try {
        const { tripId, userId, role } = data || ({} as any);

        // ---------- Basic validation ----------
        if (!tripId) {
          const payload = {
            success: false,
            error: 'Missing tripId.',
            tripId,
          };
          cb?.(payload);
          socket.emit('trip:join:status', payload);
          return;
        }

        if (!mongoose.Types.ObjectId.isValid(tripId)) {
          const payload = {
            success: false,
            error: 'Invalid tripId format.',
            tripId,
          };
          cb?.(payload);
          socket.emit('trip:join:status', payload);
          return;
        }

        if (!userId || !role) {
          const payload = {
            success: false,
            error: 'User must be identified before joining a trip.',
            socketId: socket.id,
          };
          cb?.(payload);
          socket.emit('trip:join:status', payload);
          return;
        }

        if (role !== 'rider' && role !== 'driver') {
          const payload = {
            success: false,
            error: 'role must be "rider" or "driver".',
          };
          cb?.(payload);
          socket.emit('trip:join:status', payload);
          return;
        }

        // ---------- Trip ----------
        const trip = await Trip.findById(tripId).lean();
        if (!trip) {
          const payload = {
            success: false,
            error: 'Trip not found.',
            tripId,
          };
          cb?.(payload);
          socket.emit('trip:join:status', payload);
          return;
        }

        // ---------- Role-based identity check ----------
        if (role === 'rider') {
          const user = await UserModel.findOne({ userID: userId }).lean();
          if (!user) {
            const payload = {
              success: false,
              error: 'Rider not found.',
            };
            cb?.(payload);
            socket.emit('trip:join:status', payload);
            return;
          }

          if (trip.riderId !== userId) {
            const payload = {
              success: false,
              error: 'Not authorized for this trip.',
            };
            cb?.(payload);
            socket.emit('trip:join:status', payload);
            return;
          }
        }

        if (role === 'driver') {
          const driver = await Driver.findOne({ driverId: userId }).lean();
          if (!driver) {
            const payload = {
              success: false,
              error: 'Driver not found.',
            };
            cb?.(payload);
            socket.emit('trip:join:status', payload);
            return;
          }
          if (!driver.online) {
            const payload = {
              success: false,
              error: 'driver must be Online',
            };
            cb?.(payload);
            socket.emit('trip:join:status', payload);
            return;
          }

          if (trip.driverId && trip.driverId !== userId) {
            const payload = {
              success: false,
              error: 'Not authorized for this trip.',
            };
            cb?.(payload);
            socket.emit('trip:join:status', payload);
            return;
          }
        }

        // ---------- Join room ----------
        const roomName = tripRoom(tripId);
        socket.join(roomName);
        trackJoin(roomName, {
          userId,
          role,
          socketId: socket.id,
          joinedAt: Date.now(),
        });

        const payload = {
          success: true,
          message: 'Successfully joined trip.',
          tripId,
          userId,
          role,
          room: roomName,
        };

        cb?.(payload);
        socket.emit('trip:join:status', payload);

        socket.to(roomName).emit('trip:user-joined', {
          userId,
          role,
          socketId: socket.id,
        });
      } catch (err) {
        console.error('trip:join error', err);
        const payload = {
          success: false,
          error: 'Internal server error',
        };
        cb?.(payload);
        socket.emit('trip:join:status', payload);
      }
    },
  );
  socket.on(
    'trip:leave',
    async (data: { tripId?: string; userId: string }, cb?: any) => {
      try {
        const { tripId, userId } = data || ({} as any);

        if (!userId) {
          const payload = { success: false, error: 'Missing userId.' };
          cb?.(payload);
          socket.emit('trip:leave:status', payload);
          return;
        }

        // Leave a specific trip
        if (tripId) {
          if (!mongoose.Types.ObjectId.isValid(tripId)) {
            const payload = {
              success: false,
              error: 'Invalid tripId format.',
              tripId,
            };
            cb?.(payload);
            socket.emit('trip:leave:status', payload);
            return;
          }

          const roomName = tripRoom(tripId);

          // Ensure socket is in the room
          const rooms = socket.rooms; // Set<string>
          if (!rooms.has(roomName)) {
            const payload = {
              success: false,
              error: 'Socket is not in this trip room.',
              tripId,
              room: roomName,
            };
            cb?.(payload);
            socket.emit('trip:leave:status', payload);
            return;
          }

          socket.leave(roomName);
          trackLeave(roomName, socket.id);

          const payload = {
            success: true,
            message: 'Successfully left trip.',
            tripId,
            userId,
            room: roomName,
          };

          cb?.(payload);
          socket.emit('trip:leave:status', payload);
          socket
            .to(roomName)
            .emit('trip:user-left', { userId, socketId: socket.id });
          return;
        }

        // Leave all trip rooms for this user (optional behavior when tripId not provided)
        const roomsForUser = userRooms.get(userId);
        if (!roomsForUser || roomsForUser.size === 0) {
          const payload = {
            success: false,
            error: 'No rooms found for this user.',
            userId,
          };
          cb?.(payload);
          socket.emit('trip:leave:status', payload);
          return;
        }

        for (const roomName of roomsForUser.keys()) {
          if (socket.rooms.has(roomName)) {
            socket.leave(roomName);
            trackLeave(roomName, socket.id);
            socket
              .to(roomName)
              .emit('trip:user-left', { userId, socketId: socket.id });
          }
        }

        const payload = {
          success: true,
          message: 'Successfully left all trip rooms.',
          userId,
          rooms: Array.from(roomsForUser.keys()),
        };

        cb?.(payload);
        socket.emit('trip:leave:status', payload);
      } catch (err) {
        console.error('trip:leave error', err);
        const payload = { success: false, error: 'Internal server error' };
        cb?.(payload);
        socket.emit('trip:leave:status', payload);
      }
    },
  );
};
