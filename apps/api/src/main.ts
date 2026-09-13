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

  const port = Number(process.env.API_PORT ?? 3000);

  await app.listen(port);

  console.log(`API listening on http://localhost:${port}/api/v1`);
}

void bootstrap();
