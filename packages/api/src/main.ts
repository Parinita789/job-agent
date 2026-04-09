import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';
import * as path from 'path';
import mongoose from 'mongoose';
import { AppModule } from './app.module';

// Load .env before anything else
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function bootstrap() {
  // Connect the default mongoose instance so shared models (JobModel etc.) work
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/job-tracker';
  await mongoose.connect(uri);
  console.log(`[MongoDB] Connected to: ${uri}`);

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: 'http://localhost:5173',
  });

  app.setGlobalPrefix('api');

  const port = process.env.API_PORT ?? 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}

bootstrap();
