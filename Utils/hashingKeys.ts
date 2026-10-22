// import crypto from 'crypto';

export const generateHashedAccessKey = (
  dbKey: string,
  userId: string,
  routeKey: string,
  timestamp: string,
): string => {
  const raw = `${dbKey}.${userId}.${routeKey}.${timestamp}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
};

// export const compareKey = (
//   dbKey: string,
//   userId: string,
//   routeKey: string,
//   timestamp: string,
//   hashed: string,
// ): boolean => hashKey(dbKey, userId, routeKey, timestamp) === hashed;
import crypto from 'crypto';

export const hashKey = (key: string): string =>
  crypto.createHash('sha256').update(key).digest('hex');

export const compareKey = (input: string, hashed: string): boolean =>
  hashKey(input) === hashed;
