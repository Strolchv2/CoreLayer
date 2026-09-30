import type { FontKey } from '@cv-studio/shared';

/** CSS-Schriftstapel je Schrift-Schlüssel (mit sinnvollen Fallbacks). */
export const FONT_STACKS: Record<FontKey, { family: string; stack: string; label: string; category: 'sans' | 'serif' | 'mono' }> = {
  inter: { family: 'Inter', stack: "'Inter', 'Helvetica Neue', Arial, sans-serif", label: 'Inter', category: 'sans' },
  roboto: { family: 'Roboto', stack: "'Roboto', Arial, sans-serif", label: 'Roboto', category: 'sans' },
  lato: { family: 'Lato', stack: "'Lato', 'Helvetica Neue', Arial, sans-serif", label: 'Lato', category: 'sans' },
  'open-sans': { family: 'Open Sans', stack: "'Open Sans', Arial, sans-serif", label: 'Open Sans', category: 'sans' },
  'source-sans': { family: 'Source Sans 3', stack: "'Source Sans 3', Arial, sans-serif", label: 'Source Sans', category: 'sans' },
  'ibm-plex-sans': { family: 'IBM Plex Sans', stack: "'IBM Plex Sans', Arial, sans-serif", label: 'IBM Plex Sans', category: 'sans' },
  arimo: { family: 'Arimo', stack: "'Arimo', Arial, Helvetica, sans-serif", label: 'Arimo (Arial-kompatibel)', category: 'sans' },
  merriweather: { family: 'Merriweather', stack: "'Merriweather', Georgia, serif", label: 'Merriweather', category: 'serif' },
  'eb-garamond': { family: 'EB Garamond', stack: "'EB Garamond', Garamond, Georgia, serif", label: 'EB Garamond', category: 'serif' },
  playfair: { family: 'Playfair Display', stack: "'Playfair Display', Georgia, serif", label: 'Playfair Display', category: 'serif' },
  'jetbrains-mono': { family: 'JetBrains Mono', stack: "'JetBrains Mono', Consolas, monospace", label: 'JetBrains Mono', category: 'mono' },
};

/**
 * Lädt die benötigten Schriftschnitte explizit, bevor Seitenumbrüche berechnet werden –
 * sonst würden Textblöcke mit Ersatzschriften vermessen.
 */
export async function loadFonts(keys: FontKey[]): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  const unique = [...new Set(keys)];
  const loads: Promise<unknown>[] = [];
  for (const key of unique) {
    const family = FONT_STACKS[key].family;
    for (const variant of ['400', 'italic 400', '600', '700']) {
      loads.push(document.fonts.load(`${variant} 12px "${family}"`, 'AaÄäÖöÜüß€').catch(() => undefined));
    }
  }
  await Promise.all(loads);
  await document.fonts.ready;
}
