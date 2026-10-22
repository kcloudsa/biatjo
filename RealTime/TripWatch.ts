// src/Realtime/TripWatch.ts
import {
  ChangeStream,
  ChangeStreamInsertDocument,
  ChangeStreamUpdateDocument,
  ChangeStreamDeleteDocument,
} from 'mongodb';
import { Server as SocketIOServer } from 'socket.io';
import { Trip } from '../src/models/TripModel';
import { TripStatus } from '../src/interfaces/ITrip';

export const initTripWatch = (io: SocketIOServer) => {
  // fullDocument: 'updateLookup' makes sure we get the full updated doc on updates
  const changeStream: ChangeStream = Trip.watch([], {
    fullDocument: 'updateLookup',
  });

  // changeStream.on('change', (change) => {
  //   try {
  //     switch (change.operationType) {
  //       case 'insert': {
  //         const doc = (change as ChangeStreamInsertDocument<any>).fullDocument;
  //         const tripId = doc._id.toString();
  //         io.emit('db:trip:created', {
  //           tripId: tripId,
  //           trip: doc,
  //         });

  //         io.to(`trip:${tripId}`).emit('trip:update', {
  //           tripId: tripId,
  //           status: doc.status,
  //           trip: doc,
  //         });
  //         break;
  //       }

  //       case 'update': {
  //         const c = change as ChangeStreamUpdateDocument<any>;
  //         const doc = c.fullDocument;
  //         const tripId = doc._id.toString();
  //         const updatedFields = c.updateDescription?.updatedFields || {};
  //         io.emit('db:trip:updated', {
  //           tripId: doc._id.toString(),
  //           trip: doc,
  //           updatedFields: c.updateDescription?.updatedFields,
  //           removedFields: c.updateDescription?.removedFields,
  //         });
  //         io.to(`trip:${tripId}`).emit('trip:update', {
  //           tripId,
  //           status: doc.status,
  //           updatedFields,
  //           trip: doc,
  //         });

  //         // If status changed, emit more specific events
  //         if ('status' in updatedFields) {
  //           const newStatus = updatedFields.status as TripStatus;

  //           // if (newStatus === 'accepted') {
  //           //   io.to(`trip:${tripId}`).emit('trip:accepted', {
  //           //     tripId,
  //           //     riderId: doc.riderId,
  //           //     driverId: doc.driverId,
  //           //   });
  //           // }

  //           //   if (newStatus === 'on_route') {
  //           //     io.to(`trip:${tripId}`).emit('trip:on_route', {
  //           //       tripId,
  //           //       driverId: doc.driverId,
  //           //     });
  //           //   }

  //           //   if (newStatus === 'completed') {
  //           //     io.to(`trip:${tripId}`).emit('trip:completed', {
  //           //       tripId,
  //           //       fare: doc.fare,
  //           //     });
  //           //   }

  //           if (newStatus === 'cancelled') {
  //             io.to(`trip:${tripId}`).emit('trip:cancelled', {
  //               tripId,
  //             });
  //           }
  //         }
  //         break;
  //       }

  //       case 'delete': {
  //         const c = change as ChangeStreamDeleteDocument<any>;
  //         const tripId = c.documentKey._id.toString();
  //         io.to(`trip:${tripId}`).emit('trip:deleted', { tripId });
  //         io.emit('trip:deleted', { tripId });
  //         io.emit('db:trip:deleted', { tripId });
  //         break;
  //       }

  //       default:
  //         // you can log or ignore other ops (replace, invalidate, etc.)
  //         console.log('Trip change (ignored op):', change.operationType);
  //     }
  //   } catch (err) {
  //     console.error('Error handling Trip change stream event', err);
  //   }
  // });

  changeStream.on('error', (err) => {
    console.error('Trip change stream error:', err);
  });

  console.log('✅ Trip change stream initialized');
};
