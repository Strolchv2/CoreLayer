/**
 * Einstiegspunkt des Render-Bundles (render.html) für die serverseitige PDF-Erzeugung.
 * Der Server übergibt die Daten über window.__CV_PAYLOAD__ und wartet auf window.__CV_READY__.
 */
import type { LayoutInfo } from './PaginatedDocument';
import type { RenderRequest } from '@cv-studio/shared';
import { StrictMode, useCallback, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CoverLetterDocument } from './CoverLetterDocument';
import { loadFonts } from './fonts';
import { ResumeDocument } from './ResumeDocument';
import './styles/render.css';

declare global {
  interface Window {
    __CV_PAYLOAD__?: RenderRequest;
    __CV_READY__?: boolean;
    __CV_ERROR__?: string;
    __CV_PAGES__?: number;
  }
}

async function waitForImages(): Promise<void> {
  const images = Array.from(document.images);
  await Promise.all(images.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))));
}

function RenderApp({ request }: { request: RenderRequest }) {
  const [pass, setPass] = useState(0);
  const passRef = useRef(0);

  // Pass 0: erste Berechnung → warten auf Schriften/Bilder → Pass 1: finale Berechnung, einfrieren → fertig
  const onLayout = useCallback((info: LayoutInfo) => {
    if (passRef.current === 0) {
      passRef.current = 1;
      Promise.all([document.fonts.ready, waitForImages()]).then(() => setPass(1));
    } else if (passRef.current === 1) {
      passRef.current = 2;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          window.__CV_PAGES__ = info.pageCount;
          window.__CV_READY__ = true;
        }),
      );
    }
  }, []);

  if (request.kind === 'resume') {
    return <ResumeDocument data={request.data} onLayout={onLayout} layoutKey={pass} freezeAfterLayout={pass === 1} />;
  }
  return <CoverLetterDocument data={request.data} onLayout={onLayout} layoutKey={pass} freezeAfterLayout={pass === 1} />;
}

async function main(): Promise<void> {
  const request = window.__CV_PAYLOAD__;
  if (!request) {
    window.__CV_ERROR__ = 'missing payload';
    return;
  }
  document.title = request.title;
  document.documentElement.lang = request.data.language === 'en' ? 'en' : 'de';
  await loadFonts([request.data.design.fontFamily, request.data.design.headingFontFamily]);
  const root = document.getElementById('render-root');
  if (!root) throw new Error('render root missing');
  createRoot(root).render(
    <StrictMode>
      <RenderApp request={request} />
    </StrictMode>,
  );
}

main().catch((err: unknown) => {
  window.__CV_ERROR__ = err instanceof Error ? err.message : String(err);
});
