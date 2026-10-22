import { Server, Socket } from 'socket.io';
import { logger } from '../../Utils/Logger';
import { Driver } from '../models/DriverModel';
import { Trip } from '../models/TripModel';
import UserModel from '../models/userModel';
interface DriverOnlinePayload {
  driverId: string;
  lat: number;
  lng: number;
}
export interface DriverLocationPayload {
  driverId: string;
  tripId: string;
  lat: number;
  lng: number;
}

export default (io: Server, socket: Socket) => {
  /**
   * driver:online
   * data: { driverId, lat, lng }
   */
  socket.on('driver:online', async (data: DriverOnlinePayload, cb?: any) => {
    try {
      const { driverId, lat, lng } = data;

      if (!driverId || typeof lat !== 'number' || typeof lng !== 'number') {
        const err = 'driverId, lat, lng are required';
        logger.error(err);
        cb?.({ success: false, error: err });
        return;
      }

      const user = await UserModel.findOne({ userID: driverId });
      if (!user) {
        const err = 'Driver not found';
        logger.error(err);
        cb?.({ success: false, error: err });
        return;
      }
      if (user.role !== 'driver') {
        const err = 'User is not a driver';
        logger.error(err);
        cb?.({ success: false, error: err });
        return;
      }
      const driver = await Driver.findOne({ driverId });
      if (!driver) {
        const err = 'Driver not found';
        logger.error(err);
        cb?.({ success: false, error: err });
        return;
      }
      await Driver.findOneAndUpdate(
        { driverId },
        {
          $set: {
            lastLocation: { lat, lng, updatedAt: new Date() },
            location: { type: 'Point', coordinates: [lng, lat] },
            online: true,
            lastOnlineAt: new Date(),
          },
        },
        { new: true },
      );

      // put this socket in a driver-specific room (optional)
      // socket.join(`driver:${driverId}`);
      socket.join(`drivers:online`);

      logger.info(`SOCKET driver online: ${driverId}`);
      io.emit('driver:online', { driverId, lat, lng, updatedAt: new Date() });

      cb?.({ success: true, driver });
    } catch (err) {
      logger.error('Error in socket driver:online', err as any);
      cb?.({ success: false, error: 'Internal server error' });
    }
  });
  socket.on('driver:offline', async (data: DriverOnlinePayload, cb?: any) => {
    try {
      const { driverId, lat, lng } = data;

      if (!driverId || typeof lat !== 'number' || typeof lng !== 'number') {
        const err = 'driverId, lat, lng are required';
        logger.error(err);
        cb?.({ success: false, error: err });
        return;
      }

      const user = await UserModel.findOne({ userID: driverId });
      if (!user) {
        const err = 'Driver not found';
        logger.error(err);
        cb?.({ success: false, error: err });
        return;
      }
      if (user.role !== 'driver') {
        const err = 'User is not a driver';
        logger.error(err);
        cb?.({ success: false, error: err });
        return;
      }
      const driver = await Driver.findOne({ driverId });
      if (!driver) {
        const err = 'Driver not found';
        logger.error(err);
        cb?.({ success: false, error: err });
        return;
      }
      await Driver.findOneAndUpdate(
        { driverId },
        {
          $set: {
            lastLocation: { lat, lng, updatedAt: new Date() },
            location: { type: 'Point', coordinates: [lng, lat] },
            online: false,
            lastOnlineAt: new Date(),
          },
        },
        { new: true },
      );

      // remove this socket in a driver-specific room (optional)
      socket.leave(`driver:${driverId}`);

      logger.info(`SOCKET driver offline: ${driverId}`);
      io.emit('driver:offline', { driverId, lat, lng, updatedAt: new Date() });

      cb?.({ success: true, driver });
    } catch (err) {
      logger.error('Error in socket driver:online', err as any);
      cb?.({ success: false, error: 'Internal server error' });
    }
  });

  /**
   * driver:location
   * data: { driverId, tripId, lat, lng }
   */
  socket.on('driver:location', async (data: DriverOnlinePayload, cb?: any) => {
    try {
      const { driverId, lat, lng } = data;
      if (!driverId || typeof lat !== 'number' || typeof lng !== 'number') {
        const err = 'driverId, lat (number), lng (number) are required';
        logger.error(err);
        cb?.({ success: false, error: err });
        // io.to(`drivers:online`).emit('driver:location:update', {
        io.emit('driver:location:update', {
          driverId,
          lat,
          lng,
          success: false,
          error: err,
          updatedAt: new Date(),
        });
        return;
      }
      const driver = await Driver.findOne({ driverId });
      if (!driver) {
        const err = 'Driver not found';
        logger.error(err);
        cb?.({ success: false, error: err });
        // io.to(`drivers:online`).emit('driver:location:update', {
        io.emit('driver:location:update', {
          driverId,
          lat,
          lng,
          success: false,
          error: err,
          updatedAt: new Date(),
        });
        return;
      }
      if (!driver?.online) {
        const err = 'Driver not online';
        logger.error(err);
        cb?.({ success: false, error: err });
        io.emit('driver:location:update', {
          driverId,
          lat,
          lng,
          success: false,
          error: err,
          updatedAt: new Date(),
        });
        return;
      }
      await Driver.findOneAndUpdate(
        { driverId },
        {
          $set: {
            lastLocation: { lat, lng, updatedAt: new Date() },
            location: { type: 'Point', coordinates: [lng, lat] },
            online: true,
            lastOnlineAt: new Date(),
          },
        },
        { upsert: true, new: true },
      );

      logger.info(`SOCKET driver location: ${driverId},  ${lat}, ${lng}`);

      cb?.({ success: true, driver });
      // io.to(`drivers:online`).emit('driver:location:update', {
      io.emit('driver:location:update', {
        success: true,
        driver,
        updatedAt: new Date(),
      });
    } catch (err) {
      logger.error('Error in socket driver:location', err as any);
      cb?.({ success: false, error: 'Internal server error' });
    }
  });
};
