import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  const controller = new HealthController();

  it('reports worker liveness', () => {
    expect(controller.live()).toEqual({
      status: 'ok',
      service: 'worker',
    });
  });

  it('reports worker readiness', () => {
    expect(controller.ready()).toEqual({
      status: 'ok',
      service: 'worker',
      checks: {
        configuration: 'ok',
      },
    });
  });
});
