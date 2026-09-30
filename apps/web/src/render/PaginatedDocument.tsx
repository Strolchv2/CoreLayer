import clsx from 'clsx';
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { sliceWords, splitWords, type DocumentFlow, type Fragment, type FlowItem } from './flow';
import { paginateColumn, type MeasuredItem, type PlacedFragment } from './pagination';

export type ColumnLayoutKind = 'single' | 'sidebar-left' | 'sidebar-right';

interface PageLayout {
  main: PlacedFragment[];
  sidebar: PlacedFragment[];
}

export interface LayoutInfo {
  pageCount: number;
  overflow: boolean;
}

interface Props {
  flow: DocumentFlow;
  layout: ColumnLayoutKind;
  pageClassName: string;
  pageStyle: CSSProperties;
  /** Seitenzahl, Dekorationen usw. */
  renderChrome?: (pageIndex: number, pageCount: number) => ReactNode;
  /** Ändert sich dieser Schlüssel (z. B. nach dem Laden von Schriften), wird neu vermessen */
  measureKey?: string | number;
  /** Nach erfolgreicher Berechnung Messbereich entfernen (PDF-Erzeugung) */
  freezeAfterLayout?: boolean;
  onLayout?: (info: LayoutInfo) => void;
  /** Zusätzliche Elemente zwischen den Seiten (Vorschau) */
  pageWrapper?: (page: ReactNode, index: number, total: number) => ReactNode;
}

function Page(props: {
  first: boolean;
  layout: ColumnLayoutKind;
  className: string;
  style: CSSProperties;
  top?: ReactNode;
  main: ReactNode;
  sidebar?: ReactNode;
  chrome?: ReactNode;
  measure?: 'first' | 'next';
}) {
  const hasSidebar = props.layout !== 'single';
  const sidebar = hasSidebar ? (
    <div className="cv-col cv-col--sidebar" data-col="sidebar">
      {props.sidebar}
    </div>
  ) : null;
  const main = (
    <div className="cv-col cv-col--main" data-col="main">
      {props.main}
    </div>
  );
  return (
    <div
      className={clsx('cv-page', `cv-layout-${props.layout}`, props.className, props.first ? 'cv-page--first' : 'cv-page--next')}
      style={props.style}
      data-measure={props.measure}
    >
      <div className="cv-decor" aria-hidden="true" />
      {props.first && props.top ? <div className="cv-top">{props.top}</div> : null}
      <div className="cv-body">
        {props.layout === 'sidebar-left' ? (
          <>
            {sidebar}
            {main}
          </>
        ) : (
          <>
            {main}
            {sidebar}
          </>
        )}
      </div>
      {props.chrome}
    </div>
  );
}

function FragmentView({ fragment, range }: { fragment: Fragment; range?: [number, number] }) {
  let content: ReactNode = fragment.node;
  if (fragment.text) {
    const total = splitWords(fragment.text.value).length;
    const start = range?.[0] ?? 0;
    const end = range?.[1] ?? total;
    const text = range ? sliceWords(fragment.text.value, start, end) : fragment.text.value;
    content = fragment.text.render(text, { continued: start > 0, continues: end < total });
  }
  return (
    <div className={clsx('cv-frag', `cv-gap-${fragment.gap}`, fragment.className)} data-frag={fragment.key}>
      {content}
    </div>
  );
}

function renderColumn(items: FlowItem[]) {
  return items.flatMap((item) => item.fragments.map((f) => <FragmentView key={f.key} fragment={f} />));
}

