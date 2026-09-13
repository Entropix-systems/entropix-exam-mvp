import { Module } from '@nestjs/common';

import { HealthModule } from './health/health.module.js';

import { IdentityHttpModule } from './modules/identity/identity-http.module.js';
import { AcademicsModule } from './modules/academics/academics.module.js';
import { ExamsModule } from './modules/exams/exams.module.js';
import { SchedulingModule } from './modules/scheduling/scheduling.module.js';
import { ConductModule } from './modules/conduct/conduct.module.js';
import { EvaluationModule } from './modules/evaluation/evaluation.module.js';
import { ResultsModule } from './modules/results/results.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { PeopleModule } from './modules/people/people.module.js';

@Module({
  imports: [
    HealthModule,
    IdentityHttpModule,
    AcademicsModule,
    PeopleModule,
    ExamsModule,
    SchedulingModule,
    ConductModule,
    EvaluationModule,
    ResultsModule,
    DocumentsModule,
    NotificationsModule,
    AuditModule,
  ],
})
export class AppModule {}
