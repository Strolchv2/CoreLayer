import { Maximize2, Minus, Plus } from 'lucide-react';
import { useDeferredValue, useEffect, useRef, useState, type ReactNode } from 'react';
import { A4_HEIGHT_PX, A4_WIDTH_PX } from '../../components/cv/ScaledPage';
import { IconButton } from '../../components/ui/IconButton';
import { useT } from '../../i18n';
import type { LayoutInfo } from '../../render/PaginatedDocument';

const ZOOM_STEPS = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.5];

/**
 * Live-Vorschau: echte A4-Seiten, skaliert auf die verfügbare Breite, mit Zoom.
 * `render` erhält den Seiten-Wrapper, der jede Seite skaliert.
 */
export function PreviewPanel<T>({
  data,
  render,
  toolbar,
}: {
  data: T;
  render: (data: T, wrap: (page: ReactNode, index: number) => ReactNode, onLayout: (info: LayoutInfo) => void) => ReactNode;
  toolbar?: ReactNode;
}) {
  const t = useT();
  const deferred = useDeferredValue(data);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [info, setInfo] = useState<LayoutInfo>({ pageCount: 1, overflow: false });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fitScale = width > 0 ? Math.min((width - 32) / A4_WIDTH_PX, 1.25) : 0.6;
  const scale = zoom === 'fit' ? fitScale : zoom;
  const stepZoom = (dir: 1 | -1) => {
    const current = scale;
    const next = dir > 0 ? ZOOM_STEPS.find((z) => z > current + 0.01) : [...ZOOM_STEPS].reverse().find((z) => z < current - 0.01);
    if (next) setZoom(next);
  };

  const wrap = (page: ReactNode, index: number) => (
    <div className="preview-page mx-auto bg-white" style={{ width: A4_WIDTH_PX * scale, height: A4_HEIGHT_PX * scale }} data-page={index + 1}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: A4_WIDTH_PX }}>{page}</div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b bg-card/70 px-3 py-1.5 backdrop-blur">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>{t('editor.pageCount', { count: info.pageCount })}</span>
        </div>
        <div className="flex items-center gap-0.5">
          {toolbar}
          <IconButton label={t('editor.zoomOut')} size="sm" onClick={() => stepZoom(-1)}>
            <Minus />
          </IconButton>
          <span className="w-11 text-center text-xs tabular-nums text-muted-foreground">{Math.round(scale * 100)}%</span>
          <IconButton label={t('editor.zoomIn')} size="sm" onClick={() => stepZoom(1)}>
            <Plus />
          </IconButton>
          <IconButton label={t('editor.zoomFit')} size="sm" active={zoom === 'fit'} onClick={() => setZoom('fit')}>
            <Maximize2 />
          </IconButton>
        </div>
      </div>
      {info.overflow ? <div className="border-b bg-warning/10 px-3 py-1.5 text-xs text-warning">{t('editor.overflow')}</div> : null}
      <div ref={containerRef} className="scrollbar-thin min-h-0 flex-1 overflow-auto bg-preview px-4 py-6" data-testid="preview">
        <div className="flex flex-col items-center gap-6">
          {render(deferred, wrap, (i) => setInfo((p) => (p.pageCount === i.pageCount && p.overflow === i.overflow ? p : i)))}
        </div>
      </div>
    </div>
  );
}
