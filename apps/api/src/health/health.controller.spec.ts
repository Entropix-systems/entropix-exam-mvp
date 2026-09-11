import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  const controller = new HealthController();

  it('reports API liveness', () => {
    expect(controller.live()).toEqual({
      status: 'ok',
      service: 'api',
    });
  });

  it('reports API readiness', () => {
    expect(controller.ready()).toEqual({
      status: 'ok',
      service: 'api',
      checks: {
        configuration: 'ok',
      },
    });
  });
});
