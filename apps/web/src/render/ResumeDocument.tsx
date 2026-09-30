import type { ResumeRenderData } from '@cv-studio/shared';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { designStyle, pageClasses } from './designVars';
import { loadFonts } from './fonts';
import { PaginatedDocument, type LayoutInfo } from './PaginatedDocument';
import { buildResumeFlow, PageFooter } from './resume/buildFlow';
import { getTemplateRender } from './templateConfig';
import './styles/document.css';

interface Props {
  data: ResumeRenderData;
  onLayout?: (info: LayoutInfo) => void;
  freezeAfterLayout?: boolean;
  /** Externer Auslöser für eine Neuvermessung */
  layoutKey?: number;
  pageWrapper?: (page: ReactNode, index: number, total: number) => ReactNode;
}

/** Lebenslauf als paginiertes A4-Dokument – identisch in Vorschau und PDF. */
export function ResumeDocument({ data, onLayout, freezeAfterLayout, pageWrapper, layoutKey = 0 }: Props) {
  const [fontsReady, setFontsReady] = useState(0);
  const { fontFamily, headingFontFamily } = data.design;

  useEffect(() => {
    let active = true;
    loadFonts([fontFamily, headingFontFamily]).then(() => active && setFontsReady((n) => n + 1));
    return () => {
      active = false;
    };
  }, [fontFamily, headingFontFamily]);

  const flow = useMemo(() => buildResumeFlow(data), [data]);
  const tpl = getTemplateRender(data.templateKey);
  const style = useMemo(() => designStyle(data.design, data.dateFormat), [data.design, data.dateFormat]);

  return (
    <PaginatedDocument
      flow={flow}
      layout={tpl.layout}
      pageClassName={pageClasses(data.templateKey, data.design, tpl.timeline ? 'has-timeline' : undefined)}
      pageStyle={style}
      measureKey={`${fontsReady}:${layoutKey}`}
      onLayout={onLayout}
      freezeAfterLayout={freezeAfterLayout}
      pageWrapper={pageWrapper}
      renderChrome={(index, total) => <PageFooter data={data} index={index} total={total} />}
    />
  );
}
