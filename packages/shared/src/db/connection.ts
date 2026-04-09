import mongoose from 'mongoose';

export async function connectToDatabase(uri?: string): Promise<typeof mongoose> {
  const mongoUri = uri || process.env.MONGO_URI || 'mongodb://localhost:27017/job-tracker';

  if (mongoose.connection.readyState === 1) return mongoose;

  return mongoose.connect(mongoUri);
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
