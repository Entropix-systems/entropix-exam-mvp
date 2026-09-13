import net from 'node:net';
import { once } from 'node:events';

export interface ClamDConfig {
  host: string;
  port: number;
  timeoutMs?: number;
}

export type ScanResult =
  | {
      state: 'CLEAN';
    }
  | {
      state: 'INFECTED';
      signature: string;
    };

async function write(
  socket: net.Socket,
  value: Uint8Array,
): Promise<void> {
  await new Promise<void>(
    (resolve, reject) => {
      socket.write(
        value,
        (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        },
      );
    },
  );
}

function parseResponse(
  raw: string,
): ScanResult {
  const value =
    raw.replaceAll('\0', '').trim();

  if (
    value.endsWith('OK')
  ) {
    return {
      state: 'CLEAN',
    };
  }

  const infected =
    value.match(
      /:\s+(.+)\s+FOUND$/,
    );

  if (infected?.[1]) {
    return {
      state: 'INFECTED',
      signature: infected[1],
    };
  }

  throw new Error(
    `Unexpected ClamD response: ${value}`,
  );
}

export async function scanChunks(
  chunks:
    | AsyncIterable<Uint8Array>
    | Iterable<Uint8Array>,
  config: ClamDConfig,
): Promise<ScanResult> {
  const socket =
    net.createConnection({
      host: config.host,
      port: config.port,
    });

  socket.setTimeout(
    config.timeoutMs ?? 30_000,
  );

  try {
    await once(
      socket,
      'connect',
    );

    let response = '';

    const responsePromise =
      new Promise<ScanResult>(
        (resolve, reject) => {
          socket.on(
            'data',
            (chunk) => {
              response +=
                chunk.toString(
                  'utf8',
                );

              if (
                response.includes('\0')
              ) {
                try {
                  resolve(
                    parseResponse(
                      response,
                    ),
                  );
                } catch (
                  error
                ) {
                  reject(error);
                }
              }
            },
          );

          socket.once(
            'error',
            reject,
          );

          socket.once(
            'timeout',
            () => {
              reject(
                new Error(
                  'ClamD scan timed out',
                ),
              );
            },
          );

          socket.once(
            'end',
            () => {
              if (
                !response.includes(
                  '\0',
                )
              ) {
                try {
                  resolve(
                    parseResponse(
                      response,
                    ),
                  );
                } catch (
                  error
                ) {
                  reject(error);
                }
              }
            },
          );
        },
      );

    await write(
      socket,
      Buffer.from(
        'zINSTREAM\0',
        'utf8',
      ),
    );

    for await (
      const sourceChunk of chunks
    ) {
      const chunk =
        Buffer.from(sourceChunk);

      if (
        chunk.length === 0
      ) {
        continue;
      }

      const length =
        Buffer.allocUnsafe(4);

      length.writeUInt32BE(
        chunk.length,
        0,
      );

      await write(
        socket,
        length,
      );

      await write(
        socket,
        chunk,
      );
    }

    const end =
      Buffer.alloc(4);

    end.writeUInt32BE(
      0,
      0,
    );

    await write(
      socket,
      end,
    );

    return await responsePromise;
  } finally {
    socket.destroy();
  }
}

export async function scanBuffer(
  buffer: Uint8Array,
  config: ClamDConfig,
): Promise<ScanResult> {
  async function* chunks() {
    yield buffer;
  }

  return scanChunks(
    chunks(),
    config,
  );
}
