import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';

describe('API health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.DATABASE_URL ??=
      'postgresql://unused:unused@127.0.0.1:1/unused';
    process.env.ACCESS_TOKEN_SECRET ??=
      'test-only-access-secret-at-least-32-bytes';
    process.env.WEB_ORIGIN ??= 'https://app.example.test';
    process.env.EMAIL_PROVIDER ??= 'test';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health/live', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200)
      .expect({
        status: 'ok',
        service: 'api',
      });
  });

  it('registers the fixed authenticated identity administration routes', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/identity/memberships')
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/identity/invitations')
      .send({})
      .expect(401);
    await request(app.getHttpServer())
      .put(
        '/api/v1/identity/memberships/11111111-1111-4111-8111-111111111111/role-grants',
      )
      .send({})
      .expect(401);
    await request(app.getHttpServer())
      .post(
        '/api/v1/identity/memberships/11111111-1111-4111-8111-111111111111/deactivate',
      )
      .expect(401);
    await request(app.getHttpServer())
      .post(
        '/api/v1/identity/memberships/11111111-1111-4111-8111-111111111111/activate',
      )
      .expect(401);
  });

  it('registers scheduling with its database and authentication providers', async () => {
    await request(app.getHttpServer()).get('/api/v1/scheduling').expect(401);
  });
});
