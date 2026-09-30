import { Menu as MenuIcon, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { useAuth } from '../../auth/AuthProvider';
import { useT } from '../../i18n';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';
import { Logo } from './Logo';
import { LanguageToggle, ThemeToggle } from './Preferences';

export function PublicLayout({ children }: { children: ReactNode }) {
  const t = useT();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2">
        {t('common.skipToContent')}
      </a>
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Hauptnavigation">
            <NavLink to="/vorlagen" className={({ isActive }) => cn('rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted', isActive && 'text-primary')}>
              {t('nav.templates')}
            </NavLink>
            <ThemeToggle />
            <LanguageToggle />
            {user ? (
              <Link to="/dashboard">
                <Button>{t('nav.dashboard')}</Button>
              </Link>
            ) : (
              <>
                <Link to="/anmelden" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted">
                  {t('nav.login')}
                </Link>
                <Link to="/registrieren">
                  <Button>{t('nav.register')}</Button>
                </Link>
              </>
            )}
          </nav>
          <div className="flex items-center gap-1 md:hidden">
            <ThemeToggle />
            <button className="rounded-lg p-2 hover:bg-muted" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={t('common.menu')}>
              {open ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open ? (
          <nav className="border-t px-4 py-3 md:hidden" aria-label="Mobile Navigation">
            <div className="flex flex-col gap-1" onClick={() => setOpen(false)}>
              <Link to="/vorlagen" className="rounded-lg px-3 py-2 hover:bg-muted">
                {t('nav.templates')}
              </Link>
              {user ? (
                <Link to="/dashboard" className="rounded-lg px-3 py-2 hover:bg-muted">
                  {t('nav.dashboard')}
                </Link>
              ) : (
                <>
                  <Link to="/anmelden" className="rounded-lg px-3 py-2 hover:bg-muted">
                    {t('nav.login')}
                  </Link>
                  <Link to="/registrieren" className="rounded-lg px-3 py-2 font-medium text-primary hover:bg-muted">
                    {t('nav.register')}
                  </Link>
                </>
              )}
            </div>
            <div className="mt-2 border-t pt-2">
              <LanguageToggle />
            </div>
          </nav>
        ) : null}
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

export function SiteFooter() {
  const t = useT();
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <span>© {new Date().getFullYear()} CV Studio</span>
        <nav className="flex flex-wrap items-center gap-4" aria-label="Rechtliches">
          <Link to="/datenschutz" className="hover:text-foreground">
            {t('nav.privacy')}
          </Link>
          <Link to="/impressum" className="hover:text-foreground">
            {t('nav.imprint')}
          </Link>
          <Link to="/nutzungsbedingungen" className="hover:text-foreground">
            {t('nav.terms')}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
