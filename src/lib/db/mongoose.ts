import mongoose from "mongoose";

/**
 * Cached Mongoose connection helper for Next.js.
 *
 * The connection is memoised on `globalThis` so Next.js dev hot-reloads reuse a
 * single connection instead of opening a new one on every request.
 *
 * Nothing connects at import time: `MONGODB_URI` is read *inside* the function,
 * so the app boots fine without a database as long as no DB-backed route or the
 * seed script actually calls `connectToDatabase()`. When it is called without a
 * URI configured, it throws a clear, actionable error.
 */

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache =
  global._mongooseCache ?? (global._mongooseCache = { conn: null, promise: null });

export async function connectToDatabase(): Promise<typeof mongoose> {
  // Read at call time (not import time) so env loaded later — e.g. by the seed
  // script via @next/env — is respected regardless of import order.
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "Missing MONGODB_URI environment variable. Add it to .env.local before using the database.",
    );
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      // Fail commands fast instead of buffering them forever when disconnected.
      bufferCommands: false,
      // Fail fast when the DB is unreachable so requests return a clear error
      // instead of hanging on the driver's 30s default.
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    // Never leave a rejected promise cached — otherwise a single transient
    // failure (network blip, DB briefly down) would poison every later call
    // until a full restart. Clearing it lets the next call retry a fresh connect.
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}
