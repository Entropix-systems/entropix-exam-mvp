import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import {
  getSignedUrl,
} from '@aws-sdk/s3-request-presigner';

import type {
  StorageConfig,
} from './config.js';

import {
  scanChunks,
  type ScanResult,
} from './clamd.js';

import {
  authorizePrivateDocument,
  PrivateDocumentAccessDenied,
  type PrivateDocumentAccessRecord,
  type PrivateDocumentActor,
} from './authorization.js';

export class PrivateObjectStorage {
  readonly client: S3Client;

  constructor(
    readonly config: StorageConfig,
  ) {
    this.client =
      new S3Client({
        region:
          config.region,

        endpoint:
          config.endpoint,

        forcePathStyle:
          config.forcePathStyle,

        credentials: {
          accessKeyId:
            config.accessKeyId,

          secretAccessKey:
            config.secretAccessKey,
        },
      });
  }

  async putQuarantineObject(
    key: string,
    body: Uint8Array,
    contentType:
      string = 'application/octet-stream',
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket:
          this.config.bucket,

        Key: key,

        Body: body,

        ContentType:
          contentType,
      }),
    );
  }

  async putGeneratedObject(
    key: string,
    body: Uint8Array,
    contentType:
      string = 'application/octet-stream',
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket:
          this.config.bucket,

        Key: key,

        Body: body,

        ContentType:
          contentType,
      }),
    );
  }

  async exists(
    key: string,
  ): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket:
            this.config.bucket,

          Key: key,
        }),
      );

      return true;
    } catch {
      return false;
    }
  }

  async delete(
    key: string,
  ): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket:
          this.config.bucket,

        Key: key,
      }),
    );
  }

  async scanObject(
    key: string,
  ): Promise<ScanResult> {
    const response =
      await this.client.send(
        new GetObjectCommand({
          Bucket:
            this.config.bucket,

          Key: key,
        }),
      );

    const body =
      response.Body;

    if (!body) {
      throw new Error(
        `Object body missing: ${key}`,
      );
    }

    return scanChunks(
      body as AsyncIterable<Uint8Array>,
      {
        host:
          this.config.scannerHost,

        port:
          this.config.scannerPort,
      },
    );
  }

  async promoteCleanObject(
    quarantineObjectKey: string,
    cleanObjectKey: string,
  ): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket:
          this.config.bucket,

        CopySource:
          `${this.config.bucket}/${quarantineObjectKey}`,

        Key:
          cleanObjectKey,
      }),
    );

    await this.delete(
      quarantineObjectKey,
    );
  }

  async scanAndPromote(
    quarantineObjectKey: string,
    cleanObjectKey: string,
  ): Promise<ScanResult> {
    const scan =
      await this.scanObject(
        quarantineObjectKey,
      );

    if (
      scan.state === 'CLEAN'
    ) {
      await this.promoteCleanObject(
        quarantineObjectKey,
        cleanObjectKey,
      );
    }

    return scan;
  }

  async signedDownloadUrl(
    key: string,
    expiresIn:
      number =
        this.config
          .signedUrlTtlSeconds,
  ): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket:
          this.config.bucket,

        Key: key,
      }),
      {
        expiresIn,
      },
    );
  }

  async authorizedSignedDownloadUrl(
    record: PrivateDocumentAccessRecord,
    actor: PrivateDocumentActor,
    now: Date = new Date(),
  ): Promise<string> {
    authorizePrivateDocument(record, actor, now);
    if (
      !record.objectKey.startsWith(this.config.cleanPrefix)
      && !record.objectKey.startsWith(this.config.generatedPrefix)
    ) throw new PrivateDocumentAccessDenied();
    if (!(await this.exists(record.objectKey))) throw new PrivateDocumentAccessDenied();
    const windowSeconds = Math.floor((record.availableUntil.getTime() - now.getTime()) / 1000);
    if (windowSeconds < 1) throw new PrivateDocumentAccessDenied();
    return this.signedDownloadUrl(record.objectKey, Math.min(this.config.signedUrlTtlSeconds, windowSeconds));
  }
}
