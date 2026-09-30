import { CheckCircle2, Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { Logo } from '../../components/layout/Logo';
import { LanguageToggle, ThemeToggle } from '../../components/layout/Preferences';
import { useT } from '../../i18n';

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  const t = useT();
  const points = ['landing.feature.templates.title', 'landing.feature.preview.title', 'landing.feature.pdf.title', 'landing.feature.ats.title'] as const;
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <LanguageToggle />
          </div>
        </div>
        <main id="main" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p> : null}
          <div className="mt-7">{children}</div>
          {footer ? <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
        </main>
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> {t('auth.secureNote')}
        </p>
      </div>
      <div className="relative hidden overflow-hidden bg-[linear-gradient(145deg,#15324f,#1f4e79_55%,#2f6ea6)] lg:block">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-16 h-[28rem] w-[28rem] rounded-full bg-white/5" />
        <div className="relative flex h-full flex-col justify-center px-14 text-white">
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">{t('landing.hero.title')}</h2>
          <p className="mt-3 max-w-md text-white/75">{t('landing.hero.subtitle')}</p>
          <ul className="mt-8 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-3 text-white/90">
                <CheckCircle2 className="h-5 w-5 text-sky-300" />
                {t(p)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
