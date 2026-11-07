import { Socket } from 'socket.io';
import { logger } from '../../Utils/Logger';
import { loadActiveVerifiedUser, SOCKET_ERRORS } from './socketAuth';
import { syncUserTrips } from './scheduledTrips';

export const DRIVERS_ONLINE_ROOM = 'drivers:online';

export default (socket: Socket) => {
  socket.on(
    'user:identify',
    async (
      { userId, role }: { userId: string; role: 'driver' | 'rider' } = {} as any,
      cb?: (res: {
        success: boolean;
        error?: string;
        code?: string;
      }) => void,
    ) => {
      try {
        if (!userId || !role) {
          const err = 'userId and role are required';
          logger.error(err);
          cb?.({ success: false, error: err });
          return;
        }
        if (role !== 'driver' && role !== 'rider') {
          cb?.({ success: false, error: 'role must be "driver" or "rider"' });
          return;
        }

        // A socket keeps one identity. Token-authenticated sockets can only
        // identify as the token's user; others must reconnect to switch user.
        if (socket.data.userId && socket.data.userId !== userId) {
          cb?.({
            success: false,
            error: 'This connection belongs to another user. Reconnect to switch user.',
            code: SOCKET_ERRORS.NOT_ALLOWED,
          });
          return;
        }

        const result = await loadActiveVerifiedUser(userId);
        if (!result.user) {
          logger.error(`user:identify rejected (${result.code}): ${userId}`);
          cb?.({ success: false, error: result.error, code: result.code });
          return;
        }

        if (role === 'driver' && result.user.role !== 'driver') {
          cb?.({
            success: false,
            error: 'User is not a driver',
            code: SOCKET_ERRORS.NOT_ALLOWED,
          });
          return;
        }

        socket.data.userId = userId;
        socket.data.accountRole = result.user.role;
        socket.data.role = role; // 'driver' | 'rider'

        console.log(
          `User identified: ${userId} as ${role}, socket: ${socket.id}`,
        );

        // Drivers receive trip:new in this room
        if (role === 'driver') {
          socket.join(DRIVERS_ONLINE_ROOM);
        }

        cb?.({ success: true });

        // Rejoin trip rooms and send the current state of scheduled/active
        // trips, so a status change made while offline is not missed.
        await syncUserTrips(socket, userId);
      } catch (e) {
        logger.error('Error in user:identify', e as any);
        cb?.({ success: false, error: 'Internal server error' });
      }
    },
  );
};
