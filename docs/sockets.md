# Socket.IO event reference

Connect to the Socket.IO endpoint at the server origin using the `/socket.io/` path and the `websocket` transport. The server currently accepts unauthenticated socket connections; clients identify themselves with `user:identify`.

Every event that supports a callback returns an object with `success: boolean`. Errors use the `error` property, except `trip:accept`, which may also use `err` for compatibility.

## Client-to-server events

| Event | Payload | Callback/result | Behavior |
| --- | --- | --- | --- |
| `user:identify` | `{ userId, role: "driver" \| "rider" }` | `{ success, error? }` | Verifies the user, stores identity in `socket.data`, and joins drivers to `drivers_online`. |
| `listen:test` | Any JSON value | None | Broadcasts `listen:res` to other sockets. |
| `rider:ping` | Any JSON value | None | Responds to the same socket with `rider:pong`. |
| `driver:online` | `{ driverId, lat, lng }` | `{ success, driver?, error? }` | Marks a driver online and broadcasts `driver:online`. |
| `driver:offline` | `{ driverId, lat, lng }` | `{ success, driver?, error? }` | Marks a driver offline and broadcasts `driver:offline`. |
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
| `driver:location:update` | All sockets currently (or trip room where applicable) | Driver/location update |
| `trip:new` | `drivers:online` | New trip summary |
| `rider:request_trip` | All sockets | Created trip and nearby driver summary |
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

1. Connect.
2. Send `user:identify`.
3. Drivers send `driver:online`; riders send `rider:request_trip`.
4. Join with `trip:join` when needed.
5. Accept/start/update/complete or cancel the trip.
6. Disconnect; the server receives `disconnect`.

## Example

```ts
const socket = io(API_URL, {
  path: '/socket.io/',
  transports: ['websocket'],
});

socket.emit('user:identify', { userId, role: 'rider' }, console.log);
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
