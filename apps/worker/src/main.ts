import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const port = Number(process.env.WORKER_PORT ?? 3001);

  await app.listen(port);

  console.log(`Worker listening on http://localhost:${port}`);
}

void bootstrap();
