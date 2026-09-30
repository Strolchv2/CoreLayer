import { Link } from 'react-router';
import { PublicLayout } from '../components/layout/PublicLayout';
import { Button } from '../components/ui/Button';
import { useT } from '../i18n';

export default function NotFoundPage() {
  const t = useT();
  return (
    <PublicLayout>
      <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
        <p className="text-6xl font-semibold text-primary/30">404</p>
        <h1 className="mt-4 text-2xl font-semibold">{t('errors.pageNotFound')}</h1>
        <p className="mt-2 text-muted-foreground">{t('errors.pageNotFoundText')}</p>
        <Link to="/" className="mt-8">
          <Button>{t('notFound.home')}</Button>
        </Link>
      </div>
    </PublicLayout>
  );
}
