import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  generatedKey,
  loadStorageConfig,
  PrivateDocumentAccessDenied,
  PrivateObjectStorage,
  type PrivateDocumentAccessRecord,
} from '../src/index.js';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const config = { ...loadStorageConfig(), signedUrlTtlSeconds: 2 };
const storage = new PrivateObjectStorage(config);
const tenantId = '11111111-1111-4111-8111-111111111111';
const otherTenantId = '22222222-2222-4222-8222-222222222222';
const ownerMembershipId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherMembershipId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const now = new Date();
const key = generatedKey(config, {
  tenantId,
  category: 'release-evidence',
  documentId: randomUUID(),
  versionId: randomUUID(),
});
const clean: PrivateDocumentAccessRecord = {
  tenantId,
  objectKey: key,
  scanState: 'CLEAN',
  availableFrom: new Date(now.getTime() - 60_000),
  availableUntil: new Date(now.getTime() + 60_000),
  ownerMembershipId,
  assignedMembershipIds: [],
  allowedRoles: ['STUDENT'],
};
const owner = { tenantId, membershipId: ownerMembershipId, role: 'STUDENT' };

async function denied(record: PrivateDocumentAccessRecord, actor = owner) {
  await assert.rejects(
    storage.authorizedSignedDownloadUrl(record, actor, now),
    (error) => error instanceof PrivateDocumentAccessDenied && error.code === 'PRIVATE_DOCUMENT_ACCESS_DENIED',
  );
}

try {
  await storage.putGeneratedObject(key, Buffer.from('Private release-evidence document', 'utf8'), 'application/pdf');

  await denied({ ...clean, scanState: 'PENDING' });
  await denied({ ...clean, scanState: 'INFECTED' });
  await denied({ ...clean, availableFrom: new Date(now.getTime() + 60_000) });
  await denied({ ...clean, availableUntil: new Date(now.getTime()) });
  await denied(clean, { ...owner, membershipId: otherMembershipId });
  await denied(clean, { ...owner, role: 'AUDITOR' });
  await denied(clean, { ...owner, tenantId: otherTenantId });
  await denied({ ...clean, objectKey: `${config.quarantinePrefix}forbidden` });

  const signedUrl = await storage.authorizedSignedDownloadUrl(clean, owner, now);
  assert.match(signedUrl, /X-Amz-Signature=/i);
  assert.match(signedUrl, /X-Amz-Expires=2(?:&|$)/i);
  const initial = await fetch(signedUrl);
  assert.equal(initial.ok, true, 'Authorized signed URL did not download before expiry');
  await delay(3_100);
  const expired = await fetch(signedUrl);
  assert.equal(expired.ok, false, 'Signed URL remained downloadable after expiry');

  console.log('A12 private-document authorization: PASS');
  console.log('  PENDING and INFECTED: DENIED');
  console.log('  Before/after access window: DENIED');
  console.log('  Unassigned membership and unauthorized role: DENIED');
  console.log('  Foreign tenant and quarantine key: DENIED');
  console.log('  Authorized private download before expiry: PASS');
  console.log('  Signed URL after expiry: DENIED');
} finally {
  await storage.delete(key);
  storage.client.destroy();
}
