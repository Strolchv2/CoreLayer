import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { EditorState, EditorStore } from './store';

const EditorContext = createContext<EditorStore | null>(null);

export function EditorProvider({ store, children }: { store: EditorStore; children: ReactNode }) {
  return <EditorContext.Provider value={store}>{children}</EditorContext.Provider>;
}

export function useEditorStore(): EditorStore {
  const store = useContext(EditorContext);
  if (!store) throw new Error('useEditorStore außerhalb des EditorProvider');
  return store;
}

/** Selektiert einen Teil des Editor-Zustands (rendert nur bei Änderungen dieses Teils neu). */
export function useEditor<T>(selector: (s: EditorState) => T): T {
  return useStore(useEditorStore(), selector);
}
