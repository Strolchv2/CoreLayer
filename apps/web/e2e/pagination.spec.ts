import { expect, test } from '@playwright/test';
import { createDemoContent, createId, TEMPLATE_KEYS, TEMPLATES, type RenderRequest } from '@cv-studio/shared';

/** Sehr umfangreicher Lebenslauf, um Seitenumbrüche zu erzwingen. */
function stressContent() {
  const c = createDemoContent('de');
  const long = 'Verantwortung für Planung, Umsetzung und Dokumentation komplexer Elektroinstallationen in Industrie- und Gewerbebauten. '.repeat(28);
  c.profile.summary = long;
  const base = c.experience[0]!;
  for (let i = 0; i < 8; i++) {
    c.experience.push({
      ...base,
      id: createId(),
      employer: `Beispielfirma ${i + 1} GmbH`,
      tasks: Array.from({ length: 7 }, (_, j) => `Aufgabe ${j + 1} mit ausreichend Text, um eine realistische Zeilenlänge im Lebenslauf zu erzeugen`),
    });
  }
  c.skills[0]!.items.push(...Array.from({ length: 25 }, (_, i) => ({ id: createId(), name: `Kenntnis ${i + 1}`, level: (i % 5) + 1 })));
  return c;
}

for (const key of TEMPLATE_KEYS) {
  test(`Seitenumbrüche ohne abgeschnittene Inhalte – ${key}`, async ({ page }) => {
    const request: RenderRequest = {
      kind: 'resume',
      title: 'Test',
      data: { content: stressContent(), design: TEMPLATES[key].defaultDesign, templateKey: key, language: 'de', dateFormat: 'MM/YYYY', photoUrl: null },
    };
    await page.addInitScript((p) => {
      (window as unknown as { __CV_PAYLOAD__: unknown }).__CV_PAYLOAD__ = p;
    }, request);
    await page.goto('/render.html');
    await page.waitForFunction(() => (window as unknown as { __CV_READY__?: boolean }).__CV_READY__ === true);

    const result = await page.evaluate(() => {
      const problems: string[] = [];
      const pages = Array.from(document.querySelectorAll<HTMLElement>('#render-root > .cv-page'));
      pages.forEach((pageEl, pi) => {
        for (const col of Array.from(pageEl.querySelectorAll<HTMLElement>('.cv-col'))) {
          const cs = getComputedStyle(col);
          const bottom = col.getBoundingClientRect().bottom - parseFloat(cs.paddingBottom);
          const frags = Array.from(col.querySelectorAll<HTMLElement>(':scope > .cv-frag'));
          for (const f of frags) {
            if (f.getBoundingClientRect().bottom > bottom + 1.5) problems.push(`Seite ${pi + 1}: ${f.dataset.frag} ragt über den Rand`);
          }
          const last = frags[frags.length - 1];
          if (last && last.classList.contains('cv-is-heading') && pi < pages.length - 1) problems.push(`Seite ${pi + 1}: Überschrift allein am Seitenende`);
        }
      });
      return { pages: pages.length, problems };
    });
    expect(result.problems).toEqual([]);
    expect(result.pages).toBeGreaterThan(1);
  });
}
