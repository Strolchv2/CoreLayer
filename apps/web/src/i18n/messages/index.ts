import { app } from './app';
import { auth } from './auth';
import { common } from './common';
import { design } from './design';
import { editor } from './editor';
import { landing } from './landing';
import { pages } from './pages';

/**
 * Alle Übersetzungen. Neue Sprache ergänzen:
 *  1. In jeder Datei unter ./messages einen Schlüssel (z. B. `fr`) hinzufügen
 *  2. `LOCALES` in @cv-studio/shared erweitern (auch für Lebenslauf-Beschriftungen)
 */
const modules = [common, auth, landing, app, editor, design, pages];

type DeMessages = typeof common.de & typeof auth.de & typeof landing.de & typeof app.de & typeof editor.de & typeof design.de & typeof pages.de;
export type MessageKey = keyof DeMessages;

export const messages = {
  de: Object.assign({}, ...modules.map((m) => m.de)) as DeMessages,
  en: Object.assign({}, ...modules.map((m) => m.en)) as Record<MessageKey, string>,
};
