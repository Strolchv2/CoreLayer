import { MailCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';
import { Input } from '../../components/ui/Input';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { AuthLayout } from './AuthLayout';

export default function ForgotPasswordPage() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/api/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={t('auth.forgot.title')}
      subtitle={t('auth.forgot.subtitle')}
      footer={
        <Link to="/anmelden" className="font-medium text-primary hover:underline">
          {t('auth.forgot.backToLogin')}
        </Link>
      }
    >
      {sent ? (
        <div className="flex gap-3 rounded-xl border bg-accent/50 p-4 text-sm" role="status">
          <MailCheck className="h-5 w-5 shrink-0 text-primary" />
          <p>{t('auth.forgot.sent')}</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <FormField label={t('auth.email')} required>
            <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </FormField>
          <Button type="submit" className="w-full" size="lg" loading={loading} disabled={!email}>
            {t('auth.forgot.submit')}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
