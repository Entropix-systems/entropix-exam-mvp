import { describe, expect, it } from 'vitest';
import { auditCommand } from './audit.interceptor.js';

describe('command audit classification', () => {
  it('classifies successful business command routes with stable actions and targets', () => {
    expect(auditCommand('POST', '/conduct/sittings/11111111-1111-4111-8111-111111111111/attendance/submit')).toEqual({ action: 'ATTENDANCE_SUBMITTED', targetType: 'ATTENDANCE_BATCH' });
    expect(auditCommand('POST', '/results/runs/22222222-2222-4222-8222-222222222222/publish')).toEqual({ action: 'RESULTS_PUBLISHED', targetType: 'PUBLICATION' });
    expect(auditCommand('PUT', '/evaluation/subjects/33333333-3333-4333-8333-333333333333/marks')).toEqual({ action: 'MARKS_SAVED', targetType: 'EXAM_SUBJECT' });
  });

  it('does not mislabel reads, allocation previews, auth requests, or exports as commands', () => {
    expect(auditCommand('GET', '/results')).toBeNull();
    expect(auditCommand('POST', '/scheduling/papers/id/allocations/preview')).toBeNull();
    expect(auditCommand('POST', '/auth/login')).toBeNull();
    expect(auditCommand('GET', '/audit/exports/current-result-register')).toBeNull();
  });
});
