import { useCallback, useEffect, useRef } from 'react';
import { ApiError } from '../lib/api';
import type { EditorDoc, EditorStore } from './store';

const DEBOUNCE_MS = 1000;
const RETRY_DELAYS = [3000, 8000, 20000, 45000];

export interface DraftBackup {
  doc: EditorDoc;
  baseVersion: number;
  savedAt: string;
}

export function draftKey(doc: Pick<EditorDoc, 'kind' | 'id'>): string {
  return `cvs.draft.${doc.kind}.${doc.id}`;
}

export function readDraft(kind: EditorDoc['kind'], id: string): DraftBackup | null {
  try {
    const raw = localStorage.getItem(`cvs.draft.${kind}.${id}`);
    return raw ? (JSON.parse(raw) as DraftBackup) : null;
  } catch {
    return null;
  }
}

export function clearDraft(kind: EditorDoc['kind'], id: string): void {
  try {
    localStorage.removeItem(`cvs.draft.${kind}.${id}`);
  } catch {
    /* ignorieren */
  }
}

/**
 * Automatisches Speichern:
 *  - Entprellt (1 s nach der letzten Änderung)
 *  - Lokale Sicherung jeder Änderung (Schutz vor Datenverlust bei Netzproblemen)
 *  - Wiederholung mit steigenden Abständen bei Fehlern
 *  - Optimistische Sperre: Konflikte (409) werden erkannt und nicht überschrieben
 *  - Warnung beim Verlassen der Seite mit ungespeicherten Änderungen
 */
export function useAutosave(store: EditorStore, save: (doc: EditorDoc, version: number) => Promise<{ version: number; updatedAt: string }>) {
  const timer = useRef<number | null>(null);
  const retry = useRef(0);
  const saving = useRef(false);
  const saveRef = useRef(save);
  saveRef.current = save;

  const run = useCallback(async () => {
    const state = store.getState();
    if (saving.current || state.saveState === 'conflict') return;
    if (state.revision === state.savedRevision) return;
    saving.current = true;
    const revision = state.revision;
    state.markSaving();
    try {
      const result = await saveRef.current(state.doc, state.version);
      retry.current = 0;
      store.getState().markSaved(result.version, revision, result.updatedAt);
      if (store.getState().revision === revision) clearDraft(state.doc.kind, state.doc.id);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'version_conflict') {
        store.getState().markError('conflict');
      } else {
        store.getState().markError('error');
        // Validierungsfehler nicht endlos wiederholen
        if (!(err instanceof ApiError && err.status === 400)) {
          const delay = RETRY_DELAYS[Math.min(retry.current, RETRY_DELAYS.length - 1)]!;
          retry.current += 1;
          timer.current = window.setTimeout(() => void run(), delay);
        }
      }
    } finally {
      saving.current = false;
      const s = store.getState();
      if (s.saveState === 'dirty' && s.revision !== s.savedRevision) schedule();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  const schedule = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void run(), DEBOUNCE_MS);
  }, [run]);

  useEffect(() => {
    let backupTimer: number | null = null;
    const unsubscribe = store.subscribe((state, prev) => {
      if (state.revision === prev.revision) return;
      schedule();
      // Lokale Sicherung (entprellt)
      if (backupTimer) window.clearTimeout(backupTimer);
      backupTimer = window.setTimeout(() => {
        try {
          const backup: DraftBackup = { doc: state.doc, baseVersion: state.version, savedAt: new Date().toISOString() };
          localStorage.setItem(draftKey(state.doc), JSON.stringify(backup));
        } catch {
          /* Speicher voll oder gesperrt */
        }
      }, 300);
    });
    return () => {
      unsubscribe();
      if (backupTimer) window.clearTimeout(backupTimer);
    };
  }, [store, schedule]);

  // Warnung beim Schließen mit ungespeicherten Änderungen
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const s = store.getState();
      if (s.revision !== s.savedRevision) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [store]);

  // Beim Verlassen des Editors ausstehende Änderungen sofort speichern
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
      const s = store.getState();
      if (s.revision !== s.savedRevision && s.saveState !== 'conflict') void run();
    },
    [store, run],
  );

  return { saveNow: run };
}
