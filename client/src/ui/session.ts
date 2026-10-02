import { useSyncExternalStore } from 'react';
import { Api } from '../core/api';
import { Messenger } from '../core/engine';
import type { VaultState } from '../core/state';
import { IndexedDbVaultStorage, type Vault } from '../core/vault';

export const storage = new IndexedDbVaultStorage();
export const api = new Api(window.location.origin);
const wsBase = window.location.origin.replace(/^http/, 'ws');

/** The single unlocked session of this tab. Nothing survives a reload except the encrypted vault. */
let messenger: Messenger | null = null;
let vaultRef: Vault | null = null;
const listeners = new Set<() => void>();
let version = 0;
const bump = () => {
  version++;
  for (const l of listeners) l();
};

export function openSession(vault: Vault, state: VaultState): Messenger {
  vaultRef = vault;
  messenger = new Messenger({ api, wsBase, vault, state });
  messenger.subscribe(bump);
  messenger.start();
  bump();
  return messenger;
}

export async function lockSession(): Promise<void> {
  if (messenger) await messenger.stop();
  await vaultRef?.wipeKey();
  messenger = null;
  vaultRef = null;
  bump();
}

export async function eraseLocalData(): Promise<void> {
  await lockSession();
  await storage.clear();
  bump();
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Re-renders whenever the engine state changes. */
export function useMessenger(): Messenger | null {
  useSyncExternalStore(subscribe, () => version);
  return messenger;
}
