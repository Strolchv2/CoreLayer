/**
 * Dateinamen für Exporte, z. B. "Max_Mustermann_Lebenslauf.pdf".
 * Umlaute werden transliteriert, damit Dateinamen in allen Systemen funktionieren.
 */
const TRANSLIT: Record<string, string> = {
  ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ß: 'ss',
};

export function toFileNamePart(input: string): string {
  return input
    .replace(/[äöüÄÖÜß]/g, (c) => TRANSLIT[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

export function buildExportFileName(parts: string[], extension: string): string {
  const base = parts.map(toFileNamePart).filter(Boolean).join('_') || 'Dokument';
  return `${base}.${extension}`;
}

/** Bereinigt einen hochgeladenen Dateinamen für Anzeige/Download (kein Pfad, keine Steuerzeichen). */
export function sanitizeUploadName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');
  return (cleaned || 'datei').slice(0, 180);
}
