/** Hilfsfunktion: erzwingt, dass jede Sprache dieselben Schlüssel besitzt. */
export function defineMessages<T extends Record<string, string>>(messages: { de: T; en: Record<keyof T, string> }) {
  return messages;
}
