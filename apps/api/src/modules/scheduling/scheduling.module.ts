import { Module } from '@nestjs/common';
import { SchedulingController } from './scheduling.controller.js';
import { SchedulingRepository } from './scheduling.repository.js';
import { SchedulingService } from './scheduling.service.js';

@Module({ controllers: [SchedulingController], providers: [SchedulingRepository, SchedulingService] })
export class SchedulingModule {}
