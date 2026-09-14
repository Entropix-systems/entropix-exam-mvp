export type PrivateDocumentScanState = 'PENDING' | 'CLEAN' | 'INFECTED';

export interface PrivateDocumentActor {
  tenantId: string;
  membershipId: string;
  role: string;
}

export interface PrivateDocumentAccessRecord {
  tenantId: string;
  objectKey: string;
  scanState: PrivateDocumentScanState;
  availableFrom: Date;
  availableUntil: Date;
  ownerMembershipId: string | null;
  assignedMembershipIds: readonly string[];
  allowedRoles: readonly string[];
}

export class PrivateDocumentAccessDenied extends Error {
  readonly code = 'PRIVATE_DOCUMENT_ACCESS_DENIED';

  constructor() {
    super('Private document is not available');
    this.name = 'PrivateDocumentAccessDenied';
  }
}

export function authorizePrivateDocument(
  record: PrivateDocumentAccessRecord,
  actor: PrivateDocumentActor,
  now: Date,
): void {
  const assigned = record.ownerMembershipId === actor.membershipId
    || record.assignedMembershipIds.includes(actor.membershipId);
  if (
    record.tenantId !== actor.tenantId
    || record.scanState !== 'CLEAN'
    || now < record.availableFrom
    || now >= record.availableUntil
    || !record.allowedRoles.includes(actor.role)
    || !assigned
  ) throw new PrivateDocumentAccessDenied();
}
