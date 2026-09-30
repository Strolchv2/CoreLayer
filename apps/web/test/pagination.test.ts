import { describe, expect, it } from 'vitest';
import { paginateColumn, type MeasuredItem } from '../src/render/pagination';

const frag = (key: string, height: number, gap = 10, extra: Partial<{ words: number; lineHeight: number }> = {}) => ({ key, height, gap, ...extra });
const heading = (key: string): MeasuredItem => ({ key, keepWithNext: true, fragments: [frag(key, 30, 20)] });
const keys = (pages: { key: string; range?: [number, number] }[][]) => pages.map((p) => p.map((f) => f.key + (f.range ? `[${f.range.join('-')}]` : '')));

describe('paginateColumn', () => {
  it('keeps everything on one page when it fits', () => {
    const r = paginateColumn([heading('h1'), { key: 'a', fragments: [frag('a', 100)] }], 500, 500);
    expect(keys(r.pages)).toEqual([['h1', 'a']]);
    expect(r.overflow).toBe(false);
  });

  it('never leaves a heading alone at the bottom of a page', () => {
    const items: MeasuredItem[] = [{ key: 'x', fragments: [frag('x', 440)] }, heading('h'), { key: 'a', fragments: [frag('a', 100)] }];
    const r = paginateColumn(items, 500, 500);
    expect(keys(r.pages)).toEqual([['x'], ['h', 'a']]);
  });

  it('moves non-splittable items completely to the next page', () => {
    const items: MeasuredItem[] = [{ key: 'x', fragments: [frag('x', 400)] }, { key: 'a', fragments: [frag('a', 60), frag('a2', 60, 0)] }];
    const r = paginateColumn(items, 500, 500);
    expect(keys(r.pages)).toEqual([['x'], ['a', 'a2']]);
  });

  it('splits splittable items between fragments with at least head + one fragment', () => {
    const entry: MeasuredItem = { key: 'e', splittable: true, fragments: [frag('head', 40), frag('b1', 20, 0), frag('b2', 20, 0), frag('b3', 20, 0), frag('b4', 20, 0)] };
    const r = paginateColumn([{ key: 'x', fragments: [frag('x', 400)] }, entry], 500, 500);
    // 400 + 10 gap + 40 + 20 + 20 = 490 passt, b3 nicht mehr
    expect(keys(r.pages)).toEqual([['x', 'head', 'b1', 'b2'], ['b3', 'b4']]);
  });

  it('does not orphan an entry head without content', () => {
    const entry: MeasuredItem = { key: 'e', splittable: true, fragments: [frag('head', 40), frag('b1', 60, 0), frag('b2', 60, 0)] };
    const r = paginateColumn([{ key: 'x', fragments: [frag('x', 420)] }, entry], 500, 500);
    expect(keys(r.pages)).toEqual([['x'], ['head', 'b1', 'b2']]);
  });

  it('uses the smaller capacity only on the first page', () => {
    const items: MeasuredItem[] = Array.from({ length: 6 }, (_, i) => ({ key: `i${i}`, fragments: [frag(`i${i}`, 100, 0)] }));
    const r = paginateColumn(items, 250, 450);
    expect(keys(r.pages)).toEqual([['i0', 'i1'], ['i2', 'i3', 'i4', 'i5']]);
  });

  it('splits text that is taller than a page instead of cutting it off', () => {
    // 120 Wörter, 5 Wörter pro Zeile, 16 px Zeilenhöhe
    const measure = (_key: string, start: number, end: number) => Math.ceil((end - start) / 5) * 16;
    const text = frag('p', measure('p', 0, 120), 10, { words: 120, lineHeight: 16 });
    const r = paginateColumn([{ key: 'p', fragments: [text] }], 200, 200, measure);
    expect(r.overflow).toBe(false);
    const ranges = r.pages.flat().map((f) => f.range);
    // Alle Wörter kommen genau einmal vor
    const covered = ranges.reduce((n, rg) => n + (rg ? rg[1] - rg[0] : 120), 0);
    expect(covered).toBe(120);
    for (const page of r.pages) {
      const height = page.reduce((h, f) => h + measure('p', f.range?.[0] ?? 0, f.range?.[1] ?? 120), 0);
      expect(height).toBeLessThanOrEqual(200);
    }
  });

  it('reports overflow only when a single unsplittable fragment exceeds a page', () => {
    const r = paginateColumn([{ key: 'huge', fragments: [frag('huge', 900)] }], 500, 500);
    expect(r.overflow).toBe(true);
    expect(r.pages).toHaveLength(1);
  });

  it('produces no empty trailing pages', () => {
    const r = paginateColumn([{ key: 'a', fragments: [frag('a', 500)] }], 500, 500);
    expect(r.pages).toHaveLength(1);
  });
});
