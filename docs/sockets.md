# Socket.IO event reference

Connect to the Socket.IO endpoint at the server origin using the `/socket.io/` path and the `websocket` transport.

Every event that supports a callback returns an object with `success: boolean`. Errors use the `error` property, except `trip:accept` and `trip:start`, which also use `err` for compatibility.

## Identity and verification

Every action runs as one user, the socket's identity. A socket gets its identity in one of two ways:

1. **Access token at connect (recommended).** Pass the token from login or `/auth/otp/verify`:

   ```ts
   const socket = io(API_URL, {
     path: '/socket.io/',
     transports: ['websocket'],
     auth: { token: accessToken },
   });
   ```

   An invalid or expired token, an unverified email, or a disabled account refuses the connection. The client receives a `connect_error` whose `data.code` is `UNAUTHORIZED`, `EMAIL_NOT_VERIFIED` or `NOT_ALLOWED`.
2. **`user:identify` (legacy).** Allowed only while `SOCKET_REQUIRE_AUTH` is not `true`. The user must exist, be active, and have a verified email. `role: "driver"` requires a driver account.

Rules applied to every action:

- An action sent before the socket has an identity fails with `code: "NOT_IDENTIFIED"`.
- Ids in the payload (`userId`, `riderId`, `driverId`) must equal the socket's user, otherwise `code: "NOT_ALLOWED"`.
- A socket keeps one identity. To switch user, disconnect and connect again.

Set `SOCKET_REQUIRE_AUTH=true` on the server once all apps send the token. Without it, anyone who knows a user id can still identify as that user with `user:identify`.

## Who may do what

| Event | Allowed caller |
| --- | --- |
| `driver:online`, `driver:offline`, `driver:location` | The driver themself (`driverId`) |
| `rider:request_trip` | The rider themself (`riderId`) |
| `trip:join`, `trip:leave` | The user themself (`userId`). Riders join only their own trips; drivers join open trips or trips assigned to them. |
| `trip:accept` | The driver themself; `riderId` must be the trip's rider |
| `trip:start` | The trip's assigned driver; `riderId` must be the trip's rider. Allowed from `accepted`, `driver_on_the_way` or `driver_arrived`. |
| `trip:accept` / `offer:accept` (scheduled) | If the trip has `isScheduled: true` and `tripTime` is more than 10 minutes away, it is accepted with status `scheduled`, which does not make the driver busy. `tripTime` may be sent in epoch ms or seconds; it is stored in ms. A driver cannot accept a scheduled trip that starts within 60 minutes of another of their scheduled trips. The server moves it to `accepted` automatically 10 minutes before `tripTime` and emits `trip:update` and `trip:scheduled_due` to the trip room and to the rider's and driver's personal rooms (`user:<userId>`). |
| `trip:sync` (server → client) | Sent on connect (token auth) or after `user:identify`: `{ userId, trips }` with all of the user's `scheduled` and active trips. The socket also rejoins those trip rooms. Use it to refresh state after reconnecting. |
| `trip:update` | The trip's rider or assigned driver. Only the driver may set `driver_on_the_way`, `driver_arrived`, `running` or `completed`. |
| `trip:completed` | The trip's assigned driver |
| `trip:cancel` | The trip's rider. Completed trips cannot be cancelled. |
| `trip:negotiate` | The user themself (`userId`) |
| `trip:location` | The trip's assigned driver while the trip is active |
| `offer:send` | The side named by `role` (`driverId` or `riderId`); `riderId` must be the trip's rider |
| `offer:cancel` | The offer's creator |
| `offer:accept` | The other party: a driver's offer is accepted by the rider, a rider's offer by the driver |
| `listen:test` | Development only; disabled when `NODE_ENV=production` |

## Client-to-server events

