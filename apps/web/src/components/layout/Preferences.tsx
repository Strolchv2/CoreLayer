import type { Locale, ThemePreference } from '@cv-studio/shared';
import { Languages, Monitor, Moon, Sun } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../i18n';
import { api } from '../../lib/api';
import { IconButton } from '../ui/IconButton';
import { Menu } from '../ui/Menu';

/** Schnellwahl für Farbschema und Oberflächensprache. */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const { t } = useI18n();
  const { user, setUser } = useAuth();
  const choose = (p: ThemePreference) => {
    setPreference(p);
    if (user) api.patch<{ user: typeof user }>('/api/account/settings', { theme: p }).then((r) => setUser(r.user)).catch(() => undefined);
  };
  const icon = preference === 'dark' ? <Moon /> : preference === 'light' ? <Sun /> : <Monitor />;
  return (
    <Menu
      trigger={
        <IconButton label={t('common.theme.toggle')} tooltip={false}>
          {icon}
        </IconButton>
      }
      items={[
        { label: t('common.theme.light'), icon: <Sun />, onSelect: () => choose('light') },
        { label: t('common.theme.dark'), icon: <Moon />, onSelect: () => choose('dark') },
        { label: t('common.theme.system'), icon: <Monitor />, onSelect: () => choose('system') },
      ]}
    />
  );
}

export function LanguageToggle() {
  const { t, setLocale, locale } = useI18n();
  const { user, setUser } = useAuth();
  const choose = (l: Locale) => {
    setLocale(l);
    if (user) api.patch<{ user: typeof user }>('/api/account/settings', { locale: l }).then((r) => setUser(r.user)).catch(() => undefined);
  };
  return (
    <Menu
      trigger={
        <IconButton label={`${t('common.language')}: ${locale.toUpperCase()}`} tooltip={false}>
          <Languages />
        </IconButton>
      }
      items={[
        { label: 'Deutsch', onSelect: () => choose('de'), icon: locale === 'de' ? <span>✓</span> : undefined },
        { label: 'English', onSelect: () => choose('en'), icon: locale === 'en' ? <span>✓</span> : undefined },
      ]}
    />
  );
}
