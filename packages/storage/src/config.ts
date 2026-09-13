export interface StorageConfig {
  region: string;
  endpoint: string;
  bucket: string;

  accessKeyId: string;
  secretAccessKey: string;
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
  if (
    env.STORAGE_PROVIDER &&
    env.STORAGE_PROVIDER !== 's3'
  ) {
    throw new Error(
      'Unsupported storage provider',
    );
  }

  return {
    region:
      required(env, 'STORAGE_REGION'),

    endpoint:
      required(env, 'STORAGE_ENDPOINT'),

    bucket:
      required(env, 'STORAGE_BUCKET'),

    accessKeyId:
      required(
        env,
        'STORAGE_ACCESS_KEY_ID',
      ),

    secretAccessKey:
      required(
        env,
        'STORAGE_SECRET_ACCESS_KEY',
      ),

    forcePathStyle:
      env.STORAGE_FORCE_PATH_STYLE !==
      'false',

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
        env.STORAGE_SIGNED_URL_TTL_SECONDS ||
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
