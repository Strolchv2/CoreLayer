import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { PublicLayout } from '../components/layout/PublicLayout';
import { useI18n } from '../i18n';
import { api } from '../lib/api';

interface LegalInfo {
  operatorName: string;
  operatorAddress: string;
  operatorEmail: string;
  operatorPhone: string;
  representative: string;
  register: string;
  vatId: string;
  appUrl: string;
}

const UPDATED = '30.09.2026';

function H({ children }: { children: ReactNode }) {
  return <h2 className="mt-8 text-lg font-semibold">{children}</h2>;
}
function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 leading-relaxed text-muted-foreground">{children}</p>;
}
function UL({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
      {items.map((i, n) => (
        <li key={n}>{i}</li>
      ))}
    </ul>
  );
}

function Operator({ info, missing }: { info: LegalInfo | undefined; missing: string }) {
  const v = (s: string | undefined) => (s && s.trim() ? s : missing);
  return (
    <address className="mt-3 not-italic leading-relaxed text-muted-foreground">
      {v(info?.operatorName)}
      <br />
      {v(info?.operatorAddress)
        .split(/\s*[,;]\s*/)
        .map((line, i) => (
          <span key={i}>
            {line}
            <br />
          </span>
        ))}
      E-Mail: {v(info?.operatorEmail)}
      {info?.operatorPhone ? (
        <>
          <br />
          Telefon: {info.operatorPhone}
        </>
      ) : null}
    </address>
  );
}

function PrivacyDe({ info, missing }: { info?: LegalInfo; missing: string }) {
  return (
    <>
      <H>1. Verantwortlicher</H>
      <Operator info={info} missing={missing} />
      <H>2. Grundsätze</H>
      <P>
        Lebensläufe enthalten besonders schützenswerte personenbezogene Daten. CV Studio verarbeitet diese Daten ausschließlich, um dir die Erstellung,
        Speicherung und den Export deiner Bewerbungsunterlagen zu ermöglichen (Art. 6 Abs. 1 lit. b DSGVO). Es findet kein Verkauf, keine Weitergabe zu
        Werbezwecken und kein Profiling statt. Administratoren sehen keine Inhalte deiner Lebensläufe, Anschreiben oder Dokumente.
      </P>
      <H>3. Verarbeitete Daten</H>
      <UL
        items={[
          'Kontodaten: E-Mail-Adresse, Anzeigename, Passwort (nur als Argon2id-Hash), Einstellungen, Zeitpunkt der Registrierung und letzten Anmeldung.',
          'Inhalte: Lebensläufe, Profile, Anschreiben und Design-Einstellungen, die du selbst eingibst.',
          'Dokumente: hochgeladene Zeugnisse, Zertifikate und Fotos. Bilder werden neu kodiert, wobei Metadaten (z. B. GPS-Koordinaten) entfernt werden.',
          'Sicherheitsprotokoll: sicherheitsrelevante Ereignisse (z. B. Anmeldung, fehlgeschlagene Anmeldung, Kontolöschung) mit Zeitpunkt und Konto-ID – ohne Lebenslaufinhalte.',
          'Nutzungsstatistik: Anzahl der Exporte je Konto (ohne Inhalte).',
        ]}
      />
      <H>4. Cookies</H>
      <P>
        Wir verwenden ausschließlich technisch notwendige Cookies (§ 25 Abs. 2 Nr. 2 TDDDG): ein Sitzungs-Cookie (httpOnly) für die Anmeldung und ein
        Sicherheits-Cookie zum Schutz vor Cross-Site-Request-Forgery. Es werden keine Tracking- oder Werbe-Cookies eingesetzt. Im Browser werden zusätzlich
        Sprache, Farbschema und eine lokale Sicherung ungespeicherter Änderungen abgelegt; diese werden beim Abmelden entfernt.
      </P>
      <H>5. Server-Logs und Missbrauchsschutz</H>
      <P>
        Technische Protokolle enthalten keine Anfrageinhalte und keine IDs von Dokumenten. Zum Schutz vor Missbrauch (Rate Limiting) wird die IP-Adresse
        kurzzeitig im Arbeitsspeicher bzw. Zwischenspeicher verarbeitet und nach Ablauf des Zeitfensters (max. 1 Stunde) verworfen (Art. 6 Abs. 1 lit. f DSGVO).
      </P>
      <H>6. KI-Assistent (optional)</H>
      <P>
        Falls der KI-Assistent aktiviert ist und du ihn ausdrücklich nutzt, wird ausschließlich der markierte Text an den KI-Anbieter (Anthropic) übermittelt,
        um einen Formulierungsvorschlag zu erzeugen. Dabei kann eine Übermittlung in ein Drittland (USA) stattfinden. Vorschläge werden erst nach deiner Bestätigung
        übernommen. Ohne deine Aktion findet keine Übermittlung statt.
      </P>
      <H>7. E-Mails</H>
      <P>Wir versenden E-Mails nur für den Passwort-Reset. Es gibt keinen Newsletter.</P>
      <H>8. Speicherdauer</H>
      <P>
        Deine Daten werden gespeichert, bis du sie löschst oder dein Konto löschst. Mit der Kontolöschung werden alle Inhalte und hochgeladenen Dateien sofort
        entfernt. Datenbank-Backups werden turnusmäßig überschrieben.
      </P>
      <H>9. Deine Rechte</H>
      <UL
        items={[
          'Auskunft (Art. 15 DSGVO) und Datenübertragbarkeit (Art. 20 DSGVO): In den Einstellungen unter „Meine Daten exportieren“ erhältst du alle Daten als ZIP.',
          'Berichtigung (Art. 16 DSGVO): Alle Inhalte kannst du jederzeit selbst bearbeiten.',
          'Löschung (Art. 17 DSGVO): In den Einstellungen unter „Konto löschen“.',
          'Einschränkung (Art. 18) und Widerspruch (Art. 21 DSGVO) – wende dich dazu an den Verantwortlichen.',
          'Beschwerde bei einer Datenschutz-Aufsichtsbehörde (Art. 77 DSGVO).',
        ]}
      />
      <H>10. Sicherheit</H>
      <P>
        Übertragung per HTTPS, Passwörter als Argon2id-Hash, Sitzungs-Tokens nur gehasht gespeichert, strikte Zugriffskontrolle auf eigene Daten, geprüfte
        Datei-Uploads und Speicherung außerhalb öffentlich erreichbarer Verzeichnisse.
      </P>
    </>
  );
}

