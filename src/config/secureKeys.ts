export const MASTER_DB_KEY_HASH = process.env.MASTER_DB_KEY_HASH || '';
export const ROUTE_KEYS_HASH = {
  '/api/v1/unit': process.env.UNIT_ROUTE_KEY_HASH || '',
  // Add more route-specific keys
};
