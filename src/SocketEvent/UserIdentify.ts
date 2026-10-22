import { Server, Socket } from 'socket.io';
import { logger } from '../../Utils/Logger';
import UserModel from '../models/userModel';

export default (socket: Socket) => {
  socket.on(
    'user:identify',
    async (
      { userId, role }: { userId: string; role: 'driver' | 'rider' },
      cb?: (res: { success: boolean; error?: string }) => void,
    ) => {
      try {
        if (!userId || !role) {
          const err = 'userId and role are required';
          logger.error(err);
          cb?.({ success: false, error: err });
          return;
        }

        // validate user exists
        const user = await UserModel.findOne({ userID: userId });
        if (!user) {
          const err = 'User not found';
          logger.error(err);
          cb?.({ success: false, error: err });
          return;
        }

        // store on socket
        socket.data.userId = userId;
        socket.data.role = role; // 'driver' | 'rider'

        console.log(
          `User identified: ${userId} as ${role}, socket: ${socket.id}`,
        );

        // put drivers in a drivers room (optional)
        if (role === 'driver') {
          socket.join('drivers_online');
        }

        cb?.({ success: true });
      } catch (e) {
        logger.error('Error in user:identify', e as any);
        cb?.({ success: false, error: 'Internal server error' });
      }
    },
  );
};
