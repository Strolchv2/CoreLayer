/**
 * Editor-Zustand (Zustand + Immer). Wird für Lebensläufe und Profile verwendet.
 */
import {
  createId,
  createItem,
  type DateFormat,
  type DesignSettings,
  type ListSectionItemMap,
  type ListSectionKey,
  type Locale,
  type ResumeContent,
  type SectionConfig,
  type SectionKey,
  type TemplateKey,
} from '@cv-studio/shared';
import { produce } from 'immer';
import { createStore, type StoreApi } from 'zustand/vanilla';

export interface EditorDoc {
  kind: 'resume' | 'profile';
  id: string;
  title: string;
  description: string;
  language: Locale;
  templateKey: TemplateKey;
  design: DesignSettings;
  dateFormat: DateFormat;
  attachmentIds: string[];
  content: ResumeContent;
}

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';

export interface EditorFocus {
  section: SectionKey | 'personal' | 'design';
  itemId?: string;
  nonce: number;
}

export interface EditorState {
  doc: EditorDoc;
  version: number;
  revision: number;
  savedRevision: number;
  saveState: SaveState;
  lastSavedAt: string | null;
  focus: EditorFocus | null;
  /** Zuletzt hinzugefügter Eintrag (wird aufgeklappt) */
  newItemId: string | null;

  update: (recipe: (doc: EditorDoc) => void) => void;
  updateContent: (recipe: (c: ResumeContent) => void) => void;
  updateSection: (key: SectionKey, patch: Partial<Omit<SectionConfig, 'key'>>) => void;
  moveSection: (from: number, to: number) => void;
  addItem: <K extends ListSectionKey>(key: K, init?: Partial<ListSectionItemMap[K]>) => string;
  updateItem: <K extends ListSectionKey>(key: K, id: string, patch: Partial<ListSectionItemMap[K]>) => void;
  removeItem: (key: ListSectionKey, id: string) => void;
  duplicateItem: (key: ListSectionKey, id: string) => void;
  moveItem: (key: ListSectionKey, from: number, to: number) => void;
  setFocus: (focus: Omit<EditorFocus, 'nonce'> | null) => void;
  markSaving: () => void;
  markSaved: (version: number, revision: number, savedAt: string) => void;
  markError: (state: 'error' | 'conflict') => void;
  replaceDoc: (doc: EditorDoc, version: number) => void;
}

export type EditorStore = StoreApi<EditorState>;

function move<T>(list: T[], from: number, to: number): T[] {
  const copy = list.slice();
  const [item] = copy.splice(from, 1);
  if (item !== undefined) copy.splice(to, 0, item);
  return copy;
}

export function createEditorStore(doc: EditorDoc, version: number): EditorStore {
  return createStore<EditorState>()((set, get) => {
    const commit = (recipe: (doc: EditorDoc) => void) =>
      set((s) => ({
        doc: produce(s.doc, recipe),
        revision: s.revision + 1,
        saveState: s.saveState === 'conflict' ? 'conflict' : s.saveState === 'saving' ? 'saving' : 'dirty',
      }));

    return {
      doc,
      version,
      revision: 0,
      savedRevision: 0,
      saveState: 'saved',
      lastSavedAt: null,
      focus: null,
      newItemId: null,

      update: commit,
      updateContent: (recipe) => commit((d) => recipe(d.content)),
      updateSection: (key, patch) =>
        commit((d) => {
          const s = d.content.sections.find((x) => x.key === key);
          if (s) Object.assign(s, patch, patch.options ? { options: { ...s.options, ...patch.options } } : {});
        }),
      moveSection: (from, to) =>
        commit((d) => {
          d.content.sections = move(d.content.sections, from, to);
        }),
      addItem: (key, init) => {
        const item = { ...createItem(key), ...(init ?? {}) };
        commit((d) => {
          (d.content[key] as unknown[]).push(item);
          const section = d.content.sections.find((s) => s.key === key);
          if (section) section.visible = true;
        });
        set({ newItemId: item.id });
        return item.id;
      },
      updateItem: (key, id, patch) =>
        commit((d) => {
          const item = (d.content[key] as { id: string }[]).find((i) => i.id === id);
          if (item) Object.assign(item, patch);
        }),
      removeItem: (key, id) =>
        commit((d) => {
          (d.content[key] as { id: string }[]) = (d.content[key] as { id: string }[]).filter((i) => i.id !== id);
        }),
      duplicateItem: (key, id) => {
        const list = get().doc.content[key] as { id: string }[];
        const index = list.findIndex((i) => i.id === id);
        if (index < 0) return;
        const copy = structuredClone(list[index]!) as { id: string; items?: { id: string }[] };
        copy.id = createId();
        if (Array.isArray(copy.items)) copy.items = copy.items.map((s) => ({ ...s, id: createId() }));
        commit((d) => {
          (d.content[key] as unknown[]).splice(index + 1, 0, copy);
        });
        set({ newItemId: copy.id });
      },
      moveItem: (key, from, to) =>
        commit((d) => {
          (d.content[key] as unknown[]) = move(d.content[key] as unknown[], from, to);
        }),
      setFocus: (focus) => set({ focus: focus ? { ...focus, nonce: Date.now() } : null }),
      markSaving: () => set({ saveState: 'saving' }),
      markSaved: (v, revision, savedAt) =>
        set((s) => ({
          version: v,
          savedRevision: revision,
          lastSavedAt: savedAt,
          saveState: s.revision === revision ? 'saved' : 'dirty',
        })),
      markError: (state) => set({ saveState: state }),
      replaceDoc: (d, v) => set({ doc: d, version: v, revision: 0, savedRevision: 0, saveState: 'saved' }),
    };
  });
}
