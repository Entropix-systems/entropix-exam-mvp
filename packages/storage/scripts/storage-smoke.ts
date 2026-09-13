import assert from 'node:assert/strict';
import {
  randomUUID,
} from 'node:crypto';

import dotenv from 'dotenv';
import {
  fileURLToPath,
} from 'node:url';

import {
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

import {
  cleanKey,
  generatedKey,
  loadStorageConfig,
  PrivateObjectStorage,
  quarantineKey,
} from '../src/index.js';

dotenv.config({
  path: fileURLToPath(
    new URL(
      '../../../.env',
      import.meta.url,
    ),
  ),
});

const config =
  loadStorageConfig();

const storage =
  new PrivateObjectStorage(
    config,
  );

async function ensureBucket() {
  try {
    await storage.client.send(
      new HeadBucketCommand({
        Bucket:
          config.bucket,
      }),
    );
  } catch {
    await storage.client.send(
      new CreateBucketCommand({
        Bucket:
          config.bucket,
      }),
    );
  }
}

async function main() {
  await ensureBucket();

  const tenantId =
    '11111111-1111-4111-8111-111111111111';

  const cleanDocumentId =
    randomUUID();

  const cleanVersionId =
    randomUUID();

  const cleanInput = {
    tenantId,
    category: 'question-paper',
    documentId:
      cleanDocumentId,
    versionId:
      cleanVersionId,
  };

  const cleanQuarantine =
    quarantineKey(
      config,
      cleanInput,
    );

  const cleanObject =
    cleanKey(
      config,
      cleanInput,
    );

  await storage
    .putQuarantineObject(
      cleanQuarantine,
      Buffer.from(
        'Entropix Systems clean scanner fixture',
        'utf8',
      ),
      'text/plain',
    );

  assert.equal(
    await storage.exists(
      cleanQuarantine,
    ),
    true,
  );

  const cleanScan =
    await storage.scanAndPromote(
      cleanQuarantine,
      cleanObject,
    );

  assert.deepEqual(
    cleanScan,
    {
      state: 'CLEAN',
    },
  );

  assert.equal(
    await storage.exists(
      cleanQuarantine,
    ),
    false,
  );

  assert.equal(
    await storage.exists(
      cleanObject,
    ),
    true,
  );

  const infectedInput = {
    tenantId,
    category: 'question-paper',
    documentId:
      randomUUID(),
    versionId:
      randomUUID(),
  };

  const infectedQuarantine =
    quarantineKey(
      config,
      infectedInput,
    );

  const infectedClean =
    cleanKey(
      config,
      infectedInput,
    );

  const eicar =
    Buffer.from(
      String.raw`X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`,
      'utf8',
    );

  await storage
    .putQuarantineObject(
      infectedQuarantine,
      eicar,
      'application/octet-stream',
    );

  const infectedScan =
    await storage.scanAndPromote(
      infectedQuarantine,
      infectedClean,
    );

  assert.equal(
    infectedScan.state,
    'INFECTED',
  );

  assert.equal(
    await storage.exists(
      infectedQuarantine,
    ),
    true,
  );

  assert.equal(
    await storage.exists(
      infectedClean,
    ),
    false,
  );

  const generatedInput = {
    tenantId,
    category: 'admit-card',
    documentId:
      randomUUID(),
    versionId:
      randomUUID(),
  };

  const generatedObject =
    generatedKey(
      config,
      generatedInput,
    );

  await storage
    .putGeneratedObject(
      generatedObject,
      Buffer.from(
        'Generated document fixture',
        'utf8',
      ),
      'application/pdf',
    );

  assert.equal(
    await storage.exists(
      generatedObject,
    ),
    true,
  );

  const signedUrl =
    await storage
      .signedDownloadUrl(
        cleanObject,
      );

  assert.match(
    signedUrl,
    /X-Amz-Signature=/i,
  );

  console.log(
    'Storage lifecycle smoke: PASS',
  );

  console.log(
    '  Clean upload quarantine: PASS',
  );

  console.log(
    '  ClamD clean detection: PASS',
  );

  console.log(
    '  Clean promotion: PASS',
  );

  console.log(
    '  Quarantine cleanup: PASS',
  );

  console.log(
    '  EICAR detection: PASS',
  );

  console.log(
    '  Infected promotion denied: PASS',
  );

  console.log(
    '  Generated private object: PASS',
  );

  console.log(
    '  Signed download generation: PASS',
  );

  await storage.delete(
    cleanObject,
  );

  await storage.delete(
    infectedQuarantine,
  );

  await storage.delete(
    generatedObject,
  );
}

try {
  await main();
} finally {
  storage.client.destroy();
}
