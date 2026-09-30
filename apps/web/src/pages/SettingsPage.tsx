import { DATE_FORMATS, type DateFormat, type Locale, type ThemePreference, type UserDTO } from '@cv-studio/shared';
import { Download, KeyRound, LogOut, ShieldAlert, Trash2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthProvider';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { FormField } from '../components/ui/FormField';
import { Input, Select } from '../components/ui/Input';
import { Card, PageHeader } from '../components/ui/misc';
import { PasswordInput } from '../components/ui/PasswordInput';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../i18n';
import { api, saveBlob } from '../lib/api';
import { errorMessage, fieldErrors } from '../lib/errors';
import { validatePassword } from './auth/RegisterPage';

function Section({ title, description, children, danger }: { title: string; description?: string; children: ReactNode; danger?: boolean }) {
  return (
    <Card className={danger ? 'border-destructive/40' : undefined}>
      <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <div>
          <h2 className={danger ? 'font-semibold text-destructive' : 'font-semibold'}>{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <div className="space-y-4">{children}</div>
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const { t, setLocale } = useI18n();
  const { user, setUser, logout } = useAuth();
  const { setPreference } = useTheme();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  useEffect(() => setDisplayName(user?.displayName ?? ''), [user?.displayName]);
  if (!user) return null;

  const patch = async (body: Partial<Pick<UserDTO, 'displayName' | 'locale' | 'theme' | 'defaultDateFormat'>>, silent = false) => {
    try {
      const res = await api.patch<{ user: UserDTO }>('/api/account/settings', body);
      setUser(res.user);
      if (!silent) toast.success(t('settings.saved'));
    } catch (err) {
      toast.error(errorMessage(err, t));
    }
  };

  const changePassword = async () => {
    const e: Record<string, string> = {};
    const v = validatePassword(pw.next);
    if (v) e.newPassword = t(`validation.${v}`);
    if (!pw.current) e.currentPassword = t('validation.required');
    setPwErrors(e);
    if (Object.keys(e).length) return;
    setBusy('pw');
    try {
      await api.post('/api/auth/change-password', { currentPassword: pw.current, newPassword: pw.next });
      setPw({ current: '', next: '' });
      toast.success(t('settings.passwordChanged'));
    } catch (err) {
      setPwErrors(fieldErrors(err, t));
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(null);
    }
  };

  const exportData = async () => {
    setBusy('export');
    try {
      const { blob, fileName } = await api.download('GET', '/api/account/export');
      saveBlob(blob, fileName);
      toast.success(t('settings.exportStarted'));
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(null);
    }
  };

  const deleteAccount = async () => {
    setBusy('delete');
    try {
      await api.delete('/api/account', { password: deletePassword });
      await logout().catch(() => undefined);
      toast.success(t('settings.deleted'));
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppShell>
      <PageHeader title={t('settings.title')} />
      <div className="space-y-6">
        <Section title={t('settings.account')}>
          <FormField label={t('settings.email')}>
            <Input value={user.email} disabled readOnly />
          </FormField>
          <FormField label={t('settings.displayName')}>
            <div className="flex gap-2">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={100} />
              <Button variant="outline" onClick={() => patch({ displayName: displayName.trim() })} disabled={displayName.trim() === user.displayName}>
                {t('common.save')}
              </Button>
            </div>
          </FormField>
        </Section>

        <Section title={t('settings.preferences')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('settings.uiLanguage')}>
              <Select
                value={user.locale}
                onChange={(e) => {
                  const l = e.target.value as Locale;
                  setLocale(l);
                  void patch({ locale: l });
                }}
              >
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </Select>
            </FormField>
            <FormField label={t('settings.theme')}>
              <Select
                value={user.theme}
                onChange={(e) => {
                  const th = e.target.value as ThemePreference;
                  setPreference(th);
                  void patch({ theme: th });
                }}
              >
                <option value="system">{t('common.theme.system')}</option>
                <option value="light">{t('common.theme.light')}</option>
                <option value="dark">{t('common.theme.dark')}</option>
              </Select>
            </FormField>
          </div>
          <FormField label={t('settings.defaultDateFormat')}>
            <Select value={user.defaultDateFormat} onChange={(e) => void patch({ defaultDateFormat: e.target.value as DateFormat })}>
              {DATE_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f === 'DD.MM.YYYY' ? 'TT.MM.JJJJ' : f.replace('YYYY', 'JJJJ')}
                </option>
              ))}
            </Select>
          </FormField>
        </Section>

        <Section title={t('settings.security')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('settings.currentPassword')} error={pwErrors.currentPassword}>
              <PasswordInput autoComplete="current-password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} />
            </FormField>
            <FormField label={t('settings.newPassword')} error={pwErrors.newPassword} hint={t('auth.passwordHint')}>
              <PasswordInput autoComplete="new-password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} />
            </FormField>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={<KeyRound className="h-4 w-4" />} onClick={changePassword} loading={busy === 'pw'}>
              {t('settings.changePassword')}
            </Button>
            <Button
              variant="ghost"
              icon={<LogOut className="h-4 w-4" />}
              onClick={async () => {
                await api.post('/api/auth/logout-all').then(() => toast.success(t('settings.logoutAllDone'))).catch((err) => toast.error(errorMessage(err, t)));
              }}
            >
              {t('settings.logoutAll')}
            </Button>
          </div>
        </Section>

        <Section title={t('settings.privacy')} description={t('settings.exportDataText')}>
          <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={exportData} loading={busy === 'export'} className="self-start">
            {t('settings.exportData')}
          </Button>
        </Section>

        <Section title={t('settings.deleteAccount')} description={t('settings.deleteAccountText')} danger>
          <Button variant="destructive" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteOpen(true)} className="self-start">
            {t('settings.deleteAccount')}
          </Button>
        </Section>
      </div>

      <Dialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('settings.deleteAccount')}
        description={t('settings.deleteAccountText')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={deleteAccount} loading={busy === 'delete'} disabled={!deletePassword}>
              {t('settings.deleteFinal')}
            </Button>
          </>
        }
      >
        <div className="flex gap-3 rounded-lg bg-destructive/8 p-3 text-sm text-destructive">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          {t('settings.deleteAccountText')}
        </div>
        <div className="mt-4">
          <FormField label={t('settings.deleteConfirmLabel')} required>
            <PasswordInput autoComplete="current-password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
          </FormField>
        </div>
      </Dialog>
    </AppShell>
  );
}
