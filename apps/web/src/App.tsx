import { lazy, Suspense, type ReactNode } from 'react';
import { Route, Routes } from 'react-router';
import { GuestOnly, RequireAdmin, RequireAuth } from './auth/guards';
import { PageSpinner } from './components/ui/Spinner';

// Routen werden bei Bedarf geladen (Lazy Loading)
const LandingPage = lazy(() => import('./pages/LandingPage'));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'));
const AppTemplatesPage = lazy(() => import('./pages/TemplatesPage').then((m) => ({ default: m.AppTemplatesPage })));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ResumesPage = lazy(() => import('./pages/ResumesPage'));
const NewResumePage = lazy(() => import('./pages/NewResumePage'));
const ImportPage = lazy(() => import('./pages/ImportPage'));
const ResumeEditorPage = lazy(() => import('./editor/ResumeEditorPage'));
const ProfilesPage = lazy(() => import('./pages/ProfilesPage'));
const ProfileEditorPage = lazy(() => import('./editor/ProfileEditorPage'));
const CoverLettersPage = lazy(() => import('./pages/CoverLettersPage'));
const CoverLetterEditorPage = lazy(() => import('./pages/CoverLetterEditorPage'));
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const AdminPage = lazy(() => import('./pages/admin/AdminPage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const auth = (node: ReactNode) => <RequireAuth>{node}</RequireAuth>;
const guest = (node: ReactNode) => <GuestOnly>{node}</GuestOnly>;

export function App() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/vorlagen" element={<TemplatesPage />} />
        <Route path="/anmelden" element={guest(<LoginPage />)} />
        <Route path="/registrieren" element={guest(<RegisterPage />)} />
        <Route path="/passwort-vergessen" element={<ForgotPasswordPage />} />
        <Route path="/passwort-zuruecksetzen" element={<ResetPasswordPage />} />
        <Route path="/datenschutz" element={<LegalPage kind="privacy" />} />
        <Route path="/impressum" element={<LegalPage kind="imprint" />} />
        <Route path="/nutzungsbedingungen" element={<LegalPage kind="terms" />} />

        <Route path="/onboarding" element={auth(<OnboardingPage />)} />
        <Route path="/dashboard" element={auth(<DashboardPage />)} />
        <Route path="/lebenslaeufe" element={auth(<ResumesPage />)} />
        <Route path="/lebenslaeufe/neu" element={auth(<NewResumePage />)} />
        <Route path="/lebenslaeufe/import" element={auth(<ImportPage />)} />
        <Route path="/editor/:id" element={auth(<ResumeEditorPage />)} />
        <Route path="/app/vorlagen" element={auth(<AppTemplatesPage />)} />
        <Route path="/profile" element={auth(<ProfilesPage />)} />
        <Route path="/profile/:id" element={auth(<ProfileEditorPage />)} />
        <Route path="/anschreiben" element={auth(<CoverLettersPage />)} />
        <Route path="/anschreiben/:id" element={auth(<CoverLetterEditorPage />)} />
        <Route path="/dokumente" element={auth(<DocumentsPage />)} />
        <Route path="/einstellungen" element={auth(<SettingsPage />)} />
        <Route
          path="/admin/*"
          element={
            <RequireAdmin>
              <AdminPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
