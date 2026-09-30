import { Component, type ErrorInfo, type ReactNode } from 'react';
import { messages } from '../i18n/messages';

/** Fängt unerwartete Renderfehler ab – ohne technische Details für Benutzer. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error(error, info.componentStack);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    let locale: 'de' | 'en' = 'de';
    try {
      locale = localStorage.getItem('cvs.locale') === 'en' ? 'en' : 'de';
    } catch {
      /* ignorieren */
    }
    const m = messages[locale];
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">{m['errors.boundaryTitle']}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{m['errors.boundaryText']}</p>
          <button className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" onClick={() => window.location.reload()}>
            {m['errors.reload']}
          </button>
        </div>
      </div>
    );
  }
}
