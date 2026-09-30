/**
 * Einfache, nachvollziehbare Schlüsselbegriff-Analyse für den ATS-Check:
 * Aus einer Stellenanzeige werden häufige, aussagekräftige Begriffe extrahiert
 * und im Lebenslauftext gesucht. Keine Blackbox, kein künstlicher Score.
 */

const STOPWORDS = new Set(
  `aber alle allem allen aller alles als also am an ander andere anderem anderen anderer anderes anders auch auf aus bei beim bin bis bist da dabei dadurch dafür dagegen daher dahin damals damit danach daneben dann daran darauf daraus darf darfst darin darum darunter das dass dasselbe davon davor dazu dein deine deinem deinen deiner dem demnach den denen denn dennoch der deren derer des deshalb dessen dich die dies diese diesem diesen dieser dieses dir doch dort du durch ein eine einem einen einer eines einig einige einigem einigen einiger einiges einmal er es etwa etwas euch euer eure eurem euren eurer für gegen gewesen hab habe haben hat hatte hatten hier hin hinter ich ihm ihn ihnen ihr ihre ihrem ihren ihrer ihres im in indem ins ist ja jede jedem jeden jeder jedes jedoch jene jenem jenen jener jenes jetzt kann kannst kein keine keinem keinen keiner keines können könnt könnte machen man manche manchem manchen mancher manches mehr mein meine meinem meinen meiner mich mir mit muss musste nach nicht nichts noch nun nur ob oder ohne sehr sein seine seinem seinen seiner selbst sich sie sind so solche solchem solchen solcher soll sollen sollte sondern sonst sowie über um und uns unser unsere unserem unseren unter viel vom von vor während war waren warst was weg weil weiter welche welchem welchen welcher welches wenn werde werden wie wieder will wir wird wirst wo wollen wollte würde würden zu zum zur zwar zwischen
  sie ihre ihr wir unser unsere bieten suchen gesucht suche stelle stellen bewerbung bewerben aufgaben profil anforderungen erwartet erwarten freuen idealerweise wünschenswert vorteil vorteilhaft sowie bzw ggf gerne gern mwd mfd wmd m w d vollzeit teilzeit ab sofort unbefristet befristet standort unternehmen team teams arbeit arbeiten tätigkeit tätigkeiten mitarbeiter mitarbeitenden kenntnisse erfahrung erfahrungen gute guten sehr gut neue neuen neuer bereich bereichen rahmen möglichkeit möglichkeiten jahre jahren mind mindestens
  a an and are as at be by for from has have in is it its of on or that the to was were will with you your we our us they their this these those who whom which what when where why how all any both each few more most other some such no nor not only own same so than too very can just should now also may must able within across etc including include includes new role position job work working team teams company experience years year strong good great excellent ideal ideally plus benefits offer apply application candidate candidates looking seeking skills knowledge ability responsibilities requirements required preferred`
    .split(/\s+/)
    .filter(Boolean),
);

export function tokenize(text: string): string[] {
  return (
    text
      .toLowerCase()
      .replace(/[“”„"'`´]/g, ' ')
      .match(/[a-zäöüß0-9][a-zäöüß0-9+#./-]*[a-zäöüß0-9+#]|[a-zäöüß]/g) ?? []
  );
}

export interface KeywordAnalysis {
  keywords: string[];
  found: string[];
  missing: string[];
}

/** Extrahiert bis zu `limit` Schlüsselbegriffe (nach Häufigkeit, dann Länge). */
export function extractKeywords(jobDescription: string, limit = 25): string[] {
  const counts = new Map<string, number>();
  for (const token of tokenize(jobDescription)) {
    if (token.length < 3 || STOPWORDS.has(token) || /^\d+$/.test(token)) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([k]) => k);
}

const SUFFIXES = ['ungen', 'innen', 'erin', 'ern', 'ung', 'ing', 'ers', 'ment', 'en', 'er', 'in', 'ed', 'es', 'e', 's'];

/** Einfaches Suffix-Stemming, damit "Projektleitung" auch "Projektleiter" findet. */
export function stem(word: string): string {
  for (const suffix of SUFFIXES) {
    if (word.length - suffix.length >= 5 && word.endsWith(suffix)) return word.slice(0, -suffix.length);
  }
  return word;
}

export function analyzeKeywords(jobDescription: string, resumeText: string, limit = 25): KeywordAnalysis {
  const keywords = extractKeywords(jobDescription, limit);
  const lower = resumeText.toLowerCase();
  const tokens = new Set(tokenize(resumeText));
  const stems = [...new Set([...tokens].map(stem))];
  const found: string[] = [];
  const missing: string[] = [];
  for (const k of keywords) {
    const ks = stem(k);
    const match =
      tokens.has(k) ||
      lower.includes(k) ||
      stems.some((s) => s === ks || (ks.length >= 6 && s.length >= 6 && (s.startsWith(ks) || ks.startsWith(s))));
    (match ? found : missing).push(k);
  }
  return { keywords, found, missing };
}
