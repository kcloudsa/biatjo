// src/routes/actions.ts
import { Router, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import passport from 'passport';

import { Trip } from '../src/models/TripModel';
import { Driver } from '../src/models/DriverModel';
import UserModel from '../src/models/userModel';

import { TripStatus } from '../src/interfaces/ITrip';
import { CarKindEnum } from '../src/interfaces/ICar';

import { routeErrorHandler } from '../src/middlewares/routeSetup';
import { optionalAuthenticateJWT } from '../src/services/historyServices';

// IMPORTANT: align with socket code
import { tripRoom } from '../src/SocketEvent/Rooms';

const router = Router();

const getIO = (req: Request): SocketIOServer => {
  return req.app.get('io') as SocketIOServer;
};

/**
 * 1) Driver goes online
 * POST /api/drivers/online
 * body: { "driverId": "driver-123", "lat": number, "lng": number }
 */
router.post(
  '/drivers/online',
  optionalAuthenticateJWT(passport),
  async (req: Request, res: Response) => {
    try {
      const { driverId, lat, lng } = req.body;

      if (!driverId) {
        return res.status(400).json({ error: 'driverId is required' });
      }

      const isValidNumber = (n: unknown): n is number =>
        typeof n === 'number' && Number.isFinite(n);

      if (!isValidNumber(lat) || !isValidNumber(lng)) {
        return res
          .status(400)
          .json({ error: 'lat and lng (finite numbers) are required' });
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ error: 'lat/lng out of range' });
      }

      const user = await UserModel.findOne({ userID: driverId }).select('role');
      if (!user) return res.status(404).json({ error: 'User not found' });
      if (user.role !== 'driver') {
        return res.status(400).json({ error: 'This user is not Driver' });
      }

      const now = new Date();
      const driver = await Driver.findOneAndUpdate(
        { driverId },
        {
          $set: {
            lastLocation: { lat, lng, updatedAt: now },
            location: { type: 'Point', coordinates: [lng, lat] },
            online: true,
            lastOnlineAt: now,
          },
        },
        { new: true },
      );

      if (!driver) {
        return res.status(404).json({ error: 'Driver not found' });
      }

      const io = getIO(req);

      io.emit('driver:online', {
        driverId,
        lat,
        lng,
        updatedAt: now.toISOString(),
      });

      return res.json({ success: true, driver });
    } catch (err) {
      console.error('Error in /drivers/online', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * 2) Driver location update
 * POST /api/drivers/location
 * body: { "driverId": "...", "tripId": "...", "lat": number, "lng": number }
 */
router.post(
  '/drivers/location',
  optionalAuthenticateJWT(passport),
  async (req: Request, res: Response) => {
    try {
      const { driverId, tripId, lat, lng } = req.body;

      if (
        !driverId ||
        !tripId ||
        typeof lat !== 'number' ||
        typeof lng !== 'number'
      ) {
        return res.status(400).json({
          error: 'driverId, tripId, lat (number), lng (number) are required',
        });
      }

      const user = await UserModel.findOne({ userID: driverId });
      if (!user) return res.status(404).json({ error: 'Driver not found' });

      const driver = await Driver.findOne({ driverId });
      if (!driver) return res.status(404).json({ error: 'Driver not found' });

      const io = getIO(req);

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
        { upsert: true },
      );

      // Optional trip attachment skipped as before
      await Trip.findByIdAndUpdate(tripId, { $set: {} }).catch(() => {});

      const roomName = tripRoom(tripId);
      io.to(roomName).emit('driver:location:update', { driverId, lat, lng });

      return res.json({ success: true });
    } catch (err) {
      console.error('Error in /drivers/location', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * 3) Rider requests a trip (UPDATED to match socket code)
 * POST /api/riders/request-trip
 * body: {
 *   riderId,
 *   pickup: {lat,lng},
 *   dropoff: {lat,lng},
 *   initialFare?,
 *   loadDescription?,
 *   loadWeight?,
 *   carKind?,
 *   transportType?,
 *   isScheduled?,
 *   tripTime?
 * }
 */
router.post(
  '/riders/request-trip',
  optionalAuthenticateJWT(passport),
  async (req: Request, res: Response) => {
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
      } = req.body;

      if (!riderId || !pickup || !dropoff) {
        return res
          .status(400)
          .json({ error: 'riderId, pickup, dropoff are required' });
      }

      if (
        typeof pickup.lat !== 'number' ||
        typeof pickup.lng !== 'number' ||
        typeof dropoff.lat !== 'number' ||
        typeof dropoff.lng !== 'number'
      ) {
        return res.status(400).json({
          error:
            'pickup.lat, pickup.lng, dropoff.lat, dropoff.lng must be numbers',
        });
      }

      if (carKind) {
        const validCarKinds = Object.values(CarKindEnum);
        if (!validCarKinds.includes(carKind)) {
          return res.status(400).json({
            error: `Invalid carKind. Must be one of: ${validCarKinds.join(
              ', ',
            )}`,
          });
        }
      }

      const user = await UserModel.findOne({ userID: riderId });
      if (!user) return res.status(404).json({ error: 'Rider not found' });

      const io = getIO(req);

      const startingFare = typeof initialFare === 'number' ? initialFare : 0;
      if (isScheduled && tripTime == 0) {
        return res
          .status(404)
          .json({ error: 'when trip isScheduled ,its tripTime is required ' });
      }
      const trip = await Trip.create({
        riderId,
        pickup,
        dropoff,
        driverId: null,
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

      // Mirror socket: io.emit('trip:new', ...)
      io.emit('trip:new', {
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
      });

      // Nearby drivers dynamic radius search (same logic as socket)
      const pickupPoint = {
        type: 'Point',
        coordinates: [pickup.lng, pickup.lat],
      };

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

      // Mirror socket: io.emit('rider:request_trip', payload)
      io.emit('rider:request_trip', payload);

      return res.json({ success: true, trip, ...payload });
    } catch (err) {
      console.error('Error in /riders/request-trip', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * 4) Driver accepts a trip (UPDATED to match socket code)
 * POST /api/trips/accept
 * body: { tripId, driverId, riderId, amount }
 */
router.post(
  '/trips/accept',
  optionalAuthenticateJWT(passport),
  async (req: Request, res: Response) => {
    try {
      const { tripId, driverId, riderId, amount } = req.body;

      if (!tripId || !driverId || !riderId || !amount) {
        return res.status(400).json({
          error: 'tripId, driverId, riderId and amount are required',
        });
      }

      if (!mongoose.Types.ObjectId.isValid(tripId)) {
        return res.status(400).json({ error: 'Invalid tripId format' });
      }

      const rider = await UserModel.findOne({ userID: riderId });
      if (!rider) return res.status(404).json({ error: 'Rider not found' });

      const driver = await Driver.findOne({ driverId });
      if (!driver) return res.status(404).json({ error: 'Driver not found' });

      const trip = await Trip.findById(tripId);
      if (!trip) return res.status(404).json({ error: 'Trip not found' });

      if (!['requested', 'negotiating'].includes(trip.status)) {
        return res.status(400).json({
          error: 'Trip cannot be accepted in current status',
        });
      }

      trip.driverId = driverId;
      trip.status = 'accepted';
      if (trip.fare !== amount) trip.fare = amount;

      await trip.save();

      const io = getIO(req);
      const roomName = tripRoom(tripId);

      io.to(roomName).emit('trip:accepted', {
        tripId,
        driverId,
        riderId,
        status: trip.status,
        agreedFare: trip.fare,
      });

      return res.json({ success: true, trip });
    } catch (err) {
      console.error('Error in /trips/accept', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * 5) Trip status update (roomName aligned)
 * POST /api/trips/update
 * body: { "tripId": "...", "status": "on_route" }
 */
router.post(
  '/trips/update',
  optionalAuthenticateJWT(passport),
  async (req: Request, res: Response) => {
    try {
      const { tripId, status } = req.body as {
        tripId: string;
        status: TripStatus;
      };

      if (!tripId || !status) {
        return res
          .status(400)
          .json({ error: 'tripId and status are required' });
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
        return res.status(400).json({ error: 'Invalid status' });
      }

      const trip = await Trip.findByIdAndUpdate(
        { _id: tripId },
        { $set: { status } },
        { new: true },
      );

      if (!trip) return res.status(404).json({ error: 'Trip not found' });

      const io = getIO(req);
      const roomName = tripRoom(tripId);

      io.to(roomName).emit('trip:update', { tripId, status });

      return res.json({ success: true, trip });
    } catch (err) {
      console.error('Error in /trips/update', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
);
router.get(
  '/trips/all',
  optionalAuthenticateJWT(passport),
  async (req: Request, res: Response) => {
    try {
      const trips = await Trip.find({
        status: { $in: ['requested', 'negotiating'] },
      });

      return res.json({
        success: true,
        count: trips.length,
        trips,
      });
    } catch (err) {
      console.error('Error in /trips/all', err);
      return res.status(500).json({ error: 'Error in /trips/all' });
    }
  },
);
router.get(
  '/alltrips',
  optionalAuthenticateJWT(passport),
  async (req: Request, res: Response) => {
    try {
      const page = Math.max(parseInt(req.query.page as string) || 1, 1);
      const limit = Math.max(parseInt(req.query.limit as string) || 10, 1);
      const skip = (page - 1) * limit;

      // Build a dynamic filter object
      const filter: Record<string, any> = {};

      if (req.query.status) {
        filter.status = req.query.status;
      }

      if (req.query.search) {
        const q = new RegExp(req.query.search as string, 'i');

        filter.$or = [
          { 'pickup.address': q },
          { 'dropoff.address': q },
          { loadDescription: q },
          { riderId: q },
          { driverId: q },
        ];
      }

      // Filter by createdAt
      const fromDate = req.query.fromDate as string | undefined;
      const toDate = req.query.toDate as string | undefined;

      if (fromDate || toDate) {
        filter.createdAt = {};

        if (fromDate) {
          filter.createdAt.$gte = new Date(`${fromDate}T00:00:00.000Z`);
        }

        if (toDate) {
          filter.createdAt.$lte = new Date(`${toDate}T23:59:59.999Z`);
        }
      }

      const [trips, totalTrips] = await Promise.all([
        Trip.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
        Trip.countDocuments(filter),
      ]);

      return res.json({
        success: true,
        count: trips.length,
        totalTrips,
        totalPages: Math.ceil(totalTrips / limit),
        currentPage: page,
        limit,
        trips,
      });
    } catch (err) {
      console.error('Error in /trips/all', err);
      return res.status(500).json({ error: 'Error in /trips/all' });
    }
  },
);
router.get(
  '/alltripstoday',
  optionalAuthenticateJWT(passport),
  async (req: Request, res: Response) => {
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const startOfTomorrow = new Date(startOfToday);
      startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
      const startTimestamp = startOfToday.getTime();
      const endTimestamp = startOfTomorrow.getTime();
      const trips = await Trip.find({
        $or: [
          {
            isScheduled: false,
            createdAt: {
              $gte: startOfToday,
              $lt: startOfTomorrow,
            },
          },
          {
            isScheduled: true,
            tripTime: {
              $gte: startTimestamp,
              $lt: endTimestamp,
            },
          },
        ],
      }).sort({ createdAt: -1 });

      return res.json({
        success: true,
        count: trips.length,
        trips,
      });
    } catch (err) {
      console.error('Error in /alltripstoday', err);
      return res.status(500).json({ error: 'Error in /alltripstoday' });
    }
  },
);
router.delete(
  '/trips/delete/:id',
  optionalAuthenticateJWT(passport),
  async (req: Request, res: Response) => {
    try {
      // fix id
      const id = req.params.id as string;
      if (!id) {
        return res
          .status(400)
          .json({ success: false, error: 'trip Id is required' });
      }
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid tripId format' });
      }
      const trip = await Trip.findByIdAndDelete(id);
      if (!trip) {
        return res
          .status(400)
          .json({ success: false, error: 'tripId not found' });
      }

      return res.json({
        success: true,
        trip,
      });
    } catch (err) {
      console.error('Error in /trips/delete/:id', err);
      return res
        .status(500)
        .json({ success: false, error: 'Error in /trips/delete/:id' });
    }
  },
);

/**
 * 6) Trip completed (roomName aligned)
 * POST /api/trips/complete
 * body: { "tripId": "...", "fare": 42.75 }
 */
router.post(
  '/trips/complete',
  optionalAuthenticateJWT(passport),
  async (req: Request, res: Response) => {
    try {
      const { tripId, fare } = req.body;

      if (!tripId || typeof fare !== 'number') {
        return res
          .status(400)
          .json({ error: 'tripId and fare (number) are required' });
      }

      const trip = await Trip.findByIdAndUpdate(
        { _id: tripId },
        {
          $set: {
            status: 'completed',
            fare,
            completedAt: new Date(),
          },
        },
        { new: true },
      );

      if (!trip) return res.status(404).json({ error: 'Trip not found' });

      const io = getIO(req);
      const roomName = tripRoom(tripId);

      io.to(roomName).emit('trip:completed', { tripId, fare });

      return res.json({ success: true, trip });
    } catch (err) {
      console.error('Error in /trips/complete', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * 7) Trip negotiate (UPDATED to match socket code)
 * POST /api/trips/negotiate
 * body: { tripId, from: 'driver' | 'rider', amount: number, userId: string }
 */
router.post(
  '/trips/negotiate',
  optionalAuthenticateJWT(passport),
  async (req: Request, res: Response) => {
    try {
      const { tripId, from, amount, userId } = req.body as {
        tripId: string;
        from: 'driver' | 'rider';
        amount: number;
        userId: string;
      };

      if (!tripId) {
        return res.status(400).json({ error: 'tripId is required' });
      }

      if (!mongoose.Types.ObjectId.isValid(tripId)) {
        return res.status(400).json({ error: 'Invalid tripId format' });
      }

      if (
        !from ||
        typeof amount !== 'number' ||
        Number.isNaN(amount) ||
        !userId
      ) {
        return res.status(400).json({
          error:
            'tripId, from ("driver" or "rider"), amount (number), userId are required',
        });
      }

      if (from !== 'driver' && from !== 'rider') {
        return res
          .status(400)
          .json({ error: 'from must be "driver" or "rider"' });
      }

      if (amount <= 0) {
        return res
          .status(400)
          .json({ error: 'amount must be greater than zero' });
      }

      const io = getIO(req);
      const roomName = tripRoom(tripId);

      const user = await UserModel.findOne({ userID: userId });
      if (!user) {
        io.to(roomName).emit('trip:negotiation:update', {
          success: false,
          error: 'User not found',
          userId,
          tripId,
        });
        return res.status(404).json({ error: 'User not found' });
      }

      const trip = await Trip.findById(tripId);
      if (!trip) {
        io.to(roomName).emit('trip:negotiation:update', {
          success: false,
          error: 'Trip not found',
          userId,
          tripId,
        });
        return res.status(404).json({ error: 'Trip not found' });
      }

      if (!['requested', 'negotiating'].includes(trip.status)) {
        io.to(roomName).emit('trip:negotiation:update', {
          success: false,
          error: 'Negotiation not allowed for current trip status',
          userId,
          tripId,
        });
        return res.status(400).json({
          error: 'Negotiation not allowed for current trip status',
        });
      }

      // ==========================
      // DRIVER: increment count
      // ==========================
      if (from === 'driver') {
        const driver = await Driver.findOne({ driverId: userId });
        if (!driver) {
          io.to(roomName).emit('trip:negotiation:update', {
            success: false,
            error: 'Driver not found',
            userId,
            tripId,
          });
          return res.status(404).json({ error: 'Driver not found' });
        }

        const riderId = trip.riderId;
        const driverId = userId;
        const maxNegotiations = trip.maxNegotiations || 3;

        // 1) Ensure thread exists
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
          const fresh = await Trip.findById(tripId).lean();
          const thread = (fresh as any)?.negotiations?.find(
            (n: any) => n.driverId === driverId && n.riderId === riderId,
          );

          const payload = {
            success: false,
            error: 'Maximum number of negotiations reached',
            tripId,
            userId,
            driverId,
            riderId,
            negotiationCount: thread?.count ?? 0,
            maxNegotiations,
          };

          io.to(roomName).emit('trip:negotiation:update', payload);
          return res.status(400).json(payload);
        }

        const thread = (updated as any).negotiations.find(
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
          negotiationCount: thread?.count ?? 0,
          maxNegotiations,
          status: updated.status,
        };

        io.to(roomName).emit('trip:negotiation:update', payload);
        return res.json({ success: true, trip: updated });
      }

      // ==========================
      // RIDER: do NOT increment
      // ==========================
      if (from === 'rider') {
        if (trip.riderId !== userId) {
          const payload = {
            success: false,
            error: 'Not authorized: rider does not match this trip',
            userId,
            tripId,
          };
          io.to(roomName).emit('trip:negotiation:update', payload);
          return res.status(403).json(payload);
        }

        const riderId = trip.riderId;
        const driverId = trip.driverId;

        // Safer than the socket version: rider needs a driverId thread target
        if (!driverId) {
          const payload = {
            success: false,
            error: 'No driver assigned yet; cannot negotiate as rider',
            userId,
            tripId,
          };
          io.to(roomName).emit('trip:negotiation:update', payload);
          return res.status(400).json(payload);
        }

        const maxNegotiations = trip.maxNegotiations || 3;

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

        const thread = (updated as any)?.negotiations?.find(
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
          negotiationCount: thread?.count ?? 0,
          maxNegotiations,
          status: updated?.status ?? trip.status,
        };

        io.to(roomName).emit('trip:negotiation:update', payload);
        return res.json({ success: true, trip: updated ?? trip });
      }

      // fallback (should never happen)
      return res.status(400).json({ error: 'Invalid negotiation request' });
    } catch (err) {
      console.error('Error in /trips/negotiate', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * 8) Get all scheduled trips
 * GET /api/trips/scheduled
 * Query: ?page=1&limit=20
 * Returns: Paginated list of all trips where isScheduled is true
 */
router.get(
  '/trips/scheduled',
  optionalAuthenticateJWT(passport),
  async (req: Request, res: Response) => {
    try {
      // Extract pagination parameters from query
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      if (page < 1 || limit < 1) {
        return res
          .status(400)
          .json({ error: 'page and limit must be positive integers' });
      }

      // Get total count of scheduled trips
      const totalTrips = await Trip.countDocuments({
        isScheduled: true,
        status: {
          $nin: ['completed', 'cancelled'],
        },
      });

      // Fetch paginated scheduled trips
      const trips = await Trip.find({
        isScheduled: true,
        status: {
          $nin: ['completed', 'cancelled'],
        },
      })
        .skip(skip)
        .limit(limit)
        .sort({ tripTime: -1 }); // Most recent first

      // Return paginated response
      return res.status(200).json({
        success: true,
        data: trips,
        total: totalTrips,
        page,
        limit,
        totalPages: Math.ceil(totalTrips / limit),
        hasMore: page * limit < totalTrips,
      });
    } catch (err) {
      console.error('Error in /trips/scheduled', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
);
/**
 * 9) Get all trips by riderId
 * GET /api/trips/rider/:riderId
 * Query: ?page=1&limit=20
 * Returns: Paginated list of all trips for a specific user
 */
router.get(
  // '/trips/rider/:riderId',
  '/trips/rider/nopage/:riderId',
  optionalAuthenticateJWT(passport),
  async (req: Request, res: Response) => {
    try {
      const { riderId } = req.params;

      // Validate userId
      // if (!mongoose.Types.ObjectId.isValid(riderId)) {
      //   return res.status(400).json({ error: 'Invalid userId' });
      // }

      // Extract pagination parameters from query
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      if (page < 1 || limit < 1) {
        return res
          .status(400)
          .json({ error: 'page and limit must be positive integers' });
      }

      // Count total trips for this user
      const totalTrips = await Trip.countDocuments({ riderId });

      // Fetch paginated trips for this user
      const trips = await Trip.find({ riderId })
        // .skip(skip)
        // .limit(limit)
        .sort({ tripTime: -1 }); // Most recent first

      return res.status(200).json({
        success: true,
        data: trips,
        total: totalTrips,
        // page,
        // limit,
        // totalPages: Math.ceil(totalTrips / limit),
        // hasMore: page * limit < totalTrips,
      });
    } catch (err) {
      console.error('Error in /trips/user/:riderId', err);
      return res.status(500).json({ error: 'Error in /trips/user/:riderId' });
    }
  },
);
router.get(
  '/trips/rider/:riderId',
  optionalAuthenticateJWT(passport),
  async (req: Request, res: Response) => {
    try {
      const { riderId } = req.params;

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      if (page < 1 || limit < 1) {
        return res
          .status(400)
          .json({ error: 'page and limit must be positive integers' });
      }

      const filter: Record<string, any> = {
        riderId,
      };

      const fromDate = req.query.fromDate as string | undefined;
      const toDate = req.query.toDate as string | undefined;

      if (fromDate || toDate) {
        filter.createdAt = {};

        if (fromDate) {
          filter.createdAt.$gte = new Date(`${fromDate}T00:00:00.000Z`);
        }

        if (toDate) {
          filter.createdAt.$lte = new Date(`${toDate}T23:59:59.999Z`);
        }
      }

      const [totalTrips, trips] = await Promise.all([
        Trip.countDocuments(filter),
        Trip.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      ]);

      return res.status(200).json({
        success: true,
        data: trips,
        total: totalTrips,
        page,
        limit,
        totalPages: Math.ceil(totalTrips / limit),
        hasMore: page * limit < totalTrips,
      });
    } catch (err) {
      console.error('Error in /trips/rider/:riderId', err);
      return res.status(500).json({ error: 'Error in /trips/rider/:riderId' });
    }
  },
);
/**
 * 9) Get all trips by driverId
 * GET /api/trips/driver/:driverId
 * Query: ?page=1&limit=20
 * Returns: Paginated list of all trips for a specific user
 */
router.get(
  '/trips/driver/:driverId',
  optionalAuthenticateJWT(passport),
  async (req: Request, res: Response) => {
    try {
      const { driverId } = req.params;

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      if (page < 1 || limit < 1) {
        return res
          .status(400)
          .json({ error: 'page and limit must be positive integers' });
      }

      const filter: Record<string, any> = {
        driverId,
      };

      const fromDate = req.query.fromDate as string | undefined;
      const toDate = req.query.toDate as string | undefined;

      if (fromDate || toDate) {
        filter.createdAt = {};

        if (fromDate) {
          filter.createdAt.$gte = new Date(`${fromDate}T00:00:00.000Z`);
        }

        if (toDate) {
          filter.createdAt.$lte = new Date(`${toDate}T23:59:59.999Z`);
        }
      }

      const [totalTrips, trips] = await Promise.all([
        Trip.countDocuments(filter),
        Trip.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      ]);

      return res.status(200).json({
        success: true,
        data: trips,
        total: totalTrips,
        page,
        limit,
        totalPages: Math.ceil(totalTrips / limit),
        hasMore: page * limit < totalTrips,
      });
    } catch (err) {
      console.error('Error in /trips/driver/:driverId', err);
      return res
        .status(500)
        .json({ error: 'Error in /trips/driver/:driverId' });
    }
  },
);
router.get(
  '/trips/driver/nopage/:driverId',
  optionalAuthenticateJWT(passport),
  async (req: Request, res: Response) => {
    try {
      const { driverId } = req.params;

      // Validate driverId
      // if (!mongoose.Types.ObjectId.isValid(driverId)) {
      //   return res.status(400).json({ error: 'Invalid driverId' });
      // }

      // Extract pagination parameters from query
      // const page = parseInt(req.query.page as string) || 1;
      // const limit = parseInt(req.query.limit as string) || 20;
      // const skip = (page - 1) * limit;

      // if (page < 1 || limit < 1) {
      //   return res
      //     .status(400)
      //     .json({ error: 'page and limit must be positive integers' });
      // }

      // Count total trips for this user
      const totalTrips = await Trip.countDocuments({ driverId });

      // Fetch paginated trips for this user
      const trips = await Trip.find({ driverId })
        // .skip(skip)
        // .limit(limit)
        .sort({ tripTime: -1 }); // Most recent first

      return res.status(200).json({
        success: true,
        data: trips,
        total: totalTrips,
        // page,
        // limit,
        // totalPages: Math.ceil(totalTrips / limit),
        // hasMore: page * limit < totalTrips,
      });
    } catch (err) {
      console.error('Error in /trips/user/:driverId', err);
      return res.status(500).json({ error: 'Error in /trips/user/:driverId' });
    }
  },
);
router.delete(
  '/user/:userID',
  optionalAuthenticateJWT(passport),
  async (req: Request, res: Response) => {
    try {
      const { userID } = req.params;
      if (!userID) {
        return res.status(400).json({ error: 'userID is required' });
      }

      // Authorization: only the user themselves or an admin can delete
      // const caller = req.user as { userID: string; role: string } | undefined;
      // if (!caller || (caller.userID !== userID && caller.role !== 'admin')) {
      //   return res.status(403).json({ error: 'forbidden' });
      // }

      // Delete driver record first so a failure doesn't leave an orphan
      const existing = await UserModel.findOne({ userID: userID });
      if (!existing) {
        return res.status(404).json({ error: 'user not found' });
      }
      if (existing.role === 'driver') {
        const deletedDriver = await Driver.findOneAndDelete({
          driverId: userID,
        });
        if (!deletedDriver) {
          console.warn(
            `User ${userID} had role 'driver' but no Driver document existed`,
          );
        }
      }

      const deletedUser = await UserModel.findOneAndDelete({ userID });
      return res.status(200).json({ success: true, deletedUser });
    } catch (err) {
      console.error('Error in DELETE /user/:userID', err);
      return res.status(500).json({ error: 'Error in DELETE /user/:userID' });
    }
  },
);
// Global error handler for all API routes
router.use(routeErrorHandler);

export default router;
