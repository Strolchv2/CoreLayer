/**
 * Seitenumbruch-Algorithmus (rein, ohne DOM – dadurch testbar).
 *
 * Eingabe: vermessene "Flow-Items" einer Spalte. Jedes Item besteht aus Fragmenten
 * (z. B. Kopf eines Eintrags, einzelne Aufzählungspunkte, Absätze).
 *
 * Regeln:
 *  - Überschriften (keepWithNext) stehen nie allein am Seitenende, sondern immer mit
 *    dem Anfang des folgenden Eintrags.
 *  - Nicht teilbare Items wandern komplett auf die nächste Seite.
 *  - Teilbare Items werden nur zwischen Fragmenten getrennt – mit mindestens zwei
 *    Fragmenten am Anfang (Kopf + erster Inhalt) und einem am Ende.
 *  - Absätze, die größer als der verfügbare Platz sind, werden wortweise geteilt
 *    (nur wenn nötig), damit niemals Text abgeschnitten wird.
 */

export interface MeasuredFragment {
  key: string;
  /** Höhe in px */
  height: number;
  /** Abstand vor dem Fragment, wenn es nicht das erste auf der Seite ist */
  gap: number;
  /** Nur bei teilbarem Fließtext: Anzahl Wörter */
  words?: number;
  /** Zeilenhöhe in px (für Mindestzeilen beim Teilen von Text) */
  lineHeight?: number;
}

export interface MeasuredItem {
  key: string;
  fragments: MeasuredFragment[];
  keepWithNext?: boolean;
  splittable?: boolean;
}

/** Platzierung eines Fragments; bei geteiltem Text mit Wortbereich. */
export interface PlacedFragment {
  key: string;
  range?: [number, number];
}

export interface ColumnLayout {
  pages: PlacedFragment[][];
  /** true, wenn ein unteilbares Fragment höher als eine ganze Seite ist */
  overflow: boolean;
}

/** Misst die Höhe eines Textausschnitts (erste `words` Wörter ab `start`). */
export type TextMeasure = (fragmentKey: string, start: number, end: number) => number;

const EPSILON = 0.5;
const MIN_TEXT_LINES = 2;

