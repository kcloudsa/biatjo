import type { OpenAPIV3 } from 'openapi-types';

const json = (description: string): OpenAPIV3.ResponseObject => ({
  description,
  content: {
    'application/json': {
      schema: { type: 'object', additionalProperties: true },
      examples: { default: { summary: description, value: { success: true } } },
    },
  },
});

const operation = (
  summary: string,
  tags: string[],
  secured = false,
): OpenAPIV3.OperationObject => ({
  summary,
  tags,
  ...(secured ? { security: [{ bearerAuth: [] }] } : {}),
  responses: {
    '200': json(summary),
    '400': { description: 'Invalid request' },
    '404': { description: 'Resource not found' },
    '500': { description: 'Internal server error' },
  },
});

const swaggerDocument: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'Byatjo API',
    version: '0.1.0',
    description:
      'HTTP and real-time API for authentication, users, drivers, trips, search, and analytics. Socket.IO events are documented in docs/sockets.md.',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'System', description: 'Health and service metadata' },
    { name: 'Auth', description: 'Registration, login, sessions, and OAuth' },
    { name: 'Trips', description: 'Trip lifecycle and trip queries' },
    { name: 'Drivers', description: 'Driver presence and location' },
    { name: 'Users', description: 'User management' },
    { name: 'Analytics', description: 'Protected analytics endpoints' },
    { name: 'Search', description: 'Universal search' },
    { name: 'API keys', description: 'API key management' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Coordinates: {
        type: 'object',
        required: ['lat', 'lng'],
        properties: {
          lat: { type: 'number', minimum: -90, maximum: 90 },
          lng: { type: 'number', minimum: -180, maximum: 180 },
        },
      },
      TripRequest: {
        type: 'object',
        required: ['riderId', 'pickup', 'dropoff'],
        properties: {
          riderId: { type: 'string' },
          pickup: { $ref: '#/components/schemas/Coordinates' },
          dropoff: { $ref: '#/components/schemas/Coordinates' },
          initialFare: { type: 'number' },
          loadDescription: { type: 'string' },
          loadWeight: { type: 'number' },
          carKind: { type: 'string' },
          transportType: { type: 'string' },
          isScheduled: { type: 'boolean' },
          tripTime: { type: 'number' },
        },
      },
    },
  },
  paths: {
    '/': { get: operation('Service health message', ['System']) },
    '/health': { get: operation('Health check', ['System']) },
    '/api/': { get: operation('API index', ['System']) },
    '/auth/register': { post: operation('Register a user', ['Auth']) },
    '/auth/registerDriver': { post: operation('Register a driver', ['Auth']) },
    '/auth/otp/register': { post: operation('Start OTP registration', ['Auth']) },
    '/auth/otp/verify': { post: operation('Verify registration OTP', ['Auth']) },
    '/auth/forgot-password': { post: operation('Request password recovery', ['Auth']) },
    '/auth/reset-password': { post: operation('Reset password', ['Auth']) },
    '/auth/password-reset/request': { post: operation('Request password reset link', ['Auth']) },
    '/auth/password-reset/validate': { post: operation('Validate password reset token', ['Auth']) },
    '/auth/password-reset/complete': { post: operation('Complete password reset', ['Auth']) },
    '/auth/login': { post: operation('Log in', ['Auth']) },
    '/auth/login/dash': { post: operation('Log in to dashboard', ['Auth']) },
    '/auth/refresh': { post: operation('Refresh access token', ['Auth']) },
    '/auth/logout': { post: operation('Log out', ['Auth']) },
    '/auth/me': { get: operation('Get current user', ['Auth'], true) },
    '/auth/google': { get: operation('Start Google OAuth', ['Auth']) },
    '/auth/google/callback': { get: operation('Handle Google OAuth callback', ['Auth']) },
    '/api/me': { get: operation('Get current API user', ['Users'], true) },
    '/api/apikeys/create': { post: operation('Create an API key', ['API keys'], true) },
    '/api/apikeys/': { get: operation('List API keys', ['API keys'], true) },
    '/api/apikeys/deactivate/{key}': {
      patch: operation('Deactivate an API key', ['API keys'], true),
    },
    '/api/apikeys/activate/{key}': {
      patch: operation('Activate an API key', ['API keys'], true),
    },
    '/api/users/': { get: operation('List users', ['Users'], true) },
    '/api/users/{id}': {
      get: operation('Get a user', ['Users'], true),
      patch: operation('Update a user', ['Users'], true),
      delete: operation('Delete a user', ['Users'], true),
    },
    '/api/users/{id}/change-password': {
      post: operation('Change a user password', ['Users'], true),
    },
    '/api/users/{id}/avatar/upload': {
      post: operation('Upload a user avatar', ['Users'], true),
    },
    '/api/online': { get: operation('List online drivers', ['Drivers']) },
    '/api/onlineoffline': { get: operation('List drivers with presence', ['Drivers']) },
    '/api/drivers': { get: operation('List drivers', ['Drivers']) },
    '/api/allusers': { get: operation('List users for driver operations', ['Drivers']) },
    '/api/drivers/nearby': { post: operation('Find nearby drivers', ['Drivers'], true) },
    '/api/userstatus/{id}': { post: operation('Update user active status', ['Drivers']) },
    '/api/search/': { get: operation('Search users and catalog data', ['Search']) },
    '/api/analytics/overview': { get: operation('Get overview analytics', ['Analytics'], true) },
    '/api/analytics/sales': { get: operation('Get sales analytics', ['Analytics'], true) },
    '/api/analytics/users': { get: operation('Get user analytics', ['Analytics'], true) },
    '/api/analytics/products': { get: operation('Get product analytics', ['Analytics'], true) },
    '/api/analytics/brands': { get: operation('Get brand analytics', ['Analytics'], true) },
    '/api/drivers/online': {
      post: {
        ...operation('Set a driver online', ['Drivers']),
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Coordinates' } } } },
      },
    },
    '/api/drivers/location': { post: operation('Update driver location', ['Drivers']) },
    '/api/riders/request-trip': {
      post: {
        ...operation('Request a trip', ['Trips']),
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TripRequest' } } } },
      },
    },
    '/api/trips/accept': { post: operation('Accept a trip', ['Trips']) },
    '/api/trips/update': { post: operation('Update trip status', ['Trips']) },
    '/api/trips/complete': { post: operation('Complete a trip', ['Trips']) },
    '/api/trips/negotiate': { post: operation('Submit a fare negotiation', ['Trips']) },
    '/api/trips/all': { get: operation('List requested and negotiating trips', ['Trips']) },
    '/api/alltrips': { get: operation('List trips with filters and pagination', ['Trips']) },
    '/api/alltripstoday': { get: operation("List today's trips", ['Trips']) },
    '/api/trips/scheduled': { get: operation('List scheduled trips', ['Trips']) },
    '/api/trips/rider/{riderId}': { get: operation('List trips for a rider', ['Trips']) },
    '/api/trips/rider/nopage/{riderId}': { get: operation('List all trips for a rider', ['Trips']) },
    '/api/trips/driver/{driverId}': { get: operation('List trips for a driver', ['Trips']) },
    '/api/trips/driver/nopage/{driverId}': { get: operation('List all trips for a driver', ['Trips']) },
    '/api/trips/delete/{id}': { delete: operation('Delete a trip', ['Trips']) },
  },
};

export default swaggerDocument;
