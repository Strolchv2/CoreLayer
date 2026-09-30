# CV Studio

**Erstelle, gestalte und exportiere professionelle Lebensläufe – ATS-freundlich, druckfertig und datenschutzorientiert.**

CV Studio ist eine vollständige Webanwendung (React + Node.js + PostgreSQL) zum Erstellen hochwertiger Lebensläufe
für Bewerbungen in Deutschland und international. Benutzer erfassen Inhalte in einem strukturierten Editor, sehen
jede Änderung sofort in einer echten A4-Live-Vorschau und exportieren ein PDF, das **exakt der Vorschau entspricht**.

---

## Inhalt

- [Funktionen](#funktionen)
- [Architektur](#architektur)
- [Schnellstart mit Docker](#schnellstart-mit-docker)
- [Lokale Entwicklung](#lokale-entwicklung)
- [Konfiguration](#konfiguration)
- [Tests](#tests)
- [Sicherheit & Datenschutz](#sicherheit--datenschutz)
- [Datenbank](#datenbank)
- [REST-API](#rest-api)
- [Betrieb: Backups, Admin, Updates](#betrieb-backups-admin-updates)

---

## Funktionen

| Bereich | Umfang |
| --- | --- |
| **Konto** | Registrierung, Login, Logout, Passwort-Reset per E-Mail, Passwort ändern, alle Geräte abmelden, Konto löschen, „Meine Daten exportieren“ (ZIP) |
| **Lebensläufe** | Beliebig viele Lebensläufe; erstellen (leer, Beispieldaten, aus Profil, Import), duplizieren, umbenennen, archivieren, löschen; Autosave mit Statusanzeige |
| **Editor** | 3-Spalten-Layout (Inhalt · Live-Vorschau · Design/Check), Tablet 2-spaltig, Smartphone mit Tab-Leiste; Drag & Drop für Abschnitte, Einträge, Aufzählungen und Kenntnisse; jeder Abschnitt und jedes persönliche Feld ein-/ausblendbar |
| **Inhalte** | Persönliche Daten (inkl. Foto, Links), Profil („Über mich“), Berufserfahrung, Ausbildung, Praktika, Weiterbildungen, Zertifikate, Kenntnisse (Text/Tags/Balken/Punkte), Sprachen (GER/CEFR), Projekte, Ehrenamt, Interessen, Referenzen („auf Anfrage“) |
| **Vorlagen** | 9 Vorlagen: Classic, Modern, Minimal, Professional, Executive, Creative, ATS, Technical, Elegant – jederzeit wechselbar ohne Datenverlust |
| **Design-Editor** | Farben, Schriftarten (11 eingebettete Schriften), Schrift-/Überschriftengröße, Zeilenabstand, Ränder, Abstände, Spaltenbreite, Icons, Foto (Größe/Form), Linien, Hintergrund, Header, Seitenzahlen, „Professionelle Standardeinstellungen“ |
| **Seitenumbrüche** | Eigene Paginierungs-Engine: keine Überschrift allein am Seitenende, keine halben Elemente, Einträge werden nur zwischen Aufzählungspunkten getrennt, überlange Absätze werden wortweise geteilt statt abgeschnitten |
| **PDF-Export** | Serverseitig mit Headless Chromium aus demselben Render-Code wie die Vorschau; A4, eingebettete Schriften, klickbare Links, getaggtes PDF, Dateiname `Vorname_Nachname_Lebenslauf.pdf` |
| **Bewerbungspaket** | Lebenslauf + Anschreiben + Zeugnisse + Zertifikate + Anlagen – als eine PDF (`Bewerbung_Vorname_Nachname.pdf`) oder als ZIP (`01_Lebenslauf.pdf`, `02_Anschreiben.pdf`, `03_Zeugnisse.pdf`, `04_Zertifikate.pdf`, `05_Anlagen.pdf`) |
| **Anschreiben** | Eigener Editor (Absender, Empfänger, Datum, Betreff, Anrede, Text, Grußformel, Unterschrift als Bild), Design des Lebenslaufs übernehmbar, PDF-Export |
| **Dokumente** | Upload von PDF/JPG/PNG (Zeugnisse, Arbeitszeugnisse, Zertifikate, Führerschein, sonstige Nachweise) mit strenger Prüfung |
| **ATS-Check** | Regelbasiert und nachvollziehbar (Layout, echter Text, Überschriften, grafische Elemente, Struktur, Datumsformate, Schlüsselbegriffe aus einer Stellenanzeige) – qualitative Einstufung statt künstlicher Prozentzahl |
| **Lebenslauf-Check** | Kontaktdaten, fehlende Beschreibungen, große Textblöcke, uneinheitliche Datumsformate, Lücken, ungültige Links – mit konkreten Vorschlägen und Sprung zum Feld |
| **Profile** | Wiederverwendbare Inhaltsgrundlagen („Elektrotechnik“, „Projektleiter“ …), aus denen Lebensläufe erstellt werden |
| **Import** | PDF, DOCX, TXT (heuristische Erkennung) und JSON-Sicherungen; Prüfung aller Inhalte vor der Übernahme |
| **Export** | PDF, DOCX, JSON-Datensicherung |
| **KI-Assistent** (optional) | Verbessern, professioneller formulieren, kürzen, aus Stichpunkten erstellen, Rechtschreibung – Vorschläge werden immer erst angezeigt und nur nach Bestätigung übernommen |
| **Onboarding** | 6 Schritte: Methode → Berufsbereich → persönliche Daten → Erfahrung → Ausbildung → Design |
| **Admin** | Statistiken, Systemstatus, Benutzer (sperren, Rollen, löschen), Vorlagen verwalten, Sicherheitsprotokoll, Datenbank-Backups – ohne Zugriff auf Lebenslaufinhalte |
| **UI** | Deutsch & Englisch (erweiterbar), Light/Dark Mode, responsiv, barrierearm (Tastaturbedienung, ARIA) |

---

## Architektur

```
.
├── packages/shared      Gemeinsames Datenmodell (Zod), Datumslogik, Qualitäts-/ATS-Check,
│                        Import-Parser, Vorlagen-Metadaten, Demo-Daten, Beschriftungen DE/EN
├── apps/server          REST-API (Express 5, TypeScript), PostgreSQL (Kysely), Auth, Uploads,
│                        PDF-Erzeugung (Playwright/Chromium), DOCX (docx), Admin, KI (Anthropic SDK)
├── apps/web             React 19 + TypeScript + Tailwind CSS 4 (Vite)
│   ├── src/render       Render-Engine: Vorlagen, Seitenumbruch-Algorithmus, Schriften
│   │                    → identisch genutzt für Live-Vorschau UND PDF (render.html)
│   ├── src/editor       Editor (Zustand-Store, Autosave, Formulare, Panels)
│   ├── src/pages        Seiten (Landing, Dashboard, Anschreiben, Dokumente, Admin …)
│   └── e2e              Playwright-End-to-End-Tests
├── deploy/nginx         nginx-Konfiguration für das Frontend
└── docker-compose.yml   database · backend · frontend · (optional) redis
```

### Prinzip „PDF = Vorschau“

```
Editor ──▶ ResumeDocument (React) ──▶ PaginatedDocument ──▶ A4-Seiten im Browser
                                            │
Server  ──▶ Chromium lädt render.html ──────┘  (gleicher Code, gleiche Schriften)
            └─▶ page.pdf(A4) ─▶ pdf-lib (Metadaten, Zusammenführen) ─▶ Download
```

Die Paginierung misst jedes Fragment (Eintragskopf, Absatz, Aufzählungspunkt) im DOM und verteilt es mit einem
reinen, getesteten Algorithmus (`apps/web/src/render/pagination.ts`) auf Seiten. Chromium auf dem Server führt
exakt denselben Code aus, bevor das PDF erzeugt wird – daher sind Vorschau und PDF identisch.

---

## Schnellstart mit Docker

Voraussetzungen: Docker mit Compose-Plugin.

```bash
cp .env.example .env
# .env anpassen: mindestens POSTGRES_PASSWORD, APP_URL, ADMIN_EMAIL/ADMIN_PASSWORD, SMTP_*, LEGAL_*
docker compose up -d --build
# optional mit Redis (Rate Limiting über mehrere Backend-Instanzen):
docker compose --profile redis up -d --build
```

Die Anwendung läuft danach auf `http://localhost:8080`. Für den Produktivbetrieb einen TLS-terminierenden
Reverse Proxy (z. B. Caddy, Traefik, nginx) vor den `frontend`-Container setzen und `APP_URL` auf die HTTPS-Adresse
stellen – Cookies werden in Produktion nur über HTTPS gesendet, HSTS ist aktiv.

| Service | Aufgabe |
| --- | --- |
| `database` | PostgreSQL 16 (Volume `db-data`) |
| `backend` | API, Migrationen beim Start, PDF-Erzeugung, Dateiablage (Volume `app-data` unter `/data`) |
| `frontend` | nginx: statisches Frontend, Proxy für `/api`, Sicherheits-Header |
| `redis` | optional, Profil `redis` |

Demo-Konto mit fiktiven Beispieldaten anlegen (optional):

```bash
docker compose exec -e DEMO_PASSWORD='ein-sicheres-Passwort-1' backend node dist/scripts/seed.js
```

---

## Lokale Entwicklung

Voraussetzungen: Node.js ≥ 22, PostgreSQL ≥ 14 (optional Redis).

```bash
npm install
# Datenbank anlegen (Beispiel)
createuser -P cvstudio && createdb -O cvstudio cvstudio

cp .env.example apps/server/.env   # DATABASE_URL, APP_URL=http://localhost:5173, MAIL_TRANSPORT=outbox
npm run db:migrate
npm run build --workspace @cv-studio/web   # Render-Bundle für den PDF-Export
npm run dev                                 # API :4000 + Vite :5173 (Proxy /api)
```

- Im Modus `MAIL_TRANSPORT=outbox` werden E-Mails (Passwort-Reset) als Dateien in `apps/server/storage/mail-outbox` abgelegt.
- Chromium wird über Playwright gefunden (`PLAYWRIGHT_BROWSERS_PATH`) oder über `CHROMIUM_EXECUTABLE_PATH`
  (`npx playwright-core install chromium-headless-shell`).
- Administrator anlegen: `npm run create-admin -- admin@example.com` (Passwort wird abgefragt).
- Demo-Daten: `DEMO_PASSWORD='…' npm run db:seed`.
- Einzel-Container-Betrieb ohne nginx: `SERVE_WEB=true npm start --workspace @cv-studio/server` liefert das gebaute Frontend mit aus.

---

## Konfiguration

Alle Einstellungen erfolgen über Umgebungsvariablen (siehe [.env.example](.env.example)). Es sind **keine
Passwörter oder Schlüssel im Quellcode** hinterlegt; der Server bricht in Produktion ab, wenn z. B. das
Entwicklungspasswort der Datenbank verwendet wird.

| Variable | Bedeutung |
| --- | --- |
| `APP_URL` | Öffentliche URL (E-Mail-Links, Origin-Prüfung) |
| `DATABASE_URL` / `DATABASE_SSL` | PostgreSQL-Verbindung |
| `COOKIE_SECURE`, `TRUST_PROXY`, `SESSION_TTL_DAYS` | Sitzungen & Proxy |
| `REDIS_URL` | optional: Rate Limiting in Redis |
| `MAIL_TRANSPORT`, `SMTP_*`, `MAIL_FROM` | E-Mail-Versand |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Erster Administrator (beim Start) |
| `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, `AI_MODEL` | optionaler KI-Assistent (Standardmodell `claude-opus-5-5`) |
| `PDF_CONCURRENCY`, `PDF_TIMEOUT_MS`, `CHROMIUM_EXECUTABLE_PATH`, `CHROMIUM_NO_SANDBOX` | PDF-Erzeugung |
| `STORAGE_DIR` | Dateiablage (Uploads, Backups) |
| `LEGAL_*` | Betreiberangaben für Impressum & Datenschutz |

---

## Tests

```bash
npm test                                   # Unit- & Integrationstests aller Pakete
npm run test --workspace @cv-studio/shared # Datumslogik, Checks, Import-Parser, Schemas
npm run test --workspace @cv-studio/server # API-Integrationstests gegen PostgreSQL (TEST_DATABASE_URL)
npm run test --workspace @cv-studio/web    # Seitenumbruch-Algorithmus
npm run test:e2e                           # Playwright: Browser-Tests gegen eine laufende Instanz
```

Die Server-Tests nutzen eine eigene Datenbank (`TEST_DATABASE_URL`, Standard `…/cvstudio_test`), die vor jedem Lauf
zurückgesetzt wird. Die PDF-Tests laufen, sobald das Render-Bundle gebaut ist.

Abgedeckt sind u. a.: Registrierung, Login/Logout, Passwort-Reset, Kontosperre, CSRF, Lebenslauf erstellen/bearbeiten,
Autosave & Versionskonflikte, Vorlagenwechsel, Drag & Drop, mehrseitige Umbrüche aller 9 Vorlagen (keine
abgeschnittenen Inhalte, keine verwaisten Überschriften), PDF-/DOCX-/JSON-Export, Bewerbungspaket (PDF & ZIP),
Anschreiben, Datei-Upload inkl. manipulierter Dateien, Duplizieren/Löschen, Benutzertrennung (IDOR),
Import (inkl. PDF-Rundlauf), DSGVO-Datenexport & Kontolöschung, mobile Darstellung und Dark Mode.

---

## Sicherheit & Datenschutz

- **Passwörter:** Argon2id (OWASP-Parameter); Timing-sichere Anmeldung auch bei unbekannten Adressen; Kontosperre nach 10 Fehlversuchen.
- **Sitzungen:** zufällige 256-Bit-Tokens, in der DB nur als SHA-256-Hash; Cookie `httpOnly`, `SameSite=Lax`, `Secure` in Produktion; gleitende Laufzeit; Rotation beim Login; Beendigung bei Passwortänderung/-reset.
- **CSRF:** Double-Submit-Token (`X-CSRF-Token`) + Origin-Prüfung für alle verändernden Anfragen.
- **Zugriffskontrolle / IDOR:** Jede Abfrage ist an die `user_id` gebunden; fremde Ressourcen liefern `404`; fremde Dokument-IDs (Foto, Anhänge, Unterschrift) werden verworfen.
- **SQL-Injection:** ausschließlich parametrisierte Abfragen (Kysely).
- **XSS:** React-Escaping, keine `dangerouslySetInnerHTML`, Links nur `http(s)`/`mailto`/`tel`, strikte CSP (Helmet/nginx).
- **Uploads:** Größenlimit, Endungs- und MIME-Prüfung, Magic-Byte-Erkennung, vollständiges Parsen von PDFs (verschlüsselte abgelehnt), Neukodierung aller Bilder (entfernt Metadaten), zufällige Dateinamen ohne Endung außerhalb des Web-Roots (Rechte 0600), Auslieferung nur an Eigentümer mit `nosniff` und `CSP: sandbox`.
- **Rate Limiting:** API allgemein, Login/Registrierung, Passwort-Reset, Exporte, Uploads, KI (optional in Redis).
- **Logs:** keine Bodies, keine Query-Strings, IDs werden maskiert, Cookies/Passwörter/E-Mails redigiert.
- **PDF-Renderer:** Chromium lädt nur das lokale Render-Bundle; alle anderen Netzwerkzugriffe sind blockiert.
- **DSGVO:** Datenschutzerklärung, Impressum, Nutzungsbedingungen; „Meine Daten exportieren“ (Art. 15/20); Kontolöschung inkl. aller Dateien (Art. 17); Admins sehen keine Lebenslaufinhalte; KI nur auf ausdrückliche Anforderung.

---

## Datenbank

Relationales Schema (PostgreSQL, Migrationen in `apps/server/src/db/migrations`):

| Tabelle | Inhalt |
| --- | --- |
| `users`, `sessions`, `password_reset_tokens` | Konten und Authentifizierung |
| `cv_contents` | Container für Inhalte – von `resumes` und `profiles` genutzt |
| `personal_data`, `personal_links` | Persönliche Daten, Links, ausgeblendete Felder |
| `content_sections` | Reihenfolge, Sichtbarkeit, eigene Titel, Optionen der Abschnitte |
| `profile_summaries` | „Über mich“ |
| `work_experiences`, `educations`, `internships`, `trainings`, `certificates`, `skill_groups`, `skills`, `languages`, `projects`, `volunteering`, `interests`, `cv_references` | Einträge der Abschnitte |
| `profiles`, `resumes`, `resume_attachments` | Profile, Lebensläufe (Vorlage, Design, Version), Anlagen |
| `cover_letters` | Anschreiben |
| `documents` | Uploads (Metadaten, Datei im Speicher) |
| `templates` | Vorlagenverwaltung |
| `export_events`, `audit_log` | Statistik und Sicherheitsprotokoll (ohne Inhalte) |

Speichern erfolgt transaktional mit **optimistischer Sperre** (`version`), damit parallele Bearbeitung in mehreren
Fenstern keine Daten überschreibt.

---

## REST-API

Alle Endpunkte unter `/api`, JSON, Cookie-Authentifizierung, CSRF-Header für `POST/PUT/PATCH/DELETE`.

| Methode & Pfad | Beschreibung |
| --- | --- |
| `GET /auth/csrf`, `GET /auth/me` | CSRF-Cookie, aktueller Benutzer |
| `POST /auth/register`, `/auth/login`, `/auth/logout`, `/auth/logout-all` | Konto & Sitzungen |
| `POST /auth/forgot-password`, `/auth/reset-password`, `/auth/change-password` | Passwort |
| `PATCH /account/settings`, `GET /account/export`, `DELETE /account` | Einstellungen, Datenexport, Löschung |
| `GET /dashboard` | Kennzahlen |
| `GET /resumes`, `POST /resumes` | Liste (`?filter=active|archived|all`), anlegen |
| `GET /resumes/:id`, `PUT /resumes/:id`, `PATCH /resumes/:id`, `DELETE /resumes/:id` | Lesen, Autosave (mit `version`), umbenennen/archivieren, löschen |
| `POST /resumes/:id/duplicate` | Duplizieren |
| `GET /resumes/:id/preview` | Exakte Druckvorschau (PDF inline) |
| `POST /resumes/:id/export/pdf`, `/export/docx`, `/export/package`; `GET /resumes/:id/export/json` | Exporte |
| `POST /resumes/:id/check` | Qualitäts- und ATS-Check (optional mit Stellenanzeige) |
| `GET/POST /profiles`, `GET/PUT/DELETE /profiles/:id`, `POST /profiles/:id/duplicate` | Profile |
| `GET/POST /cover-letters`, `GET/PUT/DELETE /cover-letters/:id`, `POST /cover-letters/:id/export/pdf` | Anschreiben |
| `GET/POST /documents`, `GET/PATCH/DELETE /documents/:id`, `GET /documents/:id/file` | Dokumente |
| `POST /import` | Import (PDF, DOCX, TXT, JSON) – liefert erkannte Inhalte zur Prüfung |
| `GET /templates` | Aktive Vorlagen |
| `GET /ai/status`, `POST /ai/rewrite` | KI-Assistent |
| `GET /admin/stats`, `/admin/system`, `/admin/users`, `/admin/templates`, `/admin/logs`, `/admin/backups` (+ `PATCH`/`POST`/`DELETE`) | Administration |
| `GET /health`, `GET /legal` | Health-Check, Betreiberangaben |

Fehler werden einheitlich als `{ "error": { "code": "…", "message": "…", "fields": { … } } }` geliefert; das
Frontend übersetzt den Code in eine verständliche Meldung (keine Stacktraces).

---

## Betrieb: Backups, Admin, Updates

- **Administrator:** über `ADMIN_EMAIL`/`ADMIN_PASSWORD` beim Start oder nachträglich mit
  `docker compose exec backend node dist/scripts/createAdmin.js admin@example.com` (Passwort wird abgefragt).
- **Datenbank-Backups:** im Adminbereich, per `npm run backup` (lokal) oder
  `docker compose exec backend node dist/scripts/backup.js` – z. B. täglich per Cron. Es entstehen `pg_dump`-Dateien
  unter `$STORAGE_DIR/backups`; zusätzlich das Volume `app-data` mit den Uploads sichern. Backups werden aus
  Datenschutzgründen nicht über die Weboberfläche heruntergeladen. Wiederherstellung:
  `pg_restore --clean --if-exists -d "$DATABASE_URL" <datei>.dump`.
- **Benutzer-Backups:** jeder Benutzer kann einzelne Lebensläufe als JSON sichern und alle Daten als ZIP exportieren.
- **Updates:** `git pull && docker compose up -d --build` – Migrationen laufen beim Start automatisch.
- **Weitere Sprachen:** Übersetzungen in `apps/web/src/i18n/messages/*` und `packages/shared/src/labels.ts` ergänzen,
  `LOCALES` in `packages/shared/src/constants.ts` erweitern.

Die Beispieldaten („Max Mustermann“) sind vollständig fiktiv und dienen nur der Darstellung.
