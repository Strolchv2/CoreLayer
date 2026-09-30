import { hash, verify } from '@node-rs/argon2';

/** Argon2id (Standardalgorithmus von @node-rs/argon2) mit OWASP-Empfehlung (m=19 MiB, t=2, p=1). */
const OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(hashValue: string, password: string): Promise<boolean> {
  try {
    return await verify(hashValue, password);
  } catch {
    return false;
  }
}

/** Vorberechneter Hash, um bei unbekannten E-Mails dieselbe Rechenzeit zu verbrauchen (kein Timing-Leak). */
let dummyHash: Promise<string> | null = null;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword('dummy-password-for-timing-safety');
  return dummyHash;
}
