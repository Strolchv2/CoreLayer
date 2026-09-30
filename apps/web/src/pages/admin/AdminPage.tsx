import { NavLink, Route, Routes } from 'react-router';
import { ShieldCheck } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/ui/misc';
import { useT, type MessageKey } from '../../i18n';
import { cn } from '../../lib/cn';
import { AdminBackups } from './AdminBackups';
import { AdminLogs } from './AdminLogs';
import { AdminOverview } from './AdminOverview';
import { AdminTemplates } from './AdminTemplates';
import { AdminUsers } from './AdminUsers';

const TABS: { to: string; label: MessageKey; end?: boolean }[] = [
  { to: '/admin', label: 'admin.overview', end: true },
  { to: '/admin/benutzer', label: 'admin.users' },
  { to: '/admin/vorlagen', label: 'admin.templates' },
  { to: '/admin/protokoll', label: 'admin.logs' },
  { to: '/admin/backups', label: 'admin.backups' },
];

export default function AdminPage() {
  const t = useT();
  return (
    <AppShell wide>
      <PageHeader title={t('admin.title')} />
      <p className="-mt-3 mb-5 flex items-start gap-2 rounded-xl border bg-accent/40 px-3 py-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {t('admin.privacyNote')}
      </p>
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b" aria-label={t('admin.title')}>
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => cn('whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors', isActive ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}
          >
            {t(tab.label)}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<AdminOverview />} />
        <Route path="benutzer" element={<AdminUsers />} />
        <Route path="vorlagen" element={<AdminTemplates />} />
        <Route path="protokoll" element={<AdminLogs />} />
        <Route path="backups" element={<AdminBackups />} />
      </Routes>
    </AppShell>
  );
}
