import { EMAIL_PATTERN, PASSWORD_MIN_LENGTH, type UserDTO } from '@cv-studio/shared';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';
import { Checkbox, Input } from '../../components/ui/Input';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { useI18n } from '../../i18n';
import { api } from '../../lib/api';
import { errorMessage, fieldErrors } from '../../lib/errors';
import { AuthLayout } from './AuthLayout';

export function validatePassword(password: string): 'password_too_short' | 'password_too_weak' | null {
  if (password.length < PASSWORD_MIN_LENGTH) return 'password_too_short';
  if (!/[A-Za-zÄÖÜäöüß]/.test(password) || !/[^A-Za-zÄÖÜäöüß]/.test(password)) return 'password_too_weak';
  return null;
}

export default function RegisterPage() {
  const { t, locale } = useI18n();
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ displayName: '', email: '', password: '', password2: '', accept: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form) => (value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!EMAIL_PATTERN.test(form.email.trim())) e.email = t('validation.invalid_email');
    const pw = validatePassword(form.password);
    if (pw) e.password = t(`validation.${pw}`);
    if (form.password !== form.password2) e.password2 = t('validation.passwords_mismatch');
    if (!form.accept) e.accept = t('validation.terms_required');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await api.post<{ user: UserDTO }>('/api/auth/register', {
        email: form.email,
        password: form.password,
        displayName: form.displayName,
        locale,
        acceptTerms: form.accept,
      });
      setUser(res.user);
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err, t));
      setError(errorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  const [before, afterTerms] = t('auth.register.acceptTerms').split('{terms}');
  const [middle, after] = (afterTerms ?? '').split('{privacy}');

  return (
    <AuthLayout
      title={t('auth.register.title')}
      subtitle={t('auth.register.subtitle')}
      footer={
        <>
          {t('auth.register.hasAccount')}{' '}
          <Link to="/anmelden" className="font-medium text-primary hover:underline">
            {t('nav.login')}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm text-destructive" role="alert">
            {error}
          </div>
        ) : null}
        <FormField label={t('auth.displayName')} hint={t('auth.displayNameHint')}>
          <Input autoComplete="name" value={form.displayName} onChange={(e) => set('displayName')(e.target.value)} maxLength={100} />
        </FormField>
        <FormField label={t('auth.email')} required error={errors.email}>
          <Input type="email" autoComplete="email" value={form.email} onChange={(e) => set('email')(e.target.value)} />
        </FormField>
        <FormField label={t('auth.password')} required error={errors.password} hint={t('auth.passwordHint')}>
          <PasswordInput autoComplete="new-password" value={form.password} onChange={(e) => set('password')(e.target.value)} />
        </FormField>
        <FormField label={t('auth.passwordRepeat')} required error={errors.password2}>
          <PasswordInput autoComplete="new-password" value={form.password2} onChange={(e) => set('password2')(e.target.value)} />
        </FormField>
        <div>
          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox checked={form.accept} onChange={(e) => set('accept')(e.target.checked)} className="mt-0.5" aria-invalid={Boolean(errors.accept)} />
            <span>
              {before}
              <Link to="/nutzungsbedingungen" target="_blank" className="text-primary hover:underline">
                {t('auth.register.terms')}
              </Link>
              {middle}
              <Link to="/datenschutz" target="_blank" className="text-primary hover:underline">
                {t('auth.register.privacy')}
              </Link>
              {after}
            </span>
          </label>
          {errors.accept ? <p className="mt-1 text-xs text-destructive">{errors.accept}</p> : null}
        </div>
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          {t('auth.register.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