function PrivacyEn({ info, missing }: { info?: LegalInfo; missing: string }) {
  return (
    <>
      <H>1. Controller</H>
      <Operator info={info} missing={missing} />
      <H>2. Principles</H>
      <P>
        CVs contain sensitive personal data. CV Studio processes this data solely to let you create, store and export your application documents
        (Art. 6(1)(b) GDPR). There is no sale, no disclosure for advertising and no profiling. Administrators cannot see the content of your CVs, cover
        letters or documents.
      </P>
      <H>3. Data processed</H>
      <UL
        items={[
          'Account data: email address, display name, password (Argon2id hash only), settings, registration and last login time.',
          'Content: CVs, profiles, cover letters and design settings you enter yourself.',
          'Documents: uploaded references, certificates and photos. Images are re-encoded and metadata (e.g. GPS) is removed.',
          'Security log: security-relevant events (e.g. login, failed login, account deletion) with time and account ID – without CV content.',
          'Usage statistics: number of exports per account (without content).',
        ]}
      />
      <H>4. Cookies</H>
      <P>
        We only use strictly necessary cookies: a session cookie (httpOnly) for login and a security cookie against cross-site request forgery. No tracking or
        advertising cookies are used. Language, colour scheme and a local backup of unsaved changes are stored in your browser and removed on logout.
      </P>
      <H>5. Server logs and abuse protection</H>
      <P>
        Technical logs contain no request content. For abuse protection (rate limiting), IP addresses are processed briefly in memory or cache and discarded
        after the time window (max. 1 hour) (Art. 6(1)(f) GDPR).
      </P>
      <H>6. AI assistant (optional)</H>
      <P>
        If the AI assistant is enabled and you explicitly use it, only the selected text is sent to the AI provider (Anthropic) to create a suggestion. This may
        involve a transfer to a third country (USA). Suggestions are only applied after your confirmation.
      </P>
      <H>7. Retention</H>
      <P>Your data is stored until you delete it or your account. Deleting your account removes all content and files immediately.</P>
      <H>8. Your rights</H>
      <UL
        items={[
          'Access and portability: use "Export my data" in the settings.',
          'Rectification: you can edit all content yourself at any time.',
          'Erasure: use "Delete account" in the settings.',
          'Restriction and objection – contact the controller.',
          'Complaint to a data protection supervisory authority.',
        ]}
      />
    </>
  );
}

