// src/Realtime/DriverWatch.ts
import { ChangeStream } from 'mongodb';
import { Server as SocketIOServer } from 'socket.io';
import { Driver } from '../src/models/DriverModel';
import { IDriver } from '../src/interfaces/IDriver';

export const initDriverWatch = (io: SocketIOServer) => {
  const changeStream: ChangeStream = Driver.watch([], {
    fullDocument: 'updateLookup',
  });

  changeStream.on('change', (change) => {
    try {
      //   const doc: any = (change as any).fullDocument; // types can be refined
      const doc = (change as any).fullDocument as IDriver | undefined;
      switch (change.operationType) {
        case 'insert':
        case 'update':
        case 'replace':
          if (!doc) return;
          io.emit('db:driver:updated', {
            driverId: doc.driverId,
            driver: doc,
          });
          io.emit('driver:presence', {
            driverId: doc.driverId,
            online: doc.online,
            lastOnlineAt: doc.lastOnlineAt,
          });

          // Location change -> emit location
          if (doc.lastLocation) {
            io.emit('driver:location:update', {
              driverId: doc.driverId,
              lat: doc.lastLocation.lat,
              lng: doc.lastLocation.lng,
              updatedAt: doc.lastLocation.updatedAt,
            });
          }
          break;

        case 'delete': {
          const driverId = (change as any).documentKey._id?.toString();
          io.emit('db:driver:deleted', { driverId });
          break;
        }

        default:
          console.log('Driver change (ignored op):', change.operationType);
      }
    } catch (err) {
      console.error('Error handling Driver change stream event', err);
    }
  });

  changeStream.on('error', (err) => {
    console.error('Driver change stream error:', err);
  });

  console.log('✅ Driver change stream initialized');
};
