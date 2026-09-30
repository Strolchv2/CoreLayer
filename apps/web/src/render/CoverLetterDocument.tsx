import type { CoverLetterRenderData } from '@cv-studio/shared';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { designStyle, pageClasses } from './designVars';
import { loadFonts } from './fonts';
import { buildLetterFlow } from './letter/buildLetterFlow';
import { PaginatedDocument, type LayoutInfo } from './PaginatedDocument';
import './styles/document.css';

interface Props {
  data: CoverLetterRenderData;
  photoUrl?: string | null;
  onLayout?: (info: LayoutInfo) => void;
  freezeAfterLayout?: boolean;
  /** Externer Auslöser für eine Neuvermessung */
  layoutKey?: number;
  pageWrapper?: (page: ReactNode, index: number, total: number) => ReactNode;
}

/** Anschreiben im Design des Lebenslaufs (immer einspaltig, Briefkopf wie die Vorlage). */
export function CoverLetterDocument({ data, photoUrl = null, onLayout, freezeAfterLayout, pageWrapper, layoutKey = 0 }: Props) {
  const [fontsReady, setFontsReady] = useState(0);
  const { fontFamily, headingFontFamily } = data.design;
  useEffect(() => {
    let active = true;
    loadFonts([fontFamily, headingFontFamily]).then(() => active && setFontsReady((n) => n + 1));
    return () => {
      active = false;
    };
  }, [fontFamily, headingFontFamily]);

  const flow = useMemo(() => buildLetterFlow(data, photoUrl), [data, photoUrl]);
  const style = useMemo(() => designStyle(data.design, data.dateFormat), [data.design, data.dateFormat]);
  // Seitenspalten-Vorlagen erhalten im Brief einen farbigen Kopf statt der Spalte
  const design = data.design;
  return (
    <PaginatedDocument
      flow={flow}
      layout="single"
      pageClassName={pageClasses(data.templateKey, design, 'cv-letter')}
      pageStyle={style}
      measureKey={`${fontsReady}:${layoutKey}`}
      onLayout={onLayout}
      freezeAfterLayout={freezeAfterLayout}
      pageWrapper={pageWrapper}
    />
  );
}