function ImprintDe({ info, missing }: { info?: LegalInfo; missing: string }) {
  return (
    <>
      <H>Angaben gemäß § 5 DDG</H>
      <Operator info={info} missing={missing} />
      {info?.representative ? (
        <>
          <H>Vertreten durch</H>
          <P>{info.representative}</P>
        </>
      ) : null}
      {info?.register ? (
        <>
          <H>Registereintrag</H>
          <P>{info.register}</P>
        </>
      ) : null}
      {info?.vatId ? (
        <>
          <H>Umsatzsteuer-ID</H>
          <P>{info.vatId}</P>
        </>
      ) : null}
      <H>Verbraucherstreitbeilegung</H>
      <P>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</P>
      <H>Haftung für Inhalte</H>
      <P>
        Die Inhalte der mit CV Studio erstellten Lebensläufe werden ausschließlich von den jeweiligen Benutzern erstellt und verantwortet. Die Beispieldaten
        (z. B. „Max Mustermann“) sind vollständig fiktiv.
      </P>
    </>
  );
}

function TermsDe() {
  return (
    <>
      <H>1. Leistung</H>
      <P>CV Studio ermöglicht das Erstellen, Gestalten, Speichern und Exportieren von Lebensläufen, Anschreiben und Bewerbungspaketen.</P>
      <H>2. Konto</H>
      <P>Du bist für die Geheimhaltung deines Passworts verantwortlich. Pro Person ist ein Konto vorgesehen. Missbräuchlich genutzte Konten können gesperrt werden.</P>
      <H>3. Inhalte</H>
      <P>
        Du bist für die Richtigkeit deiner Angaben verantwortlich. Lade nur Dokumente hoch, zu deren Nutzung du berechtigt bist. Der optionale KI-Assistent liefert
        ausschließlich Formulierungsvorschläge – prüfe sie vor der Übernahme.
      </P>
      <H>4. Verfügbarkeit</H>
      <P>Wir bemühen uns um eine hohe Verfügbarkeit, können diese jedoch nicht garantieren. Sichere wichtige Unterlagen zusätzlich über den Datenexport.</P>
      <H>5. Kündigung</H>
      <P>Du kannst dein Konto jederzeit in den Einstellungen löschen. Alle Daten werden dabei entfernt.</P>
      <H>6. Haftung</H>
      <P>Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie nach den gesetzlichen Bestimmungen. Im Übrigen ist die Haftung ausgeschlossen, soweit gesetzlich zulässig.</P>
    </>
  );
}

function TermsEn() {
  return (
    <>
      <H>1. Service</H>
      <P>CV Studio lets you create, design, store and export CVs, cover letters and application packages.</P>
      <H>2. Account</H>
      <P>You are responsible for keeping your password secret. Misused accounts may be blocked.</P>
      <H>3. Content</H>
      <P>You are responsible for the accuracy of your information and may only upload documents you are entitled to use. The optional AI assistant only provides suggestions – review them before applying.</P>
      <H>4. Termination</H>
      <P>You can delete your account at any time in the settings. All data will be removed.</P>
    </>
  );
}

/** Datenschutz, Impressum und Nutzungsbedingungen – Betreiberangaben stammen aus der Server-Konfiguration. */
export default function LegalPage({ kind }: { kind: 'privacy' | 'imprint' | 'terms' }) {
  const { t, locale } = useI18n();
  const { data } = useQuery({ queryKey: ['legal'], queryFn: () => api.get<LegalInfo>('/api/legal'), staleTime: Infinity });
  const missing = t('legal.operatorMissing');
  const title = kind === 'privacy' ? t('nav.privacy') : kind === 'imprint' ? t('nav.imprint') : t('nav.terms');
  return (
    <PublicLayout>
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('legal.lastUpdated', { date: UPDATED })}</p>
        {kind === 'privacy' ? (
          locale === 'en' ? <PrivacyEn info={data} missing={missing} /> : <PrivacyDe info={data} missing={missing} />
        ) : kind === 'imprint' ? (
          <ImprintDe info={data} missing={missing} />
        ) : locale === 'en' ? (
          <TermsEn />
        ) : (
          <TermsDe />
        )}
      </article>
    </PublicLayout>
  );
}
