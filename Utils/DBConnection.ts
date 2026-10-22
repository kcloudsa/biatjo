// eslint-disable-next-line import/no-extraneous-dependencies
import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';

const DBConnection = async () => {
  const dbUri = process.env.DB_URI;

  if (!dbUri) {
    throw new Error('DB_URI environment variable is not defined');
  }
  await mongoose
    .connect(dbUri)
    .then((conn) => {
      console.log(`Database connected : ${conn.connection.host}`);
    })
    .catch((err) => {
      console.log(`Database error : ${err.message}`);
      process.exit(1);
    });
};

// MongoClient for Auth.js adapter
let cachedClient: MongoClient | null = null;
let cachedClientPromise: Promise<MongoClient> | null = null;

export const mongoClientPromise = (): Promise<MongoClient> => {
  if (cachedClientPromise) {
    return cachedClientPromise;
  }

  const dbUri = process.env.DB_URI;
  if (!dbUri) {
    throw new Error('DB_URI environment variable is not defined');
  }

  if (!cachedClient) {
    cachedClient = new MongoClient(dbUri);
  }

  cachedClientPromise = cachedClient.connect();
  return cachedClientPromise;
};

export default DBConnection;
