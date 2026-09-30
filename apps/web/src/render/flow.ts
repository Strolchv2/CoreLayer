import type { ReactNode } from 'react';

/** Abstand vor einem Fragment (wird nur angewendet, wenn es nicht am Seitenanfang steht). */
export type FragmentGap = 'none' | 'tight' | 'item' | 'section';

/**
 * Ein Fragment ist die kleinste Einheit, die nie über zwei Seiten verteilt wird –
 * Ausnahme: Fließtext mit `text`, der notfalls wortweise geteilt wird.
 */
export interface Fragment {
  key: string;
  gap: FragmentGap;
  node?: ReactNode;
  /** Teilbarer Fließtext: `render` erhält den (ggf. gekürzten) Text */
  text?: { value: string; render: (text: string, part: { continued: boolean; continues: boolean }) => ReactNode };
  className?: string;
}

export interface FlowItem {
  key: string;
  fragments: Fragment[];
  keepWithNext?: boolean;
  splittable?: boolean;
}

export interface DocumentFlow {
  /** Bereich über den Spalten – nur auf Seite 1 */
  top?: ReactNode;
  main: FlowItem[];
  sidebar?: FlowItem[];
}

export function splitWords(text: string): string[] {
  return text.split(/(\s+)/).reduce<string[]>((acc, part, i) => {
    // Wörter inkl. nachfolgender Leerzeichen, damit Zeilenumbrüche erhalten bleiben
    if (i % 2 === 0) acc.push(part);
    else acc[acc.length - 1] += part;
    return acc;
  }, []).filter((w) => w.length > 0);
}

export function sliceWords(text: string, start: number, end: number): string {
  return splitWords(text).slice(start, end).join('').trim();
}
