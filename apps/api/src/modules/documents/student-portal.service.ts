import type { AuthenticatedContext, UUID } from '@entropix/contracts';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { StudentPortalRepository } from './student-portal.repository.js';

function studentContext(context: AuthenticatedContext) {
  if (context.kind !== 'TENANT' || context.activeRole !== 'STUDENT') {
    throw new ForbiddenException('Only the active student role may read the student portal');
  }
  return context;
}

@Injectable()
export class StudentPortalService {
  constructor(private readonly repository: StudentPortalRepository) {}

  snapshot(context: AuthenticatedContext) {
    const current = studentContext(context);
    return this.read(current.tenantId, current.membershipId);
  }

  async registrations(context: AuthenticatedContext) {
    return (await this.snapshot(context)).registrations;
  }

  async timetables(context: AuthenticatedContext) {
    return (await this.snapshot(context)).timetables;
  }

  async result(context: AuthenticatedContext) {
    return (await this.snapshot(context)).result;
  }

  async documents(context: AuthenticatedContext) {
    return (await this.snapshot(context)).documents;
  }

  private async read(tenantId: UUID, membershipId: UUID) {
    try {
      return await this.repository.snapshot(tenantId, membershipId);
    } catch (error) {
      if (error instanceof Error && error.message === 'STUDENT_NOT_FOUND') {
        throw new NotFoundException('Student profile not found');
      }
      throw error;
    }
  }
}
