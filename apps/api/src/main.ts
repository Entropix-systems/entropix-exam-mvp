import { NestFactory } from '@nestjs/core';
import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { AppModule } from './app.module.js';

dotenv.config({
  path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')],
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3000);

  await app.listen(port, '0.0.0.0');

  console.log(`API listening on port ${port} at /api/v1`);
}

void bootstrap();
