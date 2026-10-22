import { Server, Socket } from 'socket.io';
import mongoose from 'mongoose';
import { Trip } from '../models/TripModel';
import { Driver } from '../models/DriverModel';
import UserModel from '../models/userModel';
import { tripRoom } from '../SocketEvent/Rooms';
import { TripStatus } from '../interfaces/ITrip';
import { CarKindEnum } from '../interfaces/ICar';
import { DriverLocationPayload } from './Driver';
import { logger } from '../../Utils/Logger';
import { validateBase } from '../validation/offer/index';
import OfferModel from '../models/offerModel';

// export default (io: Server, socket: Socket) => {
//   /**
//    * Rider requests a trip via socket
//    * event: 'rider:request_trip'
//    * data: { riderId, pickup, dropoff }
//    */
//   socket.on('rider:request_trip', async (data) => {
//     try {
//       const { riderId, pickup, dropoff } = data;
//       console.log('Trip requested via socket:', data);

//       if (!riderId || !pickup || !dropoff) {
//         console.log('Invalid trip request data', data);
//         return;
//       }

//       // 1) create trip in DB
//       const trip = await Trip.create({
//         riderId,
//         pickup,
//         dropoff,
//         status: 'requested',
//       });

//       if (!trip || !(trip as any)._id) {
//         console.error('Failed to create trip', trip);
//         return;
//       }

//       const tripId = String((trip as any)._id);
//       const roomName = tripRoom(tripId);

//       // 2) rider socket joins trip room
//       socket.join(roomName);
//       console.log(`Rider ${riderId} joined room ${roomName}`);

//       // 3) notify drivers (you can emit to a "drivers" room instead of everyone)
//       // io.to('drivers').emit('trip:new', { ... });
//       io.emit('trip:new', {
//         tripId,
//         riderId,
//         pickup,
//         dropoff,
//         status: trip.status,
//       });
//     } catch (err) {
//       console.error('Error in rider:request_trip', err);
//     }
//   });
//   socket.on('trip:accept', (data) => {
//     const { tripId, driverId, riderId } = data;

//     socket.join(`trip:${tripId}`);

//     io.to(`trip:${tripId}`).emit('trip:accepted', {
//       tripId,
//       driverId,
//       riderId,
//     });
//   });
//   /**
//    * Driver accepts trip via socket
//    * event: 'driver:accept_trip'
//    * data: { tripId, driverId }
//    */
//   socket.on('driver:accept_trip', async ({ tripId, driverId }) => {
//     try {
//       if (!tripId || !driverId) return;

//       const trip = await Trip.findByIdAndUpdate(
//         tripId,
//         {
//           $set: {
//             driverId,
//             status: 'accepted',
//           },
//         },
//         { new: true },
//       );

//       if (!trip) {
//         console.log('Trip not found for driver:accept_trip', tripId);
//         return;
//       }

//       const roomName = tripRoom(tripId);

//       // Driver joins same room
//       socket.join(roomName);
//       console.log(`Driver ${driverId} joined room ${roomName}`);

//       // Emit only to rider + driver in that room
//       io.to(roomName).emit('trip:update', {
//         tripId,
//         status: trip.status,
//         driverId,
//         riderId: trip.riderId,
//       });
//     } catch (err) {
//       console.error('Error in driver:accept_trip', err);
//     }
//   });

//   /**
//    * Example: negotiation event ONLY inside that trip room
//    * event: 'trip:negotiate'
//    * data: { tripId, from: 'driver' | 'rider', amount }
//    */
//   socket.on('trip:negotiate', async ({ tripId, from, amount }) => {
//     try {
//       if (!tripId || typeof amount !== 'number') return;

//       // update trip / negotiation count in DB if you want
//       // const trip = await Trip.findByIdAndUpdate(...)

//       const roomName = tripRoom(tripId);

//       const payload = {
//         tripId,
//         from, // "driver" or "rider"
//         amount,
//         at: new Date().toISOString(),
//       };

//       console.log('Negotiation update:', payload);

//       // 🔥 ONLY rider & driver in that room receive this
//       io.to(roomName).emit('trip:negotiation:update', payload);
//     } catch (err) {
//       console.error('Error in trip:negotiate', err);
//     }
//   });

//   socket.on('trip:update', (data) => {
//     io.to(`trip:${data.tripId}`).emit('trip:update', data);
//   });

