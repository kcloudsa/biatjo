import { Server, Socket } from 'socket.io';
import { Trip } from '../models/TripModel';
import { TripStatus } from '../interfaces/ITrip';
import { tripRoom, userRoom } from './Rooms';
import { logger } from '../../Utils/Logger';

/** Statuses in which a driver is busy with a trip. */
export const ACTIVE_TRIP_STATUSES: TripStatus[] = [
  'accepted',
  'driver_on_the_way',
  'driver_arrived',
  'running',
];

/** A scheduled trip becomes 'accepted' (driver busy) this long before tripTime. */
export const SCHEDULE_LEAD_MS = 10 * 60 * 1000;

/**
 * Two scheduled trips of the same driver must start at least this far apart.
 * There is no trip duration in the model, so this is the assumed trip length.
 */
export const SCHEDULE_CONFLICT_MS = 60 * 60 * 1000;

/** Epoch values below this are seconds, not milliseconds (1e12 ms ≈ 2001). */
const SECONDS_THRESHOLD = 1e12;

/**
 * Normalise a client tripTime to epoch milliseconds.
 * Accepts ms or seconds, as a number or numeric string.
 * Returns undefined for missing / invalid values.
 */
export const normalizeTripTime = (value: unknown): number | undefined => {
  const n =
    typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return undefined;
  return n < SECONDS_THRESHOLD ? Math.round(n * 1000) : Math.round(n);
};

/**
 * Mongo condition for "tripTime between fromMs and toMs", matching trips
 * stored in ms as well as legacy trips stored in seconds.
 */
const tripTimeBetween = (fromMs: number, toMs: number) => ({
  $or: [
    { tripTime: { $gte: fromMs, $lte: toMs } },
    {
      tripTime: {
        $gte: Math.floor(fromMs / 1000),
        $lte: Math.ceil(toMs / 1000),
        $lt: SECONDS_THRESHOLD,
      },
    },
  ],
});

/**
 * Status a trip gets when a driver accepts it: scheduled trips that start
 * more than SCHEDULE_LEAD_MS from now are parked as 'scheduled' so they do
 * not block the driver from taking other trips meanwhile.
 */
export const statusOnAccept = (trip: {
  isScheduled?: boolean;
  tripTime?: number;
}): TripStatus => {
  const t = normalizeTripTime(trip.tripTime);
  return trip.isScheduled && t !== undefined && t - Date.now() > SCHEDULE_LEAD_MS
    ? 'scheduled'
    : 'accepted';
};

/**
 * Another scheduled trip of this driver (not finished) starting within
 * SCHEDULE_CONFLICT_MS of the given trip's tripTime, or null.
 */
export const findScheduleConflict = async (
  driverId: string,
  trip: { _id: unknown; tripTime?: number },
) => {
  const t = normalizeTripTime(trip.tripTime);
  if (t === undefined) return null;
  return Trip.findOne({
    driverId,
    _id: { $ne: trip._id },
    isScheduled: true,
    status: { $in: ['scheduled', ...ACTIVE_TRIP_STATUSES] },
    ...tripTimeBetween(t - SCHEDULE_CONFLICT_MS, t + SCHEDULE_CONFLICT_MS),
  });
};

export const SCHEDULE_CONFLICT_ERROR =
  'لديك رحلة مجدولة أخرى في نفس الوقت تقريبا';

/**
 * Promote 'scheduled' trips to 'accepted' once they are within
 * SCHEDULE_LEAD_MS of their tripTime, and notify the trip room and the
 * driver's / rider's personal rooms.
 */
export const promoteDueScheduledTrips = async (io: Server) => {
  const due = await Trip.find(
    { status: 'scheduled', ...tripTimeBetween(0, Date.now() + SCHEDULE_LEAD_MS) },
    { _id: 1 },
  );
  for (const { _id } of due) {
    // Conditional update: safe against concurrent cancel / multiple instances
    const trip = await Trip.findOneAndUpdate(
      { _id, status: 'scheduled' },
      { $set: { status: 'accepted' } },
      { new: true },
    );
    if (!trip) continue;
    const tripId = String(trip._id);
    const payload = {
      tripId,
      driverId: trip.driverId,
      riderId: trip.riderId,
      status: trip.status,
      tripTime: trip.tripTime,
      agreedFare: trip.fare,
    };
    // Personal rooms reach the driver/rider even if they are not in the trip
    // room; Socket.IO sends once per socket across the listed rooms.
    const rooms = [tripRoom(tripId), userRoom(trip.riderId)];
    if (trip.driverId) rooms.push(userRoom(trip.driverId));
    io.to(rooms).emit('trip:update', { tripId, status: trip.status });
    io.to(rooms).emit('trip:scheduled_due', payload);
    logger.info(`Scheduled trip ${tripId} promoted to accepted`);
  }
};

let scheduledPromoterTimer: NodeJS.Timeout | null = null;
/** Start the once-a-minute scheduled-trip promoter (idempotent). */
export const startScheduledTripPromoter = (io: Server, intervalMs = 60_000) => {
  if (scheduledPromoterTimer) return;
  const run = () =>
    promoteDueScheduledTrips(io).catch((err) =>
      console.error('Error promoting scheduled trips', err),
    );
  run();
  scheduledPromoterTimer = setInterval(run, intervalMs);
  scheduledPromoterTimer.unref();
};

/**
 * Called when a user (re)connects / identifies: join their personal room
 * and the rooms of their scheduled / active trips, then send the current
 * state of those trips as 'trip:sync' so nothing missed while offline is lost.
 */
export const syncUserTrips = async (socket: Socket, userId: string) => {
  socket.join(userRoom(userId));
  const trips = await Trip.find({
    $or: [{ driverId: userId }, { riderId: userId }],
    status: { $in: ['scheduled', ...ACTIVE_TRIP_STATUSES] },
  }).sort({ tripTime: 1 });
  for (const t of trips) socket.join(tripRoom(String(t._id)));
  socket.emit('trip:sync', { userId, trips });
};
