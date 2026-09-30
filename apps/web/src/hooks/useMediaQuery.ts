import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = () => setMatches(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

/** Editor-Layout: Desktop (3 Spalten), Tablet (2 Spalten), Smartphone (untereinander mit Tabs). */
export function useEditorLayout(): 'desktop' | 'tablet' | 'mobile' {
  const desktop = useMediaQuery('(min-width: 1280px)');
  const tablet = useMediaQuery('(min-width: 768px)');
  return desktop ? 'desktop' : tablet ? 'tablet' : 'mobile';
}
