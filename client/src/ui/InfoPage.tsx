import { useEffect } from 'react';
import Markdown from 'react-markdown';
import { Link, NavLink } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import architecture from '../../../docs/public/architecture.md?raw';
import cryptography from '../../../docs/public/cryptography.md?raw';
import privacy from '../../../docs/public/privacy.md?raw';
import security from '../../../docs/public/security.md?raw';
import transparency from '../../../docs/public/transparency.md?raw';

export interface InfoPageDef {
  path: string;
  title: string;
  source: string;
}

/** The public documentation pages are the very same files as in docs/public. */
export const INFO_PAGES: InfoPageDef[] = [
  { path: '/security', title: 'Security', source: security },
  { path: '/privacy', title: 'Privacy', source: privacy },
  { path: '/cryptography', title: 'Cryptography', source: cryptography },
  { path: '/architecture', title: 'Architecture', source: architecture },
  { path: '/transparency', title: 'Transparency', source: transparency },
];

export function InfoNav() {
  return (
    <nav className="info-nav">
      {INFO_PAGES.map((p) => (
        <NavLink key={p.path} to={p.path}>
          {p.title}
        </NavLink>
      ))}
    </nav>
  );
}

export function InfoPage({ page }: { page: InfoPageDef }) {
  useEffect(() => {
    document.title = `${page.title} — CoreLayer`;
    window.scrollTo(0, 0);
  }, [page]);
  return (
    <div className="info">
      <header className="info-header">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden /> CoreLayer
        </Link>
        <InfoNav />
      </header>
      <article className="prose">
        {/* react-markdown never renders raw HTML, so this cannot inject markup. */}
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) =>
              href?.startsWith('/') ? (
                <Link to={href}>{children}</Link>
              ) : (
                <a href={href} rel="noreferrer noopener" target="_blank">
                  {children}
                </a>
              ),
          }}
        >
          {page.source}
        </Markdown>
      </article>
    </div>
  );
}
