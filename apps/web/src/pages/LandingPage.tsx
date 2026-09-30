import { TEMPLATE_LIST } from '@cv-studio/shared';
import { ArrowRight, Eye, FileDown, Files, LayoutTemplate, ScanSearch, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { TemplateThumbnail } from '../components/cv/TemplateThumbnail';
import { PublicLayout } from '../components/layout/PublicLayout';
import { Button } from '../components/ui/Button';
import { useI18n, type MessageKey } from '../i18n';

const FEATURES: { icon: typeof Eye; title: MessageKey; text: MessageKey }[] = [
  { icon: LayoutTemplate, title: 'landing.feature.templates.title', text: 'landing.feature.templates.text' },
  { icon: Eye, title: 'landing.feature.preview.title', text: 'landing.feature.preview.text' },
  { icon: FileDown, title: 'landing.feature.pdf.title', text: 'landing.feature.pdf.text' },
  { icon: ScanSearch, title: 'landing.feature.ats.title', text: 'landing.feature.ats.text' },
  { icon: Files, title: 'landing.feature.multi.title', text: 'landing.feature.multi.text' },
  { icon: ShieldCheck, title: 'landing.feature.privacy.title', text: 'landing.feature.privacy.text' },
];

export default function LandingPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const ctaTarget = user ? '/lebenslaeufe/neu' : '/registrieren';
  return (
    <PublicLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,color-mix(in_srgb,var(--primary)_14%,transparent),transparent_60%)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div>
            <span className="inline-flex items-center rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">{t('landing.hero.badge')}</span>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">{t('landing.hero.title')}</h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">{t('landing.hero.subtitle')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={ctaTarget}>
                <Button size="lg">
                  {t('landing.hero.cta')} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/vorlagen">
                <Button size="lg" variant="outline">
                  {t('landing.hero.secondary')}
                </Button>
              </Link>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">{t('landing.hero.note')}</p>
          </div>
          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -left-6 top-10 hidden w-[62%] -rotate-6 overflow-hidden rounded-lg opacity-80 shadow-[var(--shadow-page)] sm:block">
              <TemplateThumbnail templateKey="classic" locale={locale} />
            </div>
            <div className="relative ml-auto w-[82%] rotate-2 overflow-hidden rounded-lg shadow-[var(--shadow-page)]">
              <TemplateThumbnail templateKey="modern" locale={locale} />
            </div>
          </div>
        </div>
      </section>

      <section className="border-y bg-card/50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight">{t('landing.features.title')}</h2>
            <p className="mt-3 text-muted-foreground">{t('landing.features.subtitle')}</p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border bg-card p-6 transition-shadow hover:shadow-[var(--shadow-soft)]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{t(title)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t(text)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight">{t('landing.steps.title')}</h2>
        <ol className="mt-8 grid gap-5 md:grid-cols-3">
          {([1, 2, 3] as const).map((n) => (
            <li key={n} className="rounded-2xl border p-6">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{n}</span>
              <h3 className="mt-4 font-semibold">{t(`landing.steps.${n}.title`)}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{t(`landing.steps.${n}.text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t bg-card/50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-3xl font-semibold tracking-tight">{t('landing.templates.title')}</h2>
            <Link to="/vorlagen" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              {t('landing.templates.all')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-4">
            {TEMPLATE_LIST.slice(0, 4).map((tpl) => (
              <Link key={tpl.key} to="/vorlagen" className="group">
                <div className="overflow-hidden rounded-xl border shadow-sm transition-transform group-hover:-translate-y-1">
                  <TemplateThumbnail templateKey={tpl.key} locale={locale} />
                </div>
                <div className="mt-2 text-sm font-medium">{tpl.name[locale]}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="rounded-3xl bg-[linear-gradient(135deg,#15324f,#1f4e79_60%,#2f6ea6)] px-8 py-12 text-center text-white">
          <h2 className="text-3xl font-semibold tracking-tight">{t('landing.cta.title')}</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/75">{t('landing.cta.text')}</p>
          <Link to={ctaTarget} className="mt-7 inline-block">
            <Button size="lg" className="bg-white text-[#1f4e79] hover:bg-white/90">
              {t('landing.hero.cta')} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
