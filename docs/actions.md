# HTTP actions

All endpoints below are mounted by the application. The interactive OpenAPI documentation is available at `/docs` when the server is running, and the raw specification is available at `/docs.json`.

Authentication uses `Authorization: Bearer <JWT>` where marked as required. Trip and driver action routes currently use optional JWT middleware, so callers should still authenticate in production integrations.

## System

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | Service greeting |
| GET/HEAD | `/health` | Health status |
| GET | `/sitemap.xml` | Service sitemap |
| GET | `/api/` | API greeting |

## Authentication

Available under both `/auth` and `/api/auth`: register, driver registration, OTP registration/verification, login, dashboard login, refresh, logout, forgot/reset password, password-reset request/validate/complete, current user, and Google OAuth start/callback.

## User, key, search, and analytics actions

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/apikeys/create` | Create an API key |
| GET | `/api/apikeys/` | List API keys |
| PATCH | `/api/apikeys/activate/:key` | Activate a key |
| PATCH | `/api/apikeys/deactivate/:key` | Deactivate a key |
| GET | `/api/users/` | List users |
| GET/PATCH/DELETE | `/api/users/:id` | Read, update, or delete a user |
| POST | `/api/users/:id/change-password` | Change password |
| POST | `/api/users/:id/avatar/upload` | Upload avatar |
| POST | `/api/users/` | Create a user |
| DELETE | `/api/users/:id` | Delete a user |
| GET | `/api/search/` | Universal search |
| GET | `/api/analytics/{overview,sales,users,products,brands}` | Protected analytics |
| GET | `/api/online` | List online drivers |
| GET | `/api/onlineoffline` | List drivers with online/offline state |
| POST | `/api/drivers/nearby` | Find nearby drivers from coordinates |
| GET | `/api/drivers` | List drivers |
| GET | `/api/allusers` | List users for driver operations |
| GET | `/api/users/:id` | Get a user through the driver service |
| POST | `/api/userstatus/:id` | Update user active status |

## Trip action routes

| Method | Path | Body/query |
| --- | --- | --- |
| POST | `/api/drivers/online` | `driverId`, `lat`, `lng` |
| POST | `/api/drivers/location` | `driverId`, `tripId`, `lat`, `lng` |
| POST | `/api/riders/request-trip` | `riderId`, `pickup`, `dropoff`, optional fare/load/schedule fields |
| POST | `/api/trips/accept` | `tripId`, `driverId`, `riderId`, `amount` |
| POST | `/api/trips/update` | `tripId`, `status` |
| POST | `/api/trips/complete` | `tripId`, `fare` |
| POST | `/api/trips/negotiate` | Trip negotiation fields including `tripId`, `from`, `amount`, and `userId` |
| GET | `/api/trips/all` | Requested/negotiating trips |
| GET | `/api/alltrips` | `page`, `limit`, `status`, `search`, `fromDate`, `toDate` |
| GET | `/api/alltripstoday` | Today's scheduled and immediate trips |
| GET | `/api/trips/scheduled` | `page`, `limit` |
| GET | `/api/trips/rider/:riderId` | Rider trips; supports pagination/date filters |
| GET | `/api/trips/rider/nopage/:riderId` | All rider trips |
| GET | `/api/trips/driver/:driverId` | Driver trips; supports pagination/date filters |
| GET | `/api/trips/driver/nopage/:driverId` | All driver trips |
| DELETE | `/api/trips/delete/:id` | Delete a trip |

Trip statuses are `requested`, `accepted`, `driver_on_the_way`, `driver_arrived`, `running`, `completed`, and `cancelled`.

## Currently inactive route groups

The `/api/brands`, `/api/products`, `/api/cart`, `/api/addresses`, `/api/orders`, `/api/category`, `/api/collection`, `/api/history`, `/api/follow`, `/api/reviews`, `/api/saved`, and `/api/purchased-items` modules exist, but their handlers are commented out or not mounted as active endpoints. They are intentionally not presented as callable Swagger operations.
