import { createDemoContent, TEMPLATES, type Locale, type TemplateKey } from '@cv-studio/shared';
import { useMemo } from 'react';
import { ResumeDocument } from '../../render/ResumeDocument';
import { ScaledPage } from './ScaledPage';

/** Erste Seite einer Vorlage mit fiktiven Demo-Daten. */
export function TemplateThumbnail({ templateKey, locale = 'de', className }: { templateKey: TemplateKey; locale?: Locale; className?: string }) {
  const data = useMemo(
    () => ({
      content: createDemoContent(locale),
      design: TEMPLATES[templateKey].defaultDesign,
      templateKey,
      language: locale,
      dateFormat: 'MM/YYYY' as const,
      photoUrl: null,
    }),
    [templateKey, locale],
  );
  return (
    <ScaledPage className={className}>
      <ResumeDocument data={data} pageWrapper={(page, index) => (index === 0 ? page : null)} />
    </ScaledPage>
  );
}