//   socket.on('trip:completed', (data) => {
//     io.to(`trip:${data.tripId}`).emit('trip:completed', data);
//     io.close();
//   });
// };
export default (io: Server, socket: Socket) => {
  // rider socket handler (no cb / no ack)
  // socket.on('rider:request_trip', async (data: any) => {
  //   try {
  //     const {
  //       riderId,
  //       pickup,
  //       dropoff,
  //       initialFare,
  //       loadDescription,
  //       loadWeight,
  //       carKind,
  //       transportType,
  //       isScheduled,
  //       tripTime,
  //     } = data || {};

  //     // Basic validation
  //     if (!riderId || !pickup || !dropoff) {
  //       socket.emit('rider:request_trip:error', {
  //         success: false,
  //         error: 'riderId, pickup, dropoff are required',
  //       });
  //       return;
  //     }

  //     if (
  //       typeof pickup.lat !== 'number' ||
  //       typeof pickup.lng !== 'number' ||
  //       typeof dropoff.lat !== 'number' ||
  //       typeof dropoff.lng !== 'number'
  //     ) {
  //       socket.emit('rider:request_trip:error', {
  //         success: false,
  //         error:
  //           'pickup.lat, pickup.lng, dropoff.lat, dropoff.lng must be numbers',
  //       });
  //       return;
  //     }

  //     if (carKind) {
  //       const validCarKinds = Object.values(CarKindEnum);
  //       if (!validCarKinds.includes(carKind)) {
  //         socket.emit('rider:request_trip:error', {
  //           success: false,
  //           error: `Invalid carKind. Must be one of: ${validCarKinds.join(
  //             ', ',
  //           )}`,
  //         });
  //         return;
  //       }
  //     }

  //     const user = await UserModel.findOne({ userID: riderId });
  //     if (!user) {
  //       socket.emit('rider:request_trip:error', {
  //         success: false,
  //         error: 'Rider not found',
  //       });
  //       return;
  //     }

  //     const startingFare = typeof initialFare === 'number' ? initialFare : 0;

  //     const trip = await Trip.create({
  //       riderId,
  //       pickup,
  //       dropoff,
  //       loadDescription,
  //       loadWeight,
  //       carKind,
  //       transportType,
  //       isScheduled,
  //       tripTime,
  //       status: startingFare > 0 ? 'negotiating' : 'requested',
  //       fare: startingFare,
  //       negotiationCount: startingFare > 0 ? 1 : 0,
  //       lastOfferBy: startingFare > 0 ? 'rider' : null,
  //     });

  //     const tripId = (trip._id as mongoose.Types.ObjectId).toString();
  //     const roomName = tripRoom(tripId);

  //     // Join rider into trip room
  //     socket.join(roomName);

  //     // Notify UI immediately on rider socket
  //     socket.emit('rider:request_trip:success', {
  //       success: true,
  //       tripId,
  //       trip,
  //     });

  //     // Broadcast trip:new to everyone (or drivers room later)
  //     io.emit('trip:new', {
  //       tripId,
  //       riderId,
  //       pickup,
  //       dropoff,
  //       loadDescription,
  //       loadWeight,
  //       carKind,
  //       transportType,
  //       isScheduled,
  //       tripTime,
  //       status: trip.status,
  //     });

  //     // Nearby drivers search
  //     const pickupPoint = {
  //       type: 'Point',
  //       coordinates: [pickup.lng, pickup.lat],
  //     };

  //     const maxRadiusKm = 50;
  //     const stepKm = 0.5;
  //     let radiusKm = stepKm;
  //     let nearbyDrivers: any[] = [];

  //     while (radiusKm <= maxRadiusKm && nearbyDrivers.length === 0) {
  //       const radiusMeters = radiusKm * 1000;

  //       nearbyDrivers = await Driver.find({
  //         online: true,
  //         location: {
  //           $near: {
  //             $geometry: pickupPoint,
  //             $maxDistance: radiusMeters,
  //           },
  //         },
  //       });

  //       if (nearbyDrivers.length === 0) radiusKm += stepKm;
  //     }

  //     const foundRadiusKm = nearbyDrivers.length ? radiusKm : null;

  //     const payload = {
  //       tripId,
  //       riderId,
  //       pickup,
  //       dropoff,
  //       loadDescription,
  //       loadWeight,
  //       carKind,
  //       transportType,
  //       isScheduled,
  //       tripTime,
  //       status: trip.status,
  //       fare: trip.currentFareOffer,
  //       negotiationCount: trip.negotiationCount,
  //       searchRadiusKm: foundRadiusKm,
  //       nearbyDrivers: nearbyDrivers.map((d) => ({
  //         driverId: d.driverId,
  //         lastLocation: d.lastLocation,
  //       })),
  //     };

  //     // Broadcast to drivers (or all for now)
  //     io.emit('rider:request_trip', payload);
  //   } catch (err) {
  //     console.error('Error in rider:request_trip', err);
  //     socket.emit('rider:request_trip:error', {
  //       success: false,
  //       error: 'Internal server error',
  //     });
  //   }
  // });

  /**
   * rider:request_trip (Socket)
   * data: { riderId, pickup: {lat,lng}, dropoff: {lat,lng}, initialFare? }
   * Mirrors POST /riders/request-trip
   */
  socket.on('rider:request_trip', async (data, cb?: any) => {
    try {
      const {
        riderId,
        pickup,
        dropoff,
        initialFare,
        loadDescription,
        loadWeight,
        carKind,
        transportType,
        isScheduled,
        tripTime,
      } = data || {};

      if (!riderId || !pickup || !dropoff) {
        const err = 'riderId, pickup, dropoff are required';
        console.log(err, data);
        cb?.({ success: false, error: err });
        return;
      }
      if (
        typeof pickup.lat !== 'number' ||
        typeof pickup.lng !== 'number' ||
        typeof dropoff.lat !== 'number' ||
        typeof dropoff.lng !== 'number'
      ) {
        const err =
          'pickup.lat, pickup.lng, dropoff.lat, dropoff.lng must be numbers';
        cb?.({ success: false, error: err });
        return;
      }
      if (carKind) {
        const validCarKinds = Object.values(CarKindEnum);

        if (!validCarKinds.includes(carKind)) {
          const err = `Invalid carKind. Must be one of: ${validCarKinds.join(
            ', ',
          )}`;
          cb?.({ success: false, error: err });
          return;
        }
      }

      const user = await UserModel.findOne({ userID: riderId });
      if (!user) {
        cb?.({ success: false, error: 'Rider not found' });
        return;
      }

      const startingFare = typeof initialFare === 'number' ? initialFare : 0;

      const trip = await Trip.create({
        riderId,
        pickup,
        dropoff,
        loadDescription,
        loadWeight,
        carKind,
        transportType,
        isScheduled,
        tripTime,
        status: startingFare > 0 ? 'negotiating' : 'requested',
        fare: startingFare,
        negotiationCount: startingFare > 0 ? 1 : 0,
        lastOfferBy: startingFare > 0 ? 'rider' : null,
      });

      const tripId = (trip._id as mongoose.Types.ObjectId).toString();
      const roomName = tripRoom(tripId);
      // rider joins trip room
      socket.join(roomName);
      // notify only drivers interested? (for now broadcast to all drivers)
      io.to('drivers:online').emit('trip:new', {
        tripId,
        riderId,
        pickup,
        dropoff,
        loadDescription,
        loadWeight,
        carKind,
        transportType,
        isScheduled,
        tripTime,
        status: trip.status,
        initialFare: initialFare ? initialFare : 0,
      });
      const pickupPoint = {
        type: 'Point',
        coordinates: [pickup.lng, pickup.lat],
      };

      // Dynamic radius search (same as HTTP)
      const maxRadiusKm = 50;
      const stepKm = 0.5;
      let radiusKm = stepKm;
      let nearbyDrivers: any[] = [];

      while (radiusKm <= maxRadiusKm && nearbyDrivers.length === 0) {
        const radiusMeters = radiusKm * 1000;
        nearbyDrivers = await Driver.find({
          online: true,
          location: {
            $near: {
              $geometry: pickupPoint,
              $maxDistance: radiusMeters,
            },
          },
        });

        if (nearbyDrivers.length === 0) radiusKm += stepKm;
      }

      const foundRadiusKm = nearbyDrivers.length ? radiusKm : null;

      const payload = {
        tripId,
        riderId,
        pickup,
        dropoff,
        loadDescription,
        loadWeight,
        carKind,
        transportType,
        isScheduled,
        tripTime,
        status: trip.status,
        fare: trip.fare,
        negotiationCount: trip.negotiationCount,
        searchRadiusKm: foundRadiusKm,
        nearbyDrivers: nearbyDrivers.map((d) => ({
          driverId: d.driverId,
          lastLocation: d.lastLocation,
        })),
      };

      // send to everyone (or to drivers room in future)
      io.emit('rider:request_trip', payload);
      console.log('payload', payload);
      cb?.({ success: true, trip, ...payload });
    } catch (err) {
      console.error('Error in rider:request_trip', err);
      cb?.({ success: false, error: 'Internal server error' });
    }
  });

  /**
   * trip:accept – mirrors POST /trips/accept
   * data: { tripId, driverId, riderId }
   */
  socket.on('trip:accept', async (data, cb?: any) => {
    try {
      const { tripId, driverId, riderId, amount } = data || {};

      if (!tripId || !driverId || !riderId || !amount) {
        const err = 'tripId, driverId, riderId and amount are required';
        cb?.({
          success: false,
          err,
        });
        logger.error(err);
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(tripId)) {
        const err = 'Invalid tripId format';
        cb?.({ success: false, err });
        logger.error(err);
        return;
      }

      const rider = await UserModel.findOne({ userID: riderId });
      if (!rider) {
        const err = 'Rider not found';
        cb?.({ success: false, err });
        logger.error(err);
        return;
      }

      const driver = await Driver.findOne({ driverId });
      if (!driver) {
        const err = 'Driver not found';
        cb?.({ success: false, err });
        logger.error(err);
        return;
      }

      const trip = await Trip.findById(tripId);
      if (!trip) {
        const err = 'Trip not found';
        cb?.({ success: false, err, trip });
        logger.error(err);
        return;
      }
      const notAllow = await Trip.findOne({
        driverId: driverId,
        status: { $in: ['accepted', 'running', 'started'] },
        _id: { $ne: tripId },
      });
      if (notAllow) {
        cb?.({
          success: false,
          error: `هذا السائق غير متاح حاليا`,
          trip,
        });
        return;
      }
      if (!['requested', 'negotiating'].includes(trip.status)) {
        const err = 'Trip cannot be accepted in current status';
        cb?.({
          success: false,
          err,
          trip,
        });
        logger.error(err);
        return;
      }
      const updatedTrip = await Trip.findOneAndUpdate(
        {
          _id: tripId,
          status: { $in: ['requested', 'negotiating'] },
          driverId: null,
        },
        {
          $set: {
            driverId,
            status: 'accepted',
            fare: amount,
            acceptedAt: new Date(),
          },
        },
        { new: true },
      );
      if (!updatedTrip) {
        cb?.({
          success: false,
          trip,
          error: 'Trip already taken or not acceptable',
        });
        return;
      }
      // const maxNegotiations = trip.maxNegotiations || 3;
      // if (trip.negotiationCount > maxNegotiations) {
      //   cb?.({
      //     success: false,
      //     error: 'Negotiation exceeded maximum limit. Trip must be re-created.',
      //   });
      //   return;
      // }
      // driver.runningTrip = trip.id;
      // rider.runningTrip = trip.id;
      // await driver.save();
      // await rider.save();
      const roomName = tripRoom(tripId);
      socket.join(roomName); // ensure driver joins

      io.to(roomName).emit('trip:accepted', {
        tripId,
        driverId,
        riderId,
        status: updatedTrip.status,
        agreedFare: updatedTrip.fare,
      });
      console.error('trip:accepted', {
        tripId,
        driverId,
        riderId,
        status: updatedTrip.status,
        agreedFare: updatedTrip.fare,
      });
      cb?.({ success: true, trip: updatedTrip });
    } catch (err) {
      console.error('Error in trip:accept', err);
      cb?.({ success: false, error: 'Internal server error' });
    }
  });
  socket.on('trip:start', async (data, cb?: any) => {
    try {
      const { tripId, driverId, riderId, lat, lng } = data || {};
      const roomName = tripRoom(tripId);
      socket.join(roomName); // ensure driver joins
      if (!tripId || !driverId || !riderId || !lat || !lng) {
        const err = 'tripId, driverId, riderId ,lat and lng are required';
        cb?.({
          success: false,
          err,
        });
        io.to(roomName).emit('trip:started', {
          tripId,
          driverId,
          riderId,
          status: null,
          agreedFare: null,
          success: false,
          err,
        });
        logger.error(err);
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(tripId)) {
        const err = 'Invalid tripId format';
        cb?.({ success: false, err });
        logger.error(err);
        io.to(roomName).emit('trip:started', {
          tripId,
          driverId,
          riderId,
          status: null,
          agreedFare: null,
          success: false,
          err,
        });
        return;
      }

      const rider = await UserModel.findOne({ userID: riderId });
      if (!rider) {
        const err = 'Rider not found';
        cb?.({ success: false, err });
        io.to(roomName).emit('trip:started', {
          tripId,
          driverId,
          riderId,
          status: null,
          agreedFare: null,
          success: false,
          err,
        });
        logger.error(err);
        return;
      }

      const driver = await Driver.findOne({ driverId });
      if (!driver) {
        const err = 'Driver not found';
        cb?.({ success: false, err });
        io.to(roomName).emit('trip:started', {
          tripId,
          driverId,
          riderId,
          status: null,
          agreedFare: null,
          success: false,
          err,
        });
        logger.error(err);
        return;
      }

      const trip = await Trip.findById(tripId);
      if (!trip) {
        const err = 'Trip not found';
        cb?.({ success: false, err, trip });
        io.to(roomName).emit('trip:started', {
          tripId,
          driverId,
          riderId,
          status: null,
          agreedFare: null,
          success: false,
          err,
        });
        logger.error(err);
        return;
      }
      const notAllow = await Trip.findOne({
        driverId: driverId,
        status: { $in: ['accepted', 'running', 'started'] },
        _id: { $ne: tripId },
      });
      if (notAllow) {
        const err = {
          success: false,
          error: `هذا السائق غير متاح حاليا`,
          trip,
        };
        const updatedTrip = await Trip.findOneAndUpdate(
          {
            _id: tripId,
            status: { $in: ['requested', 'negotiating'] },
            driverId: null,
          },
          {
            $set: {
              driverId,
              status: 'accepted',
              fare: trip.fare,
              acceptedAt: new Date(),
            },
          },
          { new: true },
        );
        if (!updatedTrip) {
          cb?.({
            success: false,
            trip,
            error: 'Trip already taken or not acceptable',
          });
          return;
        }

        cb?.(err);
        io.to(roomName).emit('trip:started', {
          tripId,
          driverId,
          riderId,
          status: trip.status,
          agreedFare: trip.fare,
          success: false,
          err,
        });
        return;
      }
      if (!['accepted'].includes(trip.status)) {
        const err = 'Trip cannot be start  in current status';

        cb?.(err);
        io.to(roomName).emit('trip:started', {
          tripId,
          driverId,
          riderId,
          status: trip.status,
          agreedFare: trip.fare,
          success: false,
          err,
        });
        logger.error(err);
        return;
      }
      const location = {
        lat,
        lng,
        updatedAt: new Date(),
      };
      trip.status = 'running';
      trip.lastDriverLocation = location;
      trip.allLocations.push(location);
      driver.runningTrip = trip.id;
      rider.runningTrip = trip.id;
      await driver.save();
      await rider.save();
      await trip.save();

      io.to(roomName).emit('trip:started', {
        trip,
      });

      cb?.({ success: true, trip });
    } catch (err) {
      console.error('Error in trip:accept', err);
      cb?.({ success: false, error: 'Internal server error' });
    }
  });
  /**
   * data: { tripId, driverId, riderId }
   */
  socket.on('trip:cancel', async (data, cb?: any) => {
    try {
      const { tripId, driverId, riderId } = data || {};

      if (!tripId || !riderId) {
        cb?.({
          success: false,
          error: 'tripId, riderId  are required',
        });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(tripId)) {
        cb?.({ success: false, error: 'Invalid tripId format' });
        return;
      }

      const rider = await UserModel.findOne({ userID: riderId });
      if (!rider) {
        cb?.({ success: false, error: 'Rider not found' });
        return;
      }

      const trip = await Trip.findById(tripId);
      if (!trip) {
        cb?.({ success: false, error: 'Trip not found' });
        return;
      }

      if (trip.riderId !== riderId) {
        cb?.({
          success: false,
          error: 'Trip does not belong to this rider',
        });
        return;
      }

      const cancelledTrip = await Trip.findOneAndUpdate(
        { _id: tripId, riderId, status: { $ne: 'cancelled' } },
        { $set: { status: 'cancelled' } },
        { new: true },
      );
      if (!cancelledTrip) {
        cb?.({
          success: false,
          error: 'Trip has already been cancelled in current status',
        });
        return;
      }

      if (cancelledTrip.driverId) {
        await Driver.updateOne(
          { driverId: cancelledTrip.driverId, runningTrip: tripId },
          { $set: { runningTrip: null } },
        );
      }
      await UserModel.updateOne(
        { userID: riderId, runningTrip: tripId },
        { $set: { runningTrip: null } },
      );
      const roomName = tripRoom(tripId);
      socket.join(roomName); // ensure driver joins
      io.to('drivers:online').emit('trip:cancelled', {
        tripId,
        driverId: cancelledTrip.driverId,
        riderId,
        status: cancelledTrip.status,
      });
      io.to(roomName).emit('trip:cancelled', {
        tripId,
        driverId: cancelledTrip.driverId,
        riderId,
        status: cancelledTrip.status,
      });

      cb?.({ success: true, trip: cancelledTrip });
    } catch (err) {
      console.error('Error in trip:cancelled', err);
      cb?.({ success: false, error: 'Error in trip:cancelled' });
    }
  });

  /**
   * trip:update – mirrors POST /trips/update
   * data: { tripId, status }
   */
  socket.on(
    'trip:update',
    async (data: { tripId: string; status: TripStatus }, cb?: any) => {
      try {
        const { tripId, status } = data || ({} as any);

        if (!tripId || !status) {
          cb?.({ success: false, error: 'tripId and status are required' });
          return;
        }

        const allowedStatuses: TripStatus[] = [
          'requested',
          'accepted',
          'driver_on_the_way',
          'driver_arrived',
          'running',
          'completed',
          'cancelled',
        ];

        if (!allowedStatuses.includes(status)) {
          cb?.({ success: false, error: 'Invalid status' });
          return;
        }

        const trip = await Trip.findByIdAndUpdate(
          { _id: tripId },
          { $set: { status } },
          { new: true },
        );

        if (!trip) {
          cb?.({ success: false, error: 'Trip not found' });
          return;
        }

        const roomName = tripRoom(tripId);
        io.to(roomName).emit('trip:update', { tripId, status });

        cb?.({ success: true, trip });
      } catch (err) {
        console.error('Error in trip:update', err);
        cb?.({ success: false, error: 'Internal server error' });
      }
    },
  );

  /**
   * trip:completed – mirrors POST /trips/complete
   * data: { tripId }
   */
  socket.on('trip:completed', async (data: { tripId: string }, cb?: any) => {
    try {
      const { tripId } = data || ({} as any);

      if (!tripId) {
        cb?.({
          success: false,
          error: 'tripId are required',
        });
        return;
      }
      const existing = await Trip.findById(tripId);
      if (!existing) return cb?.({ success: false, error: 'Trip not found' });
      if (['negotiating', 'requested'].includes(existing.status))
        return cb?.({
          success: false,
          error: 'هذه الرحله لم تبدا بعد',
          trip: existing,
        });
      if (existing.status === 'cancelled')
        return cb?.({
          success: false,
          error: 'هذه الرحله تم الغائها من قبل العميل',
          trip: existing,
        });

      const trip = await Trip.findOneAndUpdate(
        {
          _id: tripId,
          status: { $in: ['running', 'driver_arrived', 'driver_on_the_way'] },
        },
        { $set: { status: 'completed', completedAt: new Date() } },
        { new: true },
      );
      // const trip = await Trip.findByIdAndUpdate(
      //   tripId,
      //   {
      //     $set: {
      //       status: 'completed',

      //       completedAt: new Date(),
      //     },
      //   },
      //   { new: true },
      // );

      if (!trip) {
        cb?.({ success: false, error: 'Trip not found', trip });
        return;
      }
      if (trip.status == 'negotiating' || trip.status == 'requested') {
        cb?.({ success: false, error: 'هذه الرحله لم تبدا بعد', trip });
        return;
      }
      if (trip.status == 'cancelled') {
        cb?.({
          success: false,
          error: 'هذه الرحله تم الغائها من قبل العميل',
          trip,
        });
        return;
      }
      const rider = await UserModel.findOne({ userID: trip.riderId });
      if (!rider) {
        const err = 'Rider not found';
        cb?.({ success: false, err });
        logger.error(err);
        return;
      }
      const driver = await Driver.findOne({ driverId: trip.driverId });
      if (!driver) {
        const err = 'Driver not found';
        cb?.({ success: false, err });
        logger.error(err);
        return;
      }
      rider.runningTrip = null;
      driver.runningTrip = null;
      await rider.save();
      await driver.save();
      const roomName = tripRoom(tripId);
      io.to(roomName).emit('trip:completed', {
        success: true,
        trip,
      });

      cb?.({ success: true, trip });
    } catch (err) {
      console.error('Error in trip:completed', err);
      cb?.({ success: false, error: 'Internal server error' });
    }
  });

  /**
   * trip:negotiate – mirrors POST /trips/negotiate
   * data: { tripId, from: 'driver' | 'rider', amount }
   */
  // socket.on(
  //   'trip:negotiate',
  //   async (
  //     data: {
  //       tripId: string;
  //       from: 'driver' | 'rider';
  //       amount: number;
  //       userId: string;
  //     },
  //     cb?: any,
  //   ) => {
  //     try {
  //       const { tripId, from, amount, userId } = data || ({} as any);

  //       if (
  //         !tripId ||
  //         !from ||
  //         typeof amount !== 'number'! ||
  //         Number.isNaN(amount) ||
  //         !userId
  //       ) {
  //         cb?.({
  //           success: false,
  //           tripId,
  //           userId,
  //           amount,
  //           error:
  //             'tripId, from ("driver" or "rider"), amount (number) are required,userId',
  //         });
  //         io.emit('trip:negotiation:update', {
  //           success: false,
  //           error:
  //             'tripId, from ("driver" or "rider"), amount (number) are required,userId',
  //           tripId,
  //           userId,
  //           amount,
  //         });
  //         return;
  //       }
  //       if (from !== 'driver' && from !== 'rider') {
  //         cb?.({
  //           success: false,
  //           error: 'from must be "driver" or "rider"',
  //           userId,
  //           tripId,
  //         });
  //         io.emit('trip:negotiation:update', {
  //           success: false,
  //           error: 'from must be "driver" or "rider"',
  //           userId,
  //           tripId,
  //         });
  //         return;
  //       }
  //       const user = await UserModel.findOne({ userID: userId });
  //       if (!user) {
  //         cb?.({ success: false, userId, tripId, error: 'User not found' });
  //         io.emit('trip:negotiation:update', {
  //           success: false,
  //           error: 'User not found',
  //           userId,
  //           tripId,
  //         });
  //         return;
  //       }
  //       if (!mongoose.Types.ObjectId.isValid(tripId)) {
  //         cb?.({
  //           success: false,
  //           error: 'Invalid tripId format',
  //           userId,
  //           tripId,
  //         });
  //         io.emit('trip:negotiation:update', {
  //           success: false,
  //           error: 'Invalid tripId format',
  //           userId,
  //           tripId,
  //         });
  //         return;
  //       }
  //       if (amount <= 0) {
  //         cb?.({
  //           success: false,
  //           error: 'amount must be greater than zero',
  //           userId,
  //           tripId,
  //         });
  //         io.emit('trip:negotiation:update', {
  //           success: false,
  //           error: 'amount must be greater than zero',
  //           userId,
  //           tripId,
  //         });
  //         return;
  //       }
  //       if (from === 'driver') {
  //         const driver = await Driver.findOne({ driverId: userId });
  //         if (!driver) {
  //           cb?.({ success: false, error: 'Driver not found', userId, tripId });
  //           io.emit('trip:negotiation:update', {
  //             success: false,
  //             error: 'Driver not found',
  //             userId,
  //             tripId,
  //           });
  //           return;
  //         }

  //         const trip = await Trip.findById(tripId);
  //         if (!trip) {
  //           cb?.({ success: false, error: 'Trip not found', userId, tripId });
  //           io.emit('trip:negotiation:update', {
  //             success: false,
  //             error: 'Trip not found',
  //             userId,
  //             tripId,
  //           });
  //           return;
  //         }

  //         if (!['requested', 'negotiating'].includes(trip.status)) {
  //           cb?.({
  //             success: false,
  //             error: 'Negotiation not allowed for current trip status',
  //             userId,
  //             tripId,
  //           });
  //           io.emit('trip:negotiation:update', {
  //             success: false,
  //             error: 'Negotiation not allowed for current trip status',
  //             userId,
  //             tripId,
  //           });
  //           return;
  //         }
  //         ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //         if (from === 'driver') {
  //           const riderId = trip.riderId; // from schema
  //           const driverId = userId; // current user is driver
  //           const maxNegotiations = trip.maxNegotiations || 3;

  //           // 1) Make sure the thread exists (push if missing)
  //           await Trip.updateOne(
  //             {
  //               _id: tripId,
  //               negotiations: { $not: { $elemMatch: { driverId, riderId } } },
  //             },
  //             { $push: { negotiations: { driverId, riderId, count: 0 } } },
  //           );

  //           // 2) Atomic increment only if still below max
  //           const updated = await Trip.findOneAndUpdate(
  //             {
  //               _id: tripId,
  //               status: { $in: ['requested', 'negotiating'] },
  //               negotiations: {
  //                 $elemMatch: {
  //                   driverId,
  //                   riderId,
  //                   count: { $lt: maxNegotiations },
  //                 },
  //               },
  //             },
  //             {
  //               $inc: { 'negotiations.$[t].count': 1 },
  //               $set: {
  //                 'negotiations.$[t].lastOfferBy': 'driver',
  //                 'negotiations.$[t].lastAmount': amount,
  //                 'negotiations.$[t].updatedAt': new Date(),
  //                 currentFareOffer: amount,
  //                 status: 'negotiating',
  //               },
  //             },
  //             {
  //               new: true,
  //               arrayFilters: [
  //                 { 't.driverId': driverId, 't.riderId': riderId },
  //               ],
  //             },
  //           );

  //           if (!updated) {
  //             // Either max reached OR status changed
  //             // To respond with accurate count, read the thread:
  //             const fresh = await Trip.findById(tripId).lean();
  //             const thread = fresh?.negotiations?.find(
  //               (n) => n.driverId === driverId && n.riderId === riderId,
  //             );

  //             cb?.({
  //               success: false,
  //               error: 'Maximum number of negotiations reached',
  //               negotiationCount: thread?.count ?? 0,
  //               maxNegotiations,
  //               tripId,
  //               userId,
  //             });

  //             io.to(tripRoom(tripId)).emit('trip:negotiation:update', {
  //               success: false,
  //               error: 'Maximum number of negotiations reached',
  //               tripId,
  //               userId,
  //               negotiationCount: thread?.count ?? 0,
  //               maxNegotiations,
  //             });
  //             return;
  //           }

  //           const thread = updated.negotiations.find(
  //             (n) => n.driverId === driverId && n.riderId === riderId,
  //           );

  //           const payload = {
  //             tripId,
  //             userId,
  //             from,
  //             amount,
  //             riderId,
  //             driverId,
  //             negotiationCount: thread?.count ?? 0,
  //             maxNegotiations,
  //             status: updated.status,
  //           };

  //           io.to(tripRoom(tripId)).emit('trip:negotiation:update', payload);
  //           cb?.({ success: true, trip: updated });
  //         }

  //         ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //         // const maxNegotiations = trip.maxNegotiations || 3;
  //         // if (trip.negotiationCount >= maxNegotiations) {
  //         //   cb?.({
  //         //     success: false,
  //         //     error: 'Maximum number of negotiations reached',
  //         //     negotiationCount: trip.negotiationCount,
  //         //     maxNegotiations,
  //         //   });
  //         //   io.emit('trip:negotiation:update', {
  //         //     success: false,
  //         //     error: 'Maximum number of negotiations reached',
  //         //   });
  //         //   return;
  //         // }

  //         // trip.currentFareOffer = amount;
  //         // trip.negotiationCount = (trip.negotiationCount || 0) + 1;
  //         // trip.lastOfferBy = from;
  //         // trip.status = 'negotiating';

  //         await trip.save();

  //         const roomName = tripRoom(tripId);
  //         const payload = {
  //           tripId,
  //           userId,
  //           from,
  //           amount,
  //           negotiationCount: trip.negotiationCount,
  //           maxNegotiations,
  //           status: trip.status,
  //         };

  //         io.to(roomName).emit('trip:negotiation:update', payload);
  //         cb?.({ success: true, trip });
  //       }
  //     } catch (err) {
  //       console.error('Error in trip:negotiate', err);
  //       cb?.({ success: false, error: 'Internal server error' });
  //     }
  //   },
  // );

  socket.on(
    'trip:negotiate',
    async (
      data: {
        tripId: string;
        from: 'driver' | 'rider';
        amount: number;
        userId: string;
      },
      cb?: any,
    ) => {
      try {
        const { tripId, from, amount, userId } = data || ({} as any);
        if (!tripId) {
          const error = 'tripId is required';
          cb?.({ success: false, tripId, userId, amount, error });
          return;
        }
        if (!mongoose.Types.ObjectId.isValid(tripId)) {
          const roomName = tripRoom(tripId);
          const error = 'Invalid tripId format';
          cb?.({ success: false, error, userId, tripId });
          io.to(roomName).emit('trip:negotiation:update', {
            success: false,
            error,
            userId,
            tripId,
          });
          return;
        }
        const roomName = tripRoom(tripId);
        // ---------- Validation ----------
        if (
          !tripId ||
          !from ||
          typeof amount !== 'number' ||
          Number.isNaN(amount) ||
          !userId
        ) {
          const error =
            'tripId, from ("driver" or "rider"), amount (number), userId are required';

          cb?.({ success: false, tripId, userId, amount, error });
          io.to(roomName).emit('trip:negotiation:update', {
            success: false,
            error,
            tripId,
            userId,
            amount,
          });
          return;
        }

        if (from !== 'driver' && from !== 'rider') {
          const error = 'from must be "driver" or "rider"';
          cb?.({ success: false, error, userId, tripId });
          io.to(roomName).emit('trip:negotiation:update', {
            success: false,
            error,
            userId,
            tripId,
          });
          return;
        }

        if (amount <= 0) {
          const error = 'amount must be greater than zero';
          cb?.({ success: false, error, userId, tripId });
          io.to(roomName).emit('trip:negotiation:update', {
            success: false,
            error,
            userId,
            tripId,
          });
          return;
        }

        // Confirm user exists
        const user = await UserModel.findOne({ userID: userId });
        if (!user) {
          const error = 'User not found';
          cb?.({ success: false, userId, tripId, error });
          io.to(roomName).emit('trip:negotiation:update', {
            success: false,
            error,
            userId,
            tripId,
          });
          return;
        }

        // Load trip once (needed for riderId + status checks)
        const trip = await Trip.findById(tripId);
        if (!trip) {
          const error = 'Trip not found';
          cb?.({ success: false, error, userId, tripId });
          io.to(roomName).emit('trip:negotiation:update', {
            success: false,
            error,
            userId,
            tripId,
          });
          return;
        }

        if (!['requested', 'negotiating'].includes(trip.status)) {
          const error = 'Negotiation not allowed for current trip status';
          cb?.({ success: false, error, userId, tripId });
          io.to(roomName).emit('trip:negotiation:update', {
            success: false,
            error,
            userId,
            tripId,
          });
          return;
        }

        // =====================================================================================
        // DRIVER: increment count (pair scoped: tripId + driverId + riderId)
        // =====================================================================================
        if (from === 'driver') {
          const driver = await Driver.findOne({ driverId: userId });
          if (!driver) {
            const error = 'Driver not found';
            cb?.({ success: false, error, userId, tripId });
            io.to(roomName).emit('trip:negotiation:update', {
              success: false,
              error,
              userId,
              tripId,
            });
            return;
          }

          const riderId = trip.riderId;
          const driverId = userId;
          const maxNegotiations = trip.maxNegotiations || 3;

          // Optional but recommended: lock trip to a driver
          // if (!trip.driverId) {
          //   trip.driverId = driverId;
          //   await trip.save();
          // } else if (trip.driverId !== driverId) {
          //   const error = 'This trip is assigned to another driver';
          //   cb?.({ success: false, error, userId, tripId });
          //   io.to(roomName).emit('trip:negotiation:update', {
          //     success: false,
          //     error,
          //     userId,
          //     tripId,
          //   });
          //   return;
          // }

          // 1) Ensure negotiation thread exists
          await Trip.updateOne(
            {
              _id: tripId,
              negotiations: { $not: { $elemMatch: { driverId, riderId } } },
            },
            {
              $push: {
                negotiations: {
                  driverId,
                  riderId,
                  count: 0,
                  lastOfferBy: null,
                  lastAmount: null,
                  updatedAt: new Date(),
                },
              },
            },
          );

          // 2) Atomic increment only if below max
          const updated = await Trip.findOneAndUpdate(
            {
              _id: tripId,
              status: { $in: ['requested', 'negotiating'] },
              negotiations: {
                $elemMatch: {
                  driverId,
                  riderId,
                  count: { $lt: maxNegotiations },
                },
              },
            },
            {
              $inc: { 'negotiations.$[t].count': 1 },
              $set: {
                'negotiations.$[t].lastOfferBy': 'driver',
                'negotiations.$[t].lastAmount': amount,
                'negotiations.$[t].updatedAt': new Date(),
                fare: amount,
                status: 'negotiating',
              },
            },
            {
              new: true,
              arrayFilters: [{ 't.driverId': driverId, 't.riderId': riderId }],
            },
          );

          if (!updated) {
            // max reached (or status changed). Return accurate count.
            const fresh = await Trip.findById(tripId).lean();
            const thread = fresh?.negotiations?.find(
              (n: any) => n.driverId === driverId && n.riderId === riderId,
            );

            const error = 'Maximum number of negotiations reached';

            cb?.({
              success: false,
              error,
              tripId,
              userId,
              driverId,
              riderId,
              negotiationCount: thread?.count ?? 0,
              maxNegotiations,
            });

            io.to(roomName).emit('trip:negotiation:update', {
              success: false,
              error,
              tripId,
              userId,
              driverId,
              riderId,
              negotiationCount: thread?.count ?? 0,
              maxNegotiations,
            });
            return;
          }

          const thread = updated.negotiations.find(
            (n: any) => n.driverId === driverId && n.riderId === riderId,
          );

          const payload = {
            success: true,
            tripId,
            userId,
            from,
            amount,
            driverId,
            riderId,
            negotiationCount: thread?.count ?? 0, // pair-scoped
            maxNegotiations,
            status: updated.status,
            // currentFareOffer: updated.currentFareOffer,
          };

          io.to(roomName).emit('trip:negotiation:update', payload);
          cb?.({ success: true, trip: updated });
          return;
        }

        // =====================================================================================
        // RIDER: do NOT increment count (only update lastOfferBy/lastAmount in same thread)
        // =====================================================================================
        if (from === 'rider') {
          // Ensure this rider matches the trip rider
          if (trip.riderId !== userId) {
            const error = 'Not authorized: rider does not match this trip';
            cb?.({ success: false, error, userId, tripId });
            io.to(roomName).emit('trip:negotiation:update', {
              success: false,
              error,
              userId,
              tripId,
            });
            return;
          }

          // Need a driverId to identify the pair thread.
          // If driverId is not assigned yet, rider can still update trip.currentFareOffer
          // OR you can block rider negotiation until driver assigned.
          const driverId = trip.driverId;

          // If you want to block until driver assigned:
          // if (!driverId) {
          //   const error = 'No driver assigned yet; cannot negotiate with rider';
          //   cb?.({ success: false, error, userId, tripId });
          //   io.to(roomName).emit('trip:negotiation:update', {
          //     success: false,
          //     error,
          //     userId,
          //     tripId,
          //   });
          //   return;
          // }

          const riderId = trip.riderId;
          const maxNegotiations = trip.maxNegotiations || 3;

          // Ensure thread exists
          await Trip.updateOne(
            {
              _id: tripId,
              negotiations: { $not: { $elemMatch: { driverId, riderId } } },
            },
            {
              $push: {
                negotiations: {
                  driverId,
                  riderId,
                  count: 0,
                  lastOfferBy: null,
                  lastAmount: null,
                  updatedAt: new Date(),
                },
              },
            },
          );

          // Update last offer info WITHOUT incrementing count
          const updated = await Trip.findOneAndUpdate(
            { _id: tripId, status: { $in: ['requested', 'negotiating'] } },
            {
              $set: {
                'negotiations.$[t].lastOfferBy': 'rider',
                'negotiations.$[t].lastAmount': amount,
                'negotiations.$[t].updatedAt': new Date(),
                fare: amount,
                status: 'negotiating',
              },
            },
            {
              new: true,
              arrayFilters: [{ 't.driverId': driverId, 't.riderId': riderId }],
            },
          );

          const thread = updated?.negotiations?.find(
            (n: any) => n.driverId === driverId && n.riderId === riderId,
          );

          const payload = {
            success: true,
            tripId,
            userId,
            from,
            amount,
            driverId,
            riderId,
            negotiationCount: thread?.count ?? 0, // unchanged
            maxNegotiations,
            status: updated?.status ?? trip.status,
            // currentFareOffer:
            //   updated?.currentFareOffer ?? trip.currentFareOffer,
          };

          io.to(roomName).emit('trip:negotiation:update', payload);
          cb?.({ success: true, trip: updated ?? trip });
          return;
        }
      } catch (err) {
        console.error('Error in trip:negotiate', err);
        cb?.({ success: false, error: 'Internal server error' });
      }
    },
  );
  socket.on('trip:location', async (data: DriverLocationPayload, cb?: any) => {
    try {
      const { driverId, tripId, lat, lng } = data;

      if (
        !driverId ||
        !tripId ||
        typeof lat !== 'number' ||
        typeof lng !== 'number'
      ) {
        const err = 'driverId, tripId, lat (number), lng (number) are required';
        logger.error(err);
        cb?.({ success: false, error: err });
        io.to(`trip:${tripId}`).emit('trip:location:update', {
          success: false,
          err,
          updatedAt: new Date(),
        });
        return;
      }

      const driver = await Driver.findOne({ driverId });
      if (!driver) {
        const err = 'Driver not found';
        logger.error(err);
        cb?.({ success: false, error: err });
        io.to(`trip:${tripId}`).emit('trip:location:update', {
          success: false,
          err,
          updatedAt: new Date(),
        });
        return;
      }

      if (!driver?.online) {
        const err = 'Driver not online';
        logger.error(err);
        cb?.({ success: false, error: err });
        io.to(`trip:${tripId}`).emit('trip:location:update', {
          success: false,
          err,
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
      const location = {
        lat,
        lng,
        updatedAt: new Date(),
      };
      // optionally attach last driver location to trip
      const trip = await Trip.findByIdAndUpdate(
        { _id: tripId, driverId },
        {
          $set: {
            lastDriverLocation: location,
          },
          $push: {
            allLocations: location,
          },
        },
        {
          new: true,
        },
      );
      if (!trip) {
        const err = 'trip not found';
        logger.error(err);
        io.to(`trip:${tripId}`).emit('trip:location:update', {
          success: false,
          err,
          updatedAt: new Date(),
        });
        cb?.({ success: false, error: err });
        return;
      }
      logger.info(
        `SOCKET trip location: ${driverId}, trip=${tripId}, ${lat}, ${lng}`,
      );

      io.to(`trip:${tripId}`).emit('trip:location:update', {
        trip,
        lat,
        lng,
        updatedAt: new Date(),
      });

      cb?.({ success: true, driver });
    } catch (err) {
      logger.error('Error in socket driver:location', err as any);
      cb?.({ success: false, error: 'Internal server error' });
    }
  });
  socket.on(
    'offer:send',
    async (
      data: {
        tripId: string;
        riderId: string;
        driverId: string;
        amount: number;
        role: 'driver' | 'rider';
      },
      cb?: (res: any) => void,
    ) => {
      try {
        const { tripId, riderId, driverId, amount, role } = data || {};
        const roomName = tripRoom(tripId);

        // ── validation ──
        const baseError = validateBase({ tripId, riderId, driverId, amount });
        if (baseError) {
          cb?.({ success: false, error: baseError });
          io.to(roomName).emit('offer:update', {
            success: false,
            error: baseError,
          });
          return;
        }

        if (role !== 'driver' && role !== 'rider') {
          cb?.({ success: false, error: 'role must be "driver" or "rider"' });
          io.to(roomName).emit('offer:update', {
            success: false,
            error: 'role must be "driver" or "rider"',
          });
          return;
        }

        // ── load trip ──
        const trip = await Trip.findById(tripId);
        if (!trip) {
          cb?.({ success: false, error: 'Trip not found' });
          io.to(roomName).emit('offer:update', {
            success: false,
            error: 'Trip not found',
          });
          return;
        }

        if (!['requested', 'negotiating'].includes(trip.status)) {
          cb?.({
            success: false,
            error: 'Negotiation not allowed for current trip status',
          });
          io.to(roomName).emit('offer:update', {
            success: false,
            error: 'Negotiation not allowed for current trip status',
          });
          return;
        }
        const maxNegotiations = trip.maxNegotiations ?? 3;
        const existingCount = await OfferModel.countDocuments({
          tripId,
          driverId,
          riderId,
          // only driver offers count toward the limit
          role: 'driver',
          status: { $ne: 'cancelled' },
        });

        // if (role === 'driver' && existingCount >= maxNegotiations) {
        //   const error = 'Maximum number of negotiations reached';
        //   cb?.({
        //     success: false,
        //     error,
        //     negotiationCount: existingCount,
        //     maxNegotiations,
        //   });
        //   io.to(roomName).emit('offer:update', {
        //     success: false,
        //     error,
        //     tripId,
        //     driverId,
        //     riderId,
        //     negotiationCount: existingCount,
        //     maxNegotiations,
        //   });
        //   return;
        // }

        // ── create offer ──
        const offer = await OfferModel.create({
          tripId,
          riderId,
          driverId,
          amount,
          role,
          status: 'negotiating',
        });

        // keep trip status in sync
        await Trip.findByIdAndUpdate(tripId, {
          $set: { status: 'negotiating', fare: amount },
        });

        const payload = {
          success: true,
          offerId: offer._id,
          tripId,
          riderId,
          driverId,
          amount,
          role,
          status: offer.status,
          negotiationCount: 0,
          // negotiationCount:
          //   role === 'driver' ? existingCount + 1 : existingCount,
          maxNegotiations,
        };

        io.to(roomName).emit('offer:send', payload);
        io.to(roomName).emit('offer:update', payload);
        cb?.({ success: true, offer });
      } catch (err) {
        console.error('Error in offer:send', err);
        cb?.({ success: false, error: 'offer:update Failed' });
      }
    },
  );

  // ─── cancelOffer ──────────────────────────────────────────────────────────────
  // Sets offer status → 'cancelled'
  // Emits: offer:update to the trip room

  socket.on(
    'offer:cancel',
    async (
      data: { offerId: string; userId: string },
      cb?: (res: any) => void,
    ) => {
      try {
        const { offerId, userId } = data || {};

        if (!offerId) {
          cb?.({ success: false, error: 'offerId is required' });
          return;
        }
        if (!userId) {
          cb?.({ success: false, error: 'userId is required' });
          return;
        }

        const offer = await OfferModel.findById(offerId);
        if (!offer) {
          cb?.({ success: false, error: 'Offer not found' });
          return;
        }

        // Only the offer creator (driverId or riderId matching their role) may cancel
        // const isOwner =
        // (offer.role === 'driver' && offer.driverId === userId)
        //     ||(offer.role === 'rider' && offer.riderId === userId);

        // if (!isOwner) {
        //   cb?.({
        //     success: false,
        //     error: 'Not authorized to cancel this offer',
        //   });
        //   return;
        // }

        if (offer.status !== 'negotiating') {
          cb?.({
            success: false,
            error: `Cannot cancel an offer with status "${offer.status}"`,
          });
          return;
        }

        offer.status = 'cancelled';
        await offer.save();

        const roomName = tripRoom(offer.tripId);
        const payload = {
          success: true,
          offerId: offer._id,
          tripId: offer.tripId,
          riderId: offer.riderId,
          driverId: offer.driverId,
          amount: offer.amount,
          role: offer.role,
          status: offer.status,
        };

        io.to(roomName).emit('offer:update', payload);
        cb?.({ success: true, offer });
      } catch (err) {
        console.error('Error in offer:cancel', err);
        cb?.({ success: false, error: 'Internal server error' });
      }
    },
  );

  // ─── acceptOffer ──────────────────────────────────────────────────────────────
  // Sets offer status → 'accepted'
  // Writes { amount, driverId } back onto the Trip document
  // Emits: offer:update to the trip room

  socket.on(
    'offer:accept',
    async (
      data: { offerId: string; userId: string },
      cb?: (res: any) => void,
    ) => {
      try {
        const { offerId, userId } = data || {};

        if (!offerId) {
          cb?.({ success: false, error: 'offerId is required' });
          return;
        }
        if (!userId) {
          cb?.({ success: false, error: 'userId is required' });
          return;
        }

        const offer = await OfferModel.findById(offerId);
        if (!offer) {
          cb?.({ success: false, error: 'Offer not found' });
          return;
        }

        if (offer.status !== 'negotiating') {
          cb?.({
            success: false,
            error: `Cannot accept an offer with status "${offer.status}"`,
          });
          return;
        }

        // The *counter-party* accepts:
        //   driver offer → rider accepts  (userId === riderId)
        //   rider  offer → driver accepts (userId === driverId)
        // const isCounterParty =
        //   (offer.role === 'driver' && offer.riderId === userId) ||
        //   (offer.role === 'rider' && offer.driverId === userId);

        // if (!isCounterParty) {
        //   cb?.({
        //     success: false,
        //     error: 'Not authorized to accept this offer',
        //   });
        //   return;
        // }
        const notAllow = await Trip.findOne({
          driverId: offer.driverId,
          status: {
            $in: ['accepted', 'driver_on_the_way', 'running', 'driver_arrived'],
          },
        });
        if (notAllow) {
          cb?.({
            success: false,
            error: `هذا السائق غير متاح حاليا`,
            offer,
          });
          return;
        }
        const trip = await Trip.findById(offer.tripId);

        if (!trip) {
          cb?.({ success: false, error: 'Trip not found', trip });
          return;
        }
        if (trip.status == 'cancelled') {
          cb?.({
            success: false,
            error: 'هذه الرحله تم الغائها من قبل العميل',
            trip,
          });
          return;
        }

        // ── update trip: stamp accepted fare + driverId ──
        // const updatedTrip = await Trip.findByIdAndUpdate(
        //   offer.tripId,
        //   {
        //     $set: {
        //       fare: offer.amount,
        //       driverId: offer.driverId,
        //       status: 'accepted',
        //     },
        //   },
        //   { new: true },
        // );
        const updatedTrip = await Trip.findOneAndUpdate(
          {
            _id: trip._id,
            status: { $in: ['requested', 'negotiating'] },
            driverId: null,
          },
          {
            $set: {
              driverId: offer.driverId,
              status: 'accepted',
              fare: offer.amount,
              acceptedAt: new Date(),
            },
          },
          { new: true },
        );
        if (!updatedTrip) {
          cb?.({
            success: false,
            trip,
            error: 'Trip already taken or not acceptable',
          });
          return;
        }

        const acceptedOffer = await OfferModel.findOneAndUpdate(
          { _id: offer._id, status: 'negotiating' },
          { $set: { status: 'accepted' } },
          { new: true },
        );
        if (!acceptedOffer) {
          await Trip.findOneAndUpdate(
            {
              _id: updatedTrip._id,
              driverId: offer.driverId,
              status: 'accepted',
            },
            {
              $set: { driverId: null, status: trip.status, fare: trip.fare },
              $unset: { acceptedAt: 1 },
            },
          );
          cb?.({
            success: false,
            trip,
            error: 'Offer is no longer available',
          });
          return;
        }

        const roomName = tripRoom(offer.tripId);
        const payload = {
          success: true,
          offerId: offer._id,
          tripId: offer.tripId,
          riderId: offer.riderId,
          driverId: offer.driverId,
          amount: offer.amount,
          role: offer.role,
          status: acceptedOffer.status,
          trip: updatedTrip,
        };

        io.to(roomName).emit('offer:update', payload);
        cb?.({ success: true, offer: acceptedOffer, trip: updatedTrip });
      } catch (err) {
        console.error('Error in offer:accept', err);
        cb?.({ success: false, error: 'Error in offer:accept' });
      }
    },
  );
};