function px(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function contentHeight(el: Element): number {
  const cs = getComputedStyle(el);
  return el.getBoundingClientRect().height - px(cs.paddingTop) - px(cs.paddingBottom);
}

/** Vermisst alle Fragmente im (unsichtbaren) Messbereich und berechnet die Seitenaufteilung. */
function computeLayout(container: HTMLElement, flow: DocumentFlow, hasSidebar: boolean): { pages: PageLayout[]; overflow: boolean } | null {
  const first = container.querySelector<HTMLElement>('[data-measure="first"]');
  const next = container.querySelector<HTMLElement>('[data-measure="next"]');
  if (!first || !next) return null;

  const fragmentIndex = new Map<string, Fragment>();
  for (const item of [...flow.main, ...(flow.sidebar ?? [])]) for (const f of item.fragments) fragmentIndex.set(f.key, f);

  const measureColumn = (colName: 'main' | 'sidebar', items: FlowItem[]) => {
    const colFirst = first.querySelector<HTMLElement>(`[data-col="${colName}"]`);
    const colNext = next.querySelector<HTMLElement>(`[data-col="${colName}"]`);
    if (!colFirst || !colNext) return { pages: [[]] as PlacedFragment[][], overflow: false };
    const capFirst = contentHeight(colFirst) - 1;
    const capNext = contentHeight(colNext) - 1;
    const elements = new Map<string, HTMLElement>();
    colFirst.querySelectorAll<HTMLElement>(':scope > .cv-frag').forEach((el) => elements.set(el.dataset.frag ?? '', el));

    const measured: MeasuredItem[] = items.map((item) => ({
      key: item.key,
      keepWithNext: item.keepWithNext,
      splittable: item.splittable,
      fragments: item.fragments.map((f) => {
        const el = elements.get(f.key);
        if (!el) return { key: f.key, height: 0, gap: 0 };
        const cs = getComputedStyle(el);
        const textEl = f.text ? el.querySelector<HTMLElement>('[data-text]') : null;
        return {
          key: f.key,
          height: el.getBoundingClientRect().height,
          gap: px(cs.marginTop),
          words: textEl && f.text ? splitWords(f.text.value).length : undefined,
          lineHeight: textEl ? px(getComputedStyle(textEl).lineHeight) || undefined : undefined,
        };
      }),
    }));

    const measureText = (key: string, start: number, end: number) => {
      const el = elements.get(key);
      const fragment = fragmentIndex.get(key);
      if (!el || !fragment?.text) return 0;
      const clone = el.cloneNode(true) as HTMLElement;
      const target = clone.querySelector<HTMLElement>('[data-text]');
      if (!target) return el.getBoundingClientRect().height;
      target.textContent = sliceWords(fragment.text.value, start, end);
      clone.style.marginTop = '0';
      colFirst.appendChild(clone);
      const h = clone.getBoundingClientRect().height;
      clone.remove();
      return h;
    };

    return paginateColumn(measured, capFirst, capNext, measureText);
  };

  const main = measureColumn('main', flow.main);
  const sidebar = hasSidebar ? measureColumn('sidebar', flow.sidebar ?? []) : { pages: [[]] as PlacedFragment[][], overflow: false };
  const count = Math.max(main.pages.length, sidebar.pages.length, 1);
  const pages: PageLayout[] = Array.from({ length: count }, (_, i) => ({ main: main.pages[i] ?? [], sidebar: sidebar.pages[i] ?? [] }));
  return { pages, overflow: main.overflow || sidebar.overflow };
}

function sameLayout(a: PageLayout[] | null, b: PageLayout[]): boolean {
  if (!a || a.length !== b.length) return false;
  const sig = (p: PlacedFragment[]) => p.map((f) => `${f.key}:${f.range?.join('-') ?? ''}`).join('|');
  return a.every((page, i) => sig(page.main) === sig(b[i]!.main) && sig(page.sidebar) === sig(b[i]!.sidebar));
}

/**
 * Rendert ein Dokument als echte A4-Seiten mit intelligenten Seitenumbrüchen.
 * Wird identisch in der Live-Vorschau und bei der PDF-Erzeugung verwendet.
 */
export function PaginatedDocument(props: Props) {
  const { flow, layout, pageClassName, pageStyle, measureKey, onLayout } = props;
  const measureRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<PageLayout[] | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [fontTick, setFontTick] = useState(0);
  const hasSidebar = layout !== 'single';
  const styleKey = JSON.stringify(pageStyle);

  useLayoutEffect(() => {
    if (frozen || !measureRef.current) return;
    const result = computeLayout(measureRef.current, flow, hasSidebar);
    if (!result) return;
    setPages((prev) => (sameLayout(prev, result.pages) ? prev : result.pages));
    onLayout?.({ pageCount: result.pages.length, overflow: result.overflow });
    if (props.freezeAfterLayout) setFrozen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow, layout, styleKey, pageClassName, measureKey, fontTick, frozen]);

  // Nachladen von Schriften verändert Textbreiten → neu vermessen
  useLayoutEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return;
    const handler = () => setFontTick((t) => t + 1);
    document.fonts.addEventListener('loadingdone', handler);
    return () => document.fonts.removeEventListener('loadingdone', handler);
  }, []);

  const fragmentIndex = new Map<string, Fragment>();
  for (const item of [...flow.main, ...(flow.sidebar ?? [])]) for (const f of item.fragments) fragmentIndex.set(f.key, f);

  const effectivePages: PageLayout[] =
    pages ?? [{ main: flow.main.flatMap((i) => i.fragments.map((f) => ({ key: f.key }))), sidebar: (flow.sidebar ?? []).flatMap((i) => i.fragments.map((f) => ({ key: f.key }))) }];

  const renderPlaced = (placed: PlacedFragment[]) =>
    placed.map((p) => {
      const fragment = fragmentIndex.get(p.key);
      return fragment ? <FragmentView key={`${p.key}-${p.range?.join('-') ?? 'all'}`} fragment={fragment} range={p.range} /> : null;
    });

  const measure =
    !frozen &&
    typeof document !== 'undefined' &&
    createPortal(
      <div className="cv-measure" ref={measureRef} aria-hidden="true">
        <Page
          first
          measure="first"
          layout={layout}
          className={pageClassName}
          style={pageStyle}
          top={flow.top}
          main={renderColumn(flow.main)}
          sidebar={renderColumn(flow.sidebar ?? [])}
        />
        <Page first={false} measure="next" layout={layout} className={pageClassName} style={pageStyle} main={null} sidebar={null} />
      </div>,
      document.body,
    );

  const total = effectivePages.length;
  return (
    <>
      {measure}
      {effectivePages.map((page, index) => {
        const node = (
          <Page
            key={index}
            first={index === 0}
            layout={layout}
            className={pageClassName}
            style={pageStyle}
            top={flow.top}
            main={renderPlaced(page.main)}
            sidebar={renderPlaced(page.sidebar)}
            chrome={props.renderChrome?.(index, total)}
          />
        );
        return props.pageWrapper ? <div key={index}>{props.pageWrapper(node, index, total)}</div> : node;
      })}
    </>
  );
}
