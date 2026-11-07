/**
 * Scheduled trips: status 'scheduled', automatic promotion to 'accepted'
 * 10 minutes before tripTime, overlap protection and reconnect sync.
 *
 * Integration test: runs the real Socket.IO handlers against MongoDB.
 * Uses TEST_DB_URI (default: local byatjo_jest_scheduled database, which is
 * dropped). Skipped automatically when MongoDB is not reachable.
 */
import { createServer, Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import express from 'express';
import mongoose from 'mongoose';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { Server } from 'socket.io';
import { setupSocket } from '../../Utils/SocketIO';
import { Trip } from '../../src/models/TripModel';
import { Driver } from '../../src/models/DriverModel';
import UserModel from '../../src/models/userModel';
import {
  normalizeTripTime,
  promoteDueScheduledTrips,
  SCHEDULE_LEAD_MS,
  statusOnAccept,
} from '../../src/SocketEvent/scheduledTrips';

const MIN = 60 * 1000;
const DB_URI =
  process.env.TEST_DB_URI || 'mongodb://127.0.0.1:27017/byatjo_jest_scheduled';

describe('scheduled trip helpers', () => {
  it('normalizeTripTime converts seconds to ms and rejects invalid values', () => {
    expect(normalizeTripTime(1_794_055_131)).toBe(1_794_055_131_000);
    expect(normalizeTripTime(1_794_055_131_000)).toBe(1_794_055_131_000);
    expect(normalizeTripTime('1794055131')).toBe(1_794_055_131_000);
    expect(normalizeTripTime(undefined)).toBeUndefined();
    expect(normalizeTripTime(0)).toBeUndefined();
    expect(normalizeTripTime('abc')).toBeUndefined();
  });

  it('statusOnAccept parks only far-away scheduled trips', () => {
    const now = Date.now();
    expect(statusOnAccept({ isScheduled: true, tripTime: now + 2 * SCHEDULE_LEAD_MS })).toBe('scheduled');
    expect(statusOnAccept({ isScheduled: true, tripTime: now + SCHEDULE_LEAD_MS / 2 })).toBe('accepted');
    expect(statusOnAccept({ isScheduled: false, tripTime: now + 120 * MIN })).toBe('accepted');
    // seconds value is understood too
    expect(statusOnAccept({ isScheduled: true, tripTime: Math.floor((now + 120 * MIN) / 1000) })).toBe('scheduled');
  });
});

let dbAvailable = false;
beforeAll(async () => {
  try {
    await mongoose.connect(DB_URI, { serverSelectionTimeoutMS: 2000 });
    dbAvailable = true;
  } catch {
    // eslint-disable-next-line no-console
    console.warn(`MongoDB not reachable at ${DB_URI}; skipping scheduled trip integration tests`);
  }
});
afterAll(async () => {
  if (dbAvailable) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

const itDb = (name: string, fn: () => Promise<void>) =>
  it(name, async () => {
    if (!dbAvailable) return;
    await fn();
  });

describe('scheduled trips over sockets', () => {
  let httpServer: HttpServer;
  let io: Server;
  let url: string;
  const sockets: ClientSocket[] = [];

  type TestSocket = ClientSocket & { events: { ev: string; p: any }[] };

  const connect = (userId: string, role: 'rider' | 'driver') =>
    new Promise<TestSocket>((resolve, reject) => {
      const s = ioClient(url, { transports: ['websocket'], forceNew: true }) as TestSocket;
      sockets.push(s);
      s.events = [];
      s.onAny((ev, p) => s.events.push({ ev, p }));
      s.on('connect_error', reject);
      s.on('connect', () =>
        s.emit('user:identify', { userId, role }, (res: any) =>
          res?.success ? resolve(s) : reject(new Error(JSON.stringify(res))),
        ),
      );
    });

  const call = (s: ClientSocket, ev: string, data: any) =>
    new Promise<any>((resolve) => s.emit(ev, data, resolve));

  const waitFor = async (pred: () => boolean, ms = 3000) => {
    const end = Date.now() + ms;
    while (!pred() && Date.now() < end) await new Promise((r) => setTimeout(r, 25));
    return pred();
  };

  const pickup = { lat: 32.88, lng: 13.19 };
  const dropoff = { lat: 32.9, lng: 13.2 };
  let rider: TestSocket;
  let driver: TestSocket;

  const request = async (extra: Record<string, unknown>) =>
    call(rider, 'rider:request_trip', { riderId: 'rider1', pickup, dropoff, ...extra });
  const accept = (s: ClientSocket, tripId: string) =>
    call(s, 'trip:accept', { tripId, driverId: 'driver1', riderId: 'rider1', amount: 50 });

  beforeAll(async () => {
    if (!dbAvailable) return;
    await mongoose.connection.dropDatabase();
    await Promise.all([Trip.init(), Driver.init(), UserModel.init()]);

    const verifiedUser = (userID: string, role: string) => ({
      userID,
      role,
      active: true,
      isVerified: true,
      contactInfo: { email: { value: `${userID}@test.local`, verified: true } },
    });
    await UserModel.collection.insertMany([
      verifiedUser('rider1', 'user'),
      verifiedUser('driver1', 'driver'),
    ]);
    await Driver.create({ driverId: 'driver1', online: true });

    const app = express();
    httpServer = createServer(app);
    io = setupSocket(httpServer, app);
    await new Promise<void>((r) => httpServer.listen(0, '127.0.0.1', r));
    url = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;

    rider = await connect('rider1', 'rider');
    driver = await connect('driver1', 'driver');
  });

  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    if (io) await new Promise((r) => io.close(r));
  });

  const ids: Record<string, string> = {};

  itDb('stores a tripTime sent in seconds as milliseconds', async () => {
    const sec = Math.floor((Date.now() + 120 * MIN) / 1000);
    const res = await request({ isScheduled: true, tripTime: sec });
    expect(res.success).toBe(true);
    ids.t1 = res.tripId;
    expect((await Trip.findById(ids.t1))!.tripTime).toBe(sec * 1000);
  });

  itDb('rejects a scheduled trip without tripTime', async () => {
    const res = await request({ isScheduled: true });
    expect(res.success).toBe(false);
  });

  itDb("accepting a far scheduled trip gives status 'scheduled'", async () => {
    const res = await accept(driver, ids.t1);
    expect(res.success).toBe(true);
    expect(res.trip.status).toBe('scheduled');
  });

  itDb('driver holding a scheduled trip can still accept another trip', async () => {
    const r = await request({});
    const res = await accept(driver, r.tripId);
    expect(res.success).toBe(true);
    expect(res.trip.status).toBe('accepted');
  });

  itDb('rejects an overlapping scheduled trip for the same driver', async () => {
    const r = await request({ isScheduled: true, tripTime: Date.now() + 150 * MIN });
    const res = await accept(driver, r.tripId);
    expect(res.success).toBe(false);
    expect((await Trip.findById(r.tripId))!.status).not.toBe('scheduled');
  });

  itDb('accepts a non-overlapping scheduled trip', async () => {
    const r = await request({ isScheduled: true, tripTime: Date.now() + 240 * MIN });
    ids.t4 = r.tripId;
    const res = await accept(driver, ids.t4);
    expect(res.success).toBe(true);
    expect(res.trip.status).toBe('scheduled');
  });

  itDb('cannot complete a trip that is still scheduled', async () => {
    const res = await call(driver, 'trip:completed', { tripId: ids.t4 });
    expect(res.success).toBe(false);
  });

  itDb('promotes due trips (ms and legacy seconds) while the driver is offline', async () => {
    driver.disconnect();
    await Trip.updateOne({ _id: ids.t1 }, { $set: { tripTime: Date.now() + 5 * MIN } });
    // legacy document stored in seconds
    await Trip.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(ids.t4) },
      { $set: { tripTime: Math.floor((Date.now() + 5 * MIN) / 1000) } },
    );

    await promoteDueScheduledTrips(io);

    expect((await Trip.findById(ids.t1))!.status).toBe('accepted');
    expect((await Trip.findById(ids.t4))!.status).toBe('accepted');

    const dueIds = () =>
      rider.events.filter((e) => e.ev === 'trip:scheduled_due').map((e) => e.p.tripId);
    expect(await waitFor(() => dueIds().includes(ids.t1) && dueIds().includes(ids.t4))).toBe(true);
  });

  itDb('does not promote trips that are still more than 10 minutes away', async () => {
    const r = await request({ isScheduled: true, tripTime: Date.now() + 400 * MIN });
    driver = await connect('driver1', 'driver');
    await accept(driver, r.tripId);
    await promoteDueScheduledTrips(io);
    expect((await Trip.findById(r.tripId))!.status).toBe('scheduled');
  });

  itDb('sends trip:sync on reconnect and rejoins the trip rooms', async () => {
    driver.disconnect();
    driver = await connect('driver1', 'driver');

    const sync = () => driver.events.filter((e) => e.ev === 'trip:sync').pop()?.p;
    expect(await waitFor(() => !!sync())).toBe(true);
    const t1 = sync().trips.find((t: any) => t._id === ids.t1);
    expect(t1?.status).toBe('accepted');

    // driver is back in the trip room: room broadcasts reach them
    const before = driver.events.length;
    await call(rider, 'trip:update', { tripId: ids.t1, status: 'requested' });
    expect(
      await waitFor(() =>
        driver.events.slice(before).some((e) => e.ev === 'trip:update' && e.p.tripId === ids.t1),
      ),
    ).toBe(true);
  });
});
