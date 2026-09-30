import type { UserDTO } from '@cv-studio/shared';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { safeNext } from '../../auth/guards';
import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';
import { Input } from '../../components/ui/Input';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { AuthLayout } from './AuthLayout';

export default function LoginPage() {
  const t = useT();
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<{ user: UserDTO }>('/api/auth/login', { email, password });
      setUser(res.user);
      navigate(safeNext(params.get('next')) ?? (res.user.onboardingCompleted ? '/dashboard' : '/onboarding'), { replace: true });
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      footer={
        <>
          {t('auth.login.noAccount')}{' '}
          <Link to="/registrieren" className="font-medium text-primary hover:underline">
            {t('nav.register')}
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
        <FormField label={t('auth.email')} required>
          <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </FormField>
        <FormField
          label={t('auth.password')}
          required
          action={
            <Link to="/passwort-vergessen" className="text-xs font-medium text-primary hover:underline">
              {t('auth.login.forgot')}
            </Link>
          }
        >
          <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </FormField>
        <Button type="submit" className="w-full" size="lg" loading={loading} disabled={!email || !password}>
          {t('auth.login.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