export function paginateColumn(
  items: MeasuredItem[],
  capacityFirst: number,
  capacityNext: number,
  measureText?: TextMeasure,
): ColumnLayout {
  const pages: PlacedFragment[][] = [[]];
  let used = 0;
  let capacity = capacityFirst;
  let overflow = false;

  const current = () => pages[pages.length - 1]!;
  const isEmpty = () => current().length === 0;
  const heightOf = (f: MeasuredFragment, first: boolean) => f.height + (first ? 0 : f.gap);
  const newPage = () => {
    pages.push([]);
    used = 0;
    capacity = capacityNext;
  };
  const place = (f: MeasuredFragment, range?: [number, number], height?: number) => {
    const first = isEmpty();
    used += (height ?? f.height) + (first ? 0 : f.gap);
    current().push(range ? { key: f.key, range } : { key: f.key });
  };
  const fitsAll = (frags: MeasuredFragment[]) => {
    let u = used;
    let first = isEmpty();
    for (const f of frags) {
      u += heightOf(f, first);
      first = false;
    }
    return u <= capacity + EPSILON;
  };
  const countFitting = (frags: MeasuredFragment[]) => {
    let u = used;
    let first = isEmpty();
    let n = 0;
    for (const f of frags) {
      u += heightOf(f, first);
      if (u > capacity + EPSILON) break;
      first = false;
      n += 1;
    }
    return n;
  };
  const lead = (item: MeasuredItem | undefined): MeasuredFragment[] => {
    if (!item) return [];
    if (!item.splittable) return item.fragments;
    return item.fragments.slice(0, Math.min(2, item.fragments.length));
  };

  /**
   * Versucht, Fließtext wortweise zu teilen, sodass der erste Teil in den Restplatz passt.
   * Liefert die Anzahl Wörter des ersten Teils oder 0.
   */
  const splitText = (f: MeasuredFragment, start: number): number => {
    if (!measureText || !f.words || f.words - start < 2) return 0;
    const first = isEmpty();
    const available = capacity - used - (first ? 0 : f.gap);
    const minHeight = (f.lineHeight ?? 16) * MIN_TEXT_LINES;
    if (available < minHeight) return 0;
    let lo = 1;
    let hi = f.words - start - 1; // mind. ein Wort bleibt für die nächste Seite
    let best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const h = measureText(f.key, start, start + mid);
      if (h <= available + EPSILON) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return best;
  };

  /** Platziert ein einzelnes Fragment, ggf. mit Textteilung über mehrere Seiten. */
  const placeWithTextSplit = (f: MeasuredFragment) => {
    if (fitsAll([f])) return place(f);
    if (!f.words || !measureText) {
      if (!isEmpty()) newPage();
      if (!fitsAll([f])) overflow = true;
      return place(f);
    }
    let start = 0;
    while (start < f.words) {
      const remainingHeight = start === 0 ? f.height : measureText(f.key, start, f.words);
      const rest: MeasuredFragment = { ...f, height: remainingHeight };
      if (fitsAll([rest])) {
        place(f, start === 0 ? undefined : [start, f.words], remainingHeight);
        return;
      }
      const n = splitText(f, start);
      if (n > 0) {
        const h = measureText(f.key, start, start + n);
        place(f, [start, start + n], h);
        start += n;
        newPage();
        continue;
      }
      if (!isEmpty()) {
        newPage();
        continue;
      }
      // Leere Seite und trotzdem kein sinnvoller Teil möglich (z. B. ein einzelnes Riesenwort)
      overflow = true;
      place(f, start === 0 ? undefined : [start, f.words], remainingHeight);
      return;
    }
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const frags = item.fragments;
    if (frags.length === 0) continue;

    // 1. Überschriften: nur zusammen mit dem Anfang des nächsten Eintrags
    if (item.keepWithNext) {
      const next = items[i + 1];
      if (fitsAll([...frags, ...lead(next)])) {
        frags.forEach((f) => place(f));
      } else {
        if (!isEmpty()) newPage();
        frags.forEach((f) => place(f));
      }
      continue;
    }

    // 2. Passt komplett
    if (fitsAll(frags)) {
      frags.forEach((f) => place(f));
      continue;
    }

    // 3. Nicht teilbar: komplett auf die nächste Seite
    if (!item.splittable || frags.length < 2) {
      const headingPlacedAbove = previousWasHeadingOnThisPage(items, i, current());
      if (!isEmpty() && !headingPlacedAbove) newPage();
      if (frags.length === 1) {
        placeWithTextSplit(frags[0]!);
      } else {
        if (!fitsAll(frags)) {
          // Höher als eine Seite: fragmentweise verteilen, statt abzuschneiden
          frags.forEach((f) => placeWithTextSplit(f));
        } else {
          frags.forEach((f) => place(f));
        }
      }
      continue;
    }

    // 4. Teilbar: so viele Fragmente wie sinnvoll auf diese Seite
    let idx = 0;
    while (idx < frags.length) {
      const remaining = frags.slice(idx);
      if (fitsAll(remaining)) {
        remaining.forEach((f) => place(f));
        break;
      }
      const k = countFitting(remaining);
      const minHead = idx === 0 ? Math.min(2, remaining.length) : 1;
      if (k >= minHead && remaining.length - k >= 1) {
        remaining.slice(0, k).forEach((f) => place(f));
        idx += k;
        // Nächstes Fragment ggf. als Text teilen, statt Platz zu verschenken
        const nextFrag = frags[idx]!;
        if (nextFrag.words && splitText(nextFrag, 0) > 0) {
          placeWithTextSplit(nextFrag);
          idx += 1;
          continue;
        }
        newPage();
        continue;
      }
      if (!isEmpty() && !(idx === 0 && previousWasHeadingOnThisPage(items, i, current()))) {
        newPage();
        continue;
      }
      // Leere Seite (oder direkt unter der eigenen Überschrift): mindestens ein Fragment setzen
      const n = Math.max(k, 1);
      if (k === 0) {
        placeWithTextSplit(remaining[0]!);
        idx += 1;
      } else {
        remaining.slice(0, n).forEach((f) => place(f));
        idx += n;
        if (idx < frags.length) newPage();
      }
    }
  }

  // Leere letzte Seite vermeiden
  if (pages.length > 1 && pages[pages.length - 1]!.length === 0) pages.pop();
  return { pages, overflow };
}

/** Wurde direkt davor eine Überschrift auf derselben Seite platziert? (Dann nicht trennen.) */
function previousWasHeadingOnThisPage(items: MeasuredItem[], index: number, page: PlacedFragment[]): boolean {
  const prev = items[index - 1];
  if (!prev?.keepWithNext) return false;
  const lastKey = page[page.length - 1]?.key;
  return prev.fragments.some((f) => f.key === lastKey);
}
