import * as argon2 from 'argon2';

export abstract class PasswordHasher {
  abstract hash(password: string): Promise<string>;
  abstract verify(password: string, encodedHash: string): Promise<boolean>;
}

export class Argon2PasswordHasher extends PasswordHasher {
  async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
      hashLength: 32,
    });
  }

  async verify(password: string, encodedHash: string): Promise<boolean> {
    // Do not accept a downgrade to another Argon2 variant.
    if (!encodedHash.startsWith('$argon2id$')) return false;
    try {
      return await argon2.verify(encodedHash, password);
    } catch {
      return false;
    }
  }
}
