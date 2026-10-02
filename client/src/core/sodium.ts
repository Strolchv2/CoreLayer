import sodium from 'libsodium-wrappers-sumo';

export type Sodium = typeof sodium;

/** libsodium is the only source of primitives besides the Signal library. */
export async function getSodium(): Promise<Sodium> {
  await sodium.ready;
  return sodium;
}
