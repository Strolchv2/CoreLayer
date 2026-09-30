import type { SectionKey } from '../constants.js';

export type CheckStatus = 'ok' | 'warning' | 'info';

export interface CheckItem {
  /** Stabile ID der Regel (+ ggf. Eintrag) */
  id: string;
  status: CheckStatus;
  title: string;
  /** Konkreter Verbesserungsvorschlag */
  suggestion?: string;
  /** Betroffener Bereich – das Frontend springt dorthin */
  section?: SectionKey | 'personal' | 'design';
  itemId?: string;
}

export interface CheckReport {
  items: CheckItem[];
  counts: Record<CheckStatus, number>;
}

export function buildReport(items: CheckItem[]): CheckReport {
  const counts: Record<CheckStatus, number> = { ok: 0, warning: 0, info: 0 };
  for (const i of items) counts[i.status] += 1;
  const order: Record<CheckStatus, number> = { warning: 0, info: 1, ok: 2 };
  return { items: [...items].sort((a, b) => order[a.status] - order[b.status]), counts };
}
