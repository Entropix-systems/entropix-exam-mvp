import type { AuthenticatedContext } from '@entropix/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { AuditRepository } from './audit.repository.js';
import { AuditService } from './audit.service.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const membershipId = '22222222-2222-4222-8222-222222222222';
const departmentId = '33333333-3333-4333-8333-333333333333';

function context(role: 'EXAM_CONTROLLER' | 'DEPARTMENT_ADMIN' | 'FACULTY' | 'INVIGILATOR' | 'STUDENT' | 'AUDITOR'): AuthenticatedContext {
  return {
    kind: 'TENANT', userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tenantId, membershipId, activeRole: role,
    grants: [{ role, departmentId: role === 'DEPARTMENT_ADMIN' ? departmentId : null }],
  };
}

function repository() {
  return {
    dashboard: vi.fn().mockResolvedValue({ exams: [] }),
    activity: vi.fn().mockResolvedValue([]),
    export: vi.fn().mockResolvedValue({ kind: 'registration-roster', rowCount: 0, csv: '' }),
  } as unknown as AuditRepository;
}

describe('AuditService tenant and role scoping', () => {
  it('passes only the active HOD department scope into dashboard and exports', async () => {
    const repo = repository(); const service = new AuditService(repo);
    await service.dashboard(context('DEPARTMENT_ADMIN'));
    await service.export(context('DEPARTMENT_ADMIN'), 'registration-roster');
    expect(repo.dashboard).toHaveBeenCalledWith(tenantId, expect.objectContaining({ membershipId, role: 'DEPARTMENT_ADMIN', departmentIds: [departmentId] }));
    expect(repo.export).toHaveBeenCalledWith(tenantId, expect.objectContaining({ departmentIds: [departmentId] }), 'registration-roster');
  });

  it('rejects out-of-scope exports and student reporting access', async () => {
    const service = new AuditService(repository());
    expect(() => service.export(context('INVIGILATOR'), 'current-result-register')).toThrow('outside the active role scope');
    expect(() => service.dashboard(context('STUDENT'))).toThrow('Permission denied');
  });

  it('allows tenant auditors to read real activity but not registration rosters', async () => {
    const repo = repository(); const service = new AuditService(repo);
    await service.activity(context('AUDITOR'));
    expect(repo.activity).toHaveBeenCalledWith(tenantId);
    expect(() => service.export(context('AUDITOR'), 'registration-roster')).toThrow('outside the active role scope');
  });

  it('does not allow an arbitrary report identifier', () => {
    const service = new AuditService(repository());
    expect(() => service.export(context('EXAM_CONTROLLER'), '../tokens')).toThrow('Report kind is invalid');
  });
});
