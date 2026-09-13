export interface StorageConfig {
  region: string;
  endpoint?: string;
  bucket: string;

  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle: boolean;

  quarantinePrefix: string;
  cleanPrefix: string;
  generatedPrefix: string;

  signedUrlTtlSeconds: number;

  scannerHost: string;
  scannerPort: number;
}

function required(
  env: NodeJS.ProcessEnv,
  key: string,
): string {
  const value = env[key];

  if (!value) {
    throw new Error(
      `Missing required storage environment variable: ${key}`,
    );
  }

  return value;
}

function prefix(value: string): string {
  const stripped =
    value.replace(/^\/+|\/+$/g, '');

  return `${stripped}/`;
}

export function loadStorageConfig(
  env: NodeJS.ProcessEnv = process.env,
): StorageConfig {
  const accessKeyId =
    env.S3_ACCESS_KEY_ID || undefined;

  const secretAccessKey =
    env.S3_SECRET_ACCESS_KEY || undefined;

  if (
    Boolean(accessKeyId) !==
    Boolean(secretAccessKey)
  ) {
    throw new Error(
      'S3 access key and secret must be configured together',
    );
  }

  return {
    region: required(env, 'S3_REGION'),

    endpoint:
      env.S3_ENDPOINT || undefined,

    bucket:
      required(env, 'S3_BUCKET'),

    accessKeyId,
    secretAccessKey,

    forcePathStyle:
      env.S3_FORCE_PATH_STYLE === 'true',

    quarantinePrefix:
      prefix(
        env.S3_QUARANTINE_PREFIX ||
          'quarantine/',
      ),

    cleanPrefix:
      prefix(
        env.S3_CLEAN_PREFIX ||
          'clean/',
      ),

    generatedPrefix:
      prefix(
        env.S3_GENERATED_PREFIX ||
          'generated/',
      ),

    signedUrlTtlSeconds:
      Number(
        env.SIGNED_URL_TTL_SECONDS ||
          '60',
      ),

    scannerHost:
      required(env, 'SCANNER_HOST'),

    scannerPort:
      Number(
        required(env, 'SCANNER_PORT'),
      ),
  };
}
