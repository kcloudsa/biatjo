import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

export const startTestDB = async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.DB_URI = uri;
  // If mongoose already connected (from previous tests), disconnect first
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(uri);
  return { mongod };
};

export const stopTestDB = async (mongod: MongoMemoryServer) => {
  try {
    await mongoose.disconnect();
  } finally {
    await mongod.stop();
  }
};
export const getApp = async () => {
  // Import app after DB_URI is set and mongoose connected
  const mod = await import('../../src/app');
  return mod.default;
};

