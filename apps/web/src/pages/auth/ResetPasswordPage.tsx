import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { AuthLayout } from './AuthLayout';
import { validatePassword } from './RegisterPage';

export default function ResetPasswordPage() {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const pw = validatePassword(password);
    const next: Record<string, string> = {};
    if (pw) next.password = t(`validation.${pw}`);
    if (password !== password2) next.password2 = t('validation.passwords_mismatch');
    setErrors(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    setError(null);
    try {
      await api.post('/api/auth/reset-password', { token, password });
      toast.success(t('auth.reset.success'));
      navigate('/anmelden', { replace: true });
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={t('auth.reset.title')}
      footer={
        <Link to="/passwort-vergessen" className="font-medium text-primary hover:underline">
          {t('auth.forgot.submit')}
        </Link>
      }
    >
      {!token ? (
        <p className="text-sm text-destructive">{t('auth.reset.missingToken')}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          <FormField label={t('auth.password')} required error={errors.password} hint={t('auth.passwordHint')}>
            <PasswordInput autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          </FormField>
          <FormField label={t('auth.passwordRepeat')} required error={errors.password2}>
            <PasswordInput autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} />
          </FormField>
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            {t('auth.reset.submit')}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
