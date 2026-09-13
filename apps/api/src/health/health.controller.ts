import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get('live')
  live() {
    return {
      status: 'ok',
      service: 'api',
    };
  }

  @Get('ready')
  ready() {
    return {
      status: 'ok',
      service: 'api',
      checks: {
        configuration: 'ok',
      },
    };
  }
}