| Event | Payload | Callback/result | Behavior |
| --- | --- | --- | --- |
| `user:identify` | `{ userId, role: "driver" \| "rider" }` | `{ success, error?, code? }` | Checks the user is active and email-verified, stores identity in `socket.data`, and joins drivers to `drivers:online`. |
| `listen:test` | Any JSON value | None | Development only. Broadcasts `listen:res` to other sockets. |
| `rider:ping` | Any JSON value | None | Responds to the same socket with `rider:pong`. |
| `driver:online` | `{ driverId, lat, lng }` | `{ success, driver?, error? }` | Marks a driver online and broadcasts `driver:online`. |
| `driver:offline` | `{ driverId, lat, lng }` | `{ success, driver?, error? }` | Marks a driver offline, leaves `drivers:online`, and broadcasts `driver:offline`. |
| `driver:location` | `{ driverId, lat, lng }` | `{ success, driver?, error? }` | Updates the driver's location and emits `driver:location:update`. |
| `trip:join` | `{ tripId, userId, role }` | `{ success, room?, error? }` | Authorizes the rider/driver and joins `trip:<tripId>`. Also emits `trip:join:status`. |
| `trip:leave` | `{ tripId?, userId }` | `{ success, room?, error? }` | Leaves one trip room or all tracked rooms. Also emits `trip:leave:status`. |
| `rider:request_trip` | `{ riderId, pickup, dropoff, initialFare?, loadDescription?, loadWeight?, carKind?, transportType?, isScheduled?, tripTime? }` | `{ success, trip?, error? }` | Creates a trip, joins the rider to its room, and notifies drivers. |
| `trip:accept` | `{ tripId, driverId, riderId, amount }` | `{ success, trip?, error? }` | Assigns a driver and emits `trip:accepted`. |
| `trip:start` | `{ tripId, driverId? }` | `{ success, trip?, error? }` | Starts an accepted trip and emits `trip:started`. |
| `trip:cancel` | `{ tripId, userId?, reason? }` | `{ success, trip?, error? }` | Cancels a trip and emits `trip:cancelled`. |
| `trip:update` | `{ tripId, status }` | `{ success, trip?, error? }` | Updates trip status and emits `trip:update`. |
| `trip:completed` | `{ tripId }` | `{ success, trip?, error? }` | Completes a trip and emits `trip:completed`. |
| `trip:negotiate` | `{ tripId, from, amount, userId, status? }` | `{ success, trip?, error? }` | Applies a rider/driver fare offer and emits `trip:negotiation:update`. |
| `trip:location` | `{ driverId, tripId, lat, lng }` | `{ success, driver?, error? }` | Updates trip location and emits `trip:location:update`. |
| `offer:send` | Offer payload containing `tripId`, sender, receiver, and amount | `{ success, offer?, error? }` | Creates/sends a trip offer and emits `offer:send` or `offer:update`. |
| `offer:cancel` | Offer identifier and `tripId` | `{ success, error? }` | Cancels an offer and emits `offer:update`. |
| `offer:accept` | Offer identifier and `tripId` | `{ success, offer?, error? }` | Accepts an offer and emits `offer:update`. |

Coordinates use `{ lat: number, lng: number }`, with latitude `-90..90` and longitude `-180..180`. Trip IDs must be valid MongoDB ObjectIds for room operations.

## Server-to-client events

| Event | Audience | Payload |
| --- | --- | --- |
| `listen:res` | Other sockets | `{ ok, from, data, at }` |
| `rider:pong` | Requesting socket | `{ ok, at }` |
| `driver:online` / `driver:offline` | All sockets | Driver ID, coordinates, and timestamp |
| `driver:location:update` | All sockets, successful updates only. Errors go to the caller's callback. | Driver/location update |
| `trip:new` | `drivers:online` | New trip summary |
| `rider:request_trip` | The requesting rider and `drivers:online` | Created trip and nearby driver summary |
| `trip:accepted` / `trip:started` / `trip:cancelled` | `trip:<tripId>` | Trip lifecycle update |
| `trip:update` | `trip:<tripId>` | `{ tripId, status }` |
| `trip:completed` | `trip:<tripId>` | Completion details |
| `trip:negotiation:update` | `trip:<tripId>` | Negotiation/offer update |
| `trip:location:update` | `trip:<tripId>` | Driver coordinates |
| `trip:join:status` / `trip:leave:status` | Requesting socket | Operation result |
| `trip:user-joined` / `trip:user-left` | Other room members | User and socket information |
| `offer:send` / `offer:update` | `trip:<tripId>` | Offer state |

## Rooms and flow

The implementation uses `drivers:online` for driver notifications and `trip:<tripId>` for trip communication. A normal client flow is:

1. Connect with `auth: { token }`, or connect and send `user:identify`.
2. Drivers send `user:identify` with `role: "driver"` (or `driver:online`) to join `drivers:online`.
3. Drivers send `driver:online`; riders send `rider:request_trip`.
4. Join with `trip:join` when needed.
5. Accept/start/update/complete or cancel the trip.
6. Disconnect; the server receives `disconnect`.

## Example

```ts
const socket = io(API_URL, {
  path: '/socket.io/',
  transports: ['websocket'],
  auth: { token: accessToken },
});

socket.on('connect_error', (err) => console.log(err.data?.code, err.message));
socket.emit(
  'rider:request_trip',
  {
    riderId: userId,
    pickup: { lat: 31.95, lng: 35.91 },
    dropoff: { lat: 31.98, lng: 35.90 },
  },
  console.log,
);
```
