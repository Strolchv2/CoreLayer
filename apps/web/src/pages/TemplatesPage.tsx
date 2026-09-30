import { TEMPLATE_LIST, type TemplateDTO, type TemplateKey } from '@cv-studio/shared';
import { useQuery } from '@tanstack/react-query';
import { Columns2, ScanSearch, Square } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { TemplateThumbnail } from '../components/cv/TemplateThumbnail';
import { AppShell } from '../components/layout/AppShell';
import { PublicLayout } from '../components/layout/PublicLayout';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Badge, PageHeader } from '../components/ui/misc';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { ResumeDocument } from '../render/ResumeDocument';
import { createDemoContent, TEMPLATES } from '@cv-studio/shared';

export function useActiveTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get<{ templates: TemplateDTO[] }>('/api/templates').then((r) => r.templates),
    staleTime: 5 * 60 * 1000,
  });
}

function Gallery() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: active } = useActiveTemplates();
  const [preview, setPreview] = useState<TemplateKey | null>(null);
  const activeKeys = active ? new Set(active.map((a) => a.key)) : null;
  const templates = TEMPLATE_LIST.filter((tpl) => !activeKeys || activeKeys.has(tpl.key));

  const start = (key: TemplateKey) => navigate(user ? `/lebenslaeufe/neu?vorlage=${key}` : `/registrieren`);

  return (
    <>
      <PageHeader title={t('templates.title')} description={t('templates.subtitle')} />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((tpl) => (
          <article key={tpl.key} className="group flex flex-col overflow-hidden rounded-2xl border bg-card">
            <button className="relative block bg-preview p-4" onClick={() => setPreview(tpl.key)} aria-label={`${t('templates.preview')}: ${tpl.name[locale]}`}>
              <div className="overflow-hidden rounded shadow-md transition-transform duration-200 group-hover:scale-[1.015]">
                <TemplateThumbnail templateKey={tpl.key} locale={locale} />
              </div>
            </button>
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">{tpl.name[locale]}</h2>
                <div className="flex gap-1.5">
                  {tpl.atsFriendly ? (
                    <Badge tone="success">
                      <ScanSearch className="h-3 w-3" /> {t('templates.atsFriendly')}
                    </Badge>
                  ) : null}
                  <Badge>
                    {tpl.layout === 'single' ? <Square className="h-3 w-3" /> : <Columns2 className="h-3 w-3" />}
                    {tpl.layout === 'single' ? t('templates.singleColumn') : t('templates.twoColumn')}
                  </Badge>
                </div>
              </div>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{tpl.description[locale]}</p>
              <Button className="mt-4" variant="outline" onClick={() => start(tpl.key)}>
                {t('templates.use')}
              </Button>
            </div>
          </article>
        ))}
      </div>
      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)} title={preview ? TEMPLATES[preview].name[locale] : ''} size="xl"
        footer={preview ? <Button onClick={() => start(preview)}>{t('templates.use')}</Button> : null}>
        {preview ? (
          <div className="flex flex-col items-center gap-4 bg-preview p-4">
            <div className="w-full max-w-[794px] origin-top overflow-x-auto">
              <ResumeDocument
                data={{ content: createDemoContent(locale), design: TEMPLATES[preview].defaultDesign, templateKey: preview, language: locale, dateFormat: 'MM/YYYY', photoUrl: null }}
                pageWrapper={(page) => <div className="preview-page mx-auto mb-4 w-fit">{page}</div>}
              />
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}

/** Öffentliche Vorlagen-Galerie */
export default function TemplatesPage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <Gallery />
      </div>
    </PublicLayout>
  );
}

/** Vorlagen innerhalb des angemeldeten Bereichs */
export function AppTemplatesPage() {
  return (
    <AppShell>
      <Gallery />
    </AppShell>
  );
}

export { Link };
