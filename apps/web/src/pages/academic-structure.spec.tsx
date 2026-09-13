import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AcademicStructureContent } from './academic-structure'

describe('Academic structure setup view', () => {
  it('renders persisted Northstar hierarchy without internal identifiers', () => {
    const html = renderToStaticMarkup(
      <AcademicStructureContent structure={{
        tenant: {
          id: 'tenant-id',
          name: 'Northstar College',
          slug: 'northstar-college',
          timezone: 'Asia/Kolkata',
        },
        campuses: [{ id: 'campus-id', tenantId: 'tenant-id', code: 'MAIN', name: 'Main Campus' }],
        departments: [{ id: 'department-id', tenantId: 'tenant-id', campusId: 'campus-id', code: 'CSE', name: 'Computer Science' }],
        programs: [{ id: 'program-id', tenantId: 'tenant-id', departmentId: 'department-id', code: 'BSC-CS', name: 'BSc Computer Science' }],
        academicYears: [{ id: 'year-id', tenantId: 'tenant-id', code: 'AY2026', name: '2026-27', startsOn: '2026-06-01', endsOn: '2027-05-31' }],
        terms: [{ id: 'term-id', tenantId: 'tenant-id', programId: 'program-id', academicYearId: 'year-id', code: 'SEM3', name: 'Semester 3', startsOn: '2026-07-01', endsOn: '2026-12-31', sequence: 3 }],
        cohorts: [{ id: 'cohort-id', tenantId: 'tenant-id', termId: 'term-id', code: 'BSC-CS-S3', name: 'BSc Computer Science Semester 3' }],
        subjects: [{ id: 'subject-stable-id', tenantId: 'tenant-id', programId: 'program-id', code: 'CS301', name: 'Data Structures', credits: 3 }],
      }} />,
    )

    expect(html).toContain('Northstar College')
    expect(html).toContain('Main Campus')
    expect(html).toContain('Semester 3 · BSc Computer Science Semester 3')
    expect(html).toContain('Computer Science')
    expect(html).toContain('CS301')
    expect(html).not.toContain('subject-stable-id')
    expect(html).not.toContain('department-id')
  })
})
