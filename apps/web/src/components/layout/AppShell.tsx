import {
  FilePlus2,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Mail,
  Menu as MenuIcon,
  Settings,
  ShieldCheck,
  UserSquare2,
  X,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../../auth/AuthProvider';
import { useT, type MessageKey } from '../../i18n';
import { cn } from '../../lib/cn';
import { Logo } from './Logo';
import { LanguageToggle, ThemeToggle } from './Preferences';

interface NavItem {
  to: string;
  label: MessageKey;
  icon: ReactNode;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'nav.dashboard', icon: <LayoutDashboard />, end: true },
  { to: '/lebenslaeufe', label: 'nav.resumes', icon: <FileText />, end: true },
  { to: '/lebenslaeufe/neu', label: 'nav.newResume', icon: <FilePlus2 /> },
  { to: '/app/vorlagen', label: 'nav.templates', icon: <LayoutTemplate /> },
  { to: '/anschreiben', label: 'nav.coverLetters', icon: <Mail /> },
  { to: '/dokumente', label: 'nav.documents', icon: <FolderOpen /> },
  { to: '/profile', label: 'nav.profiles', icon: <UserSquare2 /> },
  { to: '/einstellungen', label: 'nav.settings', icon: <Settings /> },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const t = useT();
  const { user } = useAuth();
  const items: NavItem[] = user?.role === 'admin' ? [...NAV, { to: '/admin', label: 'nav.admin', icon: <ShieldCheck /> }] : NAV;
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Hauptnavigation">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              '[&>svg]:h-[18px] [&>svg]:w-[18px]',
              isActive && 'bg-accent text-accent-foreground hover:bg-accent',
            )
          }
        >
          {item.icon}
          {t(item.label)}
        </NavLink>
      ))}
    </nav>
  );
}

function UserBox() {
  const t = useT();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const initials = (user.displayName || user.email).slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{initials}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{user.displayName || t('nav.account')}</div>
        <div className="truncate text-xs text-muted-foreground">{user.email}</div>
      </div>
      <button
        className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={t('nav.logout')}
        title={t('nav.logout')}
        onClick={async () => {
          await logout();
          toast.success(t('auth.loggedOut'));
          navigate('/anmelden');
        }}
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Layout des angemeldeten Bereichs: Seitennavigation (Desktop) bzw. Drawer (Mobil). */
export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2">
        {t('common.skipToContent')}
      </a>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-card/60 px-3 py-4 lg:flex">
        <div className="px-2 pb-5">
          <Logo to="/dashboard" />
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavList />
        </div>
        <div className="mt-3 flex items-center gap-1 px-1 pb-2">
          <ThemeToggle />
          <LanguageToggle />
        </div>
        <UserBox />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:hidden">
          <Logo to="/dashboard" />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button className="rounded-lg p-2 hover:bg-muted" onClick={() => setOpen(true)} aria-label={t('common.menu')} aria-expanded={open}>
              <MenuIcon className="h-5 w-5" />
            </button>
          </div>
        </header>
        {open ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-card px-3 py-4 shadow-2xl animate-slide-up">
              <div className="flex items-center justify-between px-2 pb-4">
                <Logo to="/dashboard" />
                <button className="rounded-lg p-2 hover:bg-muted" onClick={() => setOpen(false)} aria-label={t('common.close')}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <NavList onNavigate={() => setOpen(false)} />
              </div>
              <div className="mb-2 flex items-center gap-1 px-1">
                <LanguageToggle />
              </div>
              <UserBox />
            </div>
          </div>
        ) : null}
        <main id="main" className={cn('mx-auto w-full flex-1 px-4 py-6 sm:px-6 lg:py-8', wide ? 'max-w-7xl' : 'max-w-6xl')}>
          {children}
        </main>
        <footer className="border-t px-4 py-4 text-xs text-muted-foreground sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-wrap gap-4">
            <Link to="/datenschutz" className="hover:text-foreground">
              {t('nav.privacy')}
            </Link>
            <Link to="/impressum" className="hover:text-foreground">
              {t('nav.imprint')}
            </Link>
            <Link to="/nutzungsbedingungen" className="hover:text-foreground">
              {t('nav.terms')}
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
