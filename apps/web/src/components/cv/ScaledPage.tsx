import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

/** Breite einer A4-Seite in CSS-Pixeln (210 mm bei 96 dpi). */
export const A4_WIDTH_PX = 793.7;
export const A4_HEIGHT_PX = 1122.5;

/**
 * Skaliert eine A4-Seite auf die verfügbare Breite (für Miniaturen/Karten).
 * Die Seite wird nur gerendert, wenn sie sichtbar ist (Lazy Rendering).
 */
export function ScaledPage({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    ro.observe(el);
    const io = new IntersectionObserver(([entry]) => entry?.isIntersecting && setVisible(true), { rootMargin: '300px' });
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  const scale = width / A4_WIDTH_PX;
  return (
    <div ref={ref} className={cn('relative w-full overflow-hidden bg-white', className)} style={{ aspectRatio: '210 / 297' }}>
      {visible && width > 0 ? (
        <div className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${scale})`, width: A4_WIDTH_PX }} aria-hidden="true">
          {children}
        </div>
      ) : null}
    </div>
  );
}
