/**
 * Mengen und Einheiten. Eine Menge steht als Text in einer Zelle, z. B. „500 g“, „2 TL“, „1/2 EL“.
 *
 * Umrechnung (nach fester Formel, nichts wird geraten):
 *   Gewicht:  g, kg          -> Gramm (exakt)
 *   Volumen:  ml, l, TL, EL, Tasse -> Milliliter (exakt, festgelegte Größen)
 *   Gramm aus Milliliter:    Milliliter × Dichte (g/ml) der Zutat
 * Die Dichten sind Richtwerte und schwanken je nach Sorte und Feinheit. Für Zutaten ohne
 * eingetragene Dichte gibt es keine Umrechnung; die Angabe bleibt dann unverändert.
 */

export type UnitKind = 'none' | 'weight' | 'volume' | 'count';

export interface Unit {
  id: string;
  label: string;
  kind: UnitKind;
  /** weight: Faktor nach Gramm; volume: Faktor nach Milliliter */
  factor: number;
}

export const UNITS: Unit[] = [
  { id: '', label: '–', kind: 'none', factor: 1 },
  { id: 'g', label: 'g', kind: 'weight', factor: 1 },
  { id: 'kg', label: 'kg', kind: 'weight', factor: 1000 },
  { id: 'ml', label: 'ml', kind: 'volume', factor: 1 },
  { id: 'l', label: 'l', kind: 'volume', factor: 1000 },
  { id: 'TL', label: 'TL', kind: 'volume', factor: 5 },
  { id: 'EL', label: 'EL', kind: 'volume', factor: 15 },
  { id: 'Tasse', label: 'Tasse', kind: 'volume', factor: 250 },
  { id: 'Stück', label: 'Stück', kind: 'count', factor: 1 },
  { id: 'Prise', label: 'Prise', kind: 'count', factor: 1 },
  { id: 'Dose', label: 'Dose', kind: 'count', factor: 1 },
  { id: 'Pck.', label: 'Pck.', kind: 'count', factor: 1 },
  { id: 'Zehe', label: 'Zehe', kind: 'count', factor: 1 },
  { id: 'Bund', label: 'Bund', kind: 'count', factor: 1 },
];

/** Schreibweisen, die auf eine Einheit zeigen (Groß-/Kleinschreibung egal). */
const ALIAS: Record<string, string> = {
  gramm: 'g', g: 'g', kg: 'kg', kilo: 'kg',
  ml: 'ml', milliliter: 'ml', l: 'l', liter: 'l',
  tl: 'TL', teelöffel: 'TL', el: 'EL', esslöffel: 'EL',
  tasse: 'Tasse', tassen: 'Tasse',
  stück: 'Stück', stk: 'Stück', st: 'Stück',
  prise: 'Prise', prisen: 'Prise', dose: 'Dose', dosen: 'Dose',
  pck: 'Pck.', packung: 'Pck.', zehe: 'Zehe', zehen: 'Zehe', bund: 'Bund',
};

export function unitOf(id: string): Unit {
  return UNITS.find((u) => u.id === id) ?? UNITS[0];
}

/** Dichte in g/ml: Richtwerte. Reihenfolge wichtig: erster Treffer gilt. */
const DENSITY: [string, number][] = [
  ['salz', 1.2],
  ['zucker', 0.85],
  ['mehl', 0.55],
  ['butter', 0.91],
  ['öl', 0.92],
  ['honig', 1.42],
  ['milch', 1.03],
  ['wasser', 1.0],
  ['sahne', 1.0],
  ['reis', 0.8],
];

export function densityOf(ingredient: string): number | null {
  const n = ingredient.toLowerCase();
  const hit = DENSITY.find(([key]) => n.includes(key));
  return hit ? hit[1] : null;
}

/** Deutsche Zahl: höchstens eine Nachkommastelle. */
export function fmt(n: number, digits = 1): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: digits });
}

export interface ParsedAmount {
  /** Zahl als Text, so wie eingegeben (z. B. „1/2“, „0,5“) */
  numText: string;
  /** Zahlenwert, null wenn keine Zahl erkannt wurde */
  qty: number | null;
  /** Einheit-Kennung aus UNITS, '' wenn keine erkannt */
  unit: string;
}

export function parseAmount(text: string): ParsedAmount {
  const t = text.trim();
  const m = t.match(/^(\d+\/\d+|\d+(?:[.,]\d*)?)\s*(.*)$/);
  if (!m) return { numText: '', qty: null, unit: '' };
  const numText = m[1];
  let qty: number;
  if (numText.includes('/')) {
    const [a, b] = numText.split('/').map(Number);
    qty = b ? a / b : NaN;
  } else {
    qty = Number(numText.replace(',', '.'));
  }
  const word = m[2].split(/\s+/)[0] ?? '';
  const key = word.replace(/[.,;:]$/, '').toLowerCase();
  const unitId = key ? (ALIAS[key] ?? ALIAS[word.toLowerCase()] ?? '') : '';
  return { numText, qty: Number.isFinite(qty) ? qty : null, unit: unitId };
}

export interface Grams {
  grams: number;
  /** nachvollziehbare Rechnung, z. B. „2 TL = 10 ml × 1,2 g/ml“ */
  formula: string;
}

/** Gramm einer Menge für eine Zutat. null, wenn sich das nicht exakt berechnen lässt. */
export function toGrams(amount: string, ingredient: string): Grams | null {
  const p = parseAmount(amount);
  if (p.qty === null || !p.unit) return null;
  const u = unitOf(p.unit);
  if (u.kind === 'weight') {
    const grams = p.qty * u.factor;
    return { grams, formula: `${fmt(p.qty)} ${u.label} = ${fmt(grams, 0)} g` };
  }
  if (u.kind === 'volume') {
    const dens = densityOf(ingredient);
    if (dens === null) return null;
    const ml = p.qty * u.factor;
    const grams = ml * dens;
    return {
      grams,
      formula: `${fmt(p.qty)} ${u.label} = ${fmt(ml, 0)} ml × ${fmt(dens, 2)} g/ml`,
    };
  }
  return null;
}

/** Eigenes Gewicht in Klammern, z. B. „1 Dose (140 g)“ oder „2 Zehen (je 5 g)“. */
const PAREN_WEIGHT = /\(\s*(?:je\s+|ca\.?\s*)?(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l)\s*\)/i;

/**
 * Gewicht aus der Klammer, bezogen auf ein Stück (eine Dose, eine Zehe) und mal Anzahl genommen:
 * „2 Dosen (140 g)“ = 280 g. So stimmt es auch, wenn die Portionen die Anzahl ändern. null ohne Klammer.
 */
export function parenGrams(amount: string): number | null {
  const m = amount.match(PAREN_WEIGHT);
  if (!m) return null;
  const unit = m[2].toLowerCase();
  const one = Number(m[1].replace(',', '.')) * (unit === 'kg' || unit === 'l' ? 1000 : 1);
  const rest = parseAmount(amount.replace(PAREN_WEIGHT, ' '));
  // „500 g (0,5 kg)“: vorne steht schon ein Gewicht, die Klammer ist nur eine Erklärung
  if (['g', 'kg', 'ml', 'l'].includes(rest.unit)) return null;
  return one * (rest.qty ?? 1);
}

/**
 * Anzeige einer Menge (Zutatenliste, Lesemodus und Einkaufsliste): in Gramm, die Angabe aus dem Rezept
 * in Klammern dahinter. Schon Gramm bleibt unverändert, was sich nicht umrechnen lässt, auch.
 */
export function shopAmount(amount: string, ingredient: string): string {
  const own = parenGrams(amount);
  if (own !== null) {
    const rest = amount.replace(PAREN_WEIGHT, ' ').replace(/\s+/g, ' ').trim();
    const g = `${fmt(own, own >= 10 ? 0 : 1)} g`;
    return rest ? `${g} (${rest})` : g;
  }
  const p = parseAmount(amount);
  if (!p.unit || p.unit === 'g') return amount;
  const g = toGrams(amount, ingredient);
  return g ? `${fmt(g.grams, g.grams >= 10 ? 0 : 1)} g (${amount})` : amount;
}

/** Zahl plus Wort im Fließtext, z. B. „2 TL“ (ohne Satzpunkt am Wortende). */
const AMOUNT_IN_TEXT = /(\d+(?:[.,]\d+)?|\d+\/\d+)\s+([A-Za-zÄÖÜäöüß]+)/g;

/**
 * Mengen im Fließtext (Zubereitung) wie in der Tabelle umrechnen: „2 TL Salz“ wird zu „12 g (2 TL) Salz“.
 * Die Zutat wird aus den drei Wörtern hinter der Menge erkannt. Was sich nicht umrechnen lässt, bleibt gleich.
 */
export function convertInText(text: string): string {
  return text.replace(AMOUNT_IN_TEXT, (match, num: string, word: string, offset: number, full: string) => {
    const amount = `${num} ${word}`;
    const after = full.slice(offset + match.length);
    const ingredient = after.split(/[.,;:!?\n]/)[0].trim().split(/\s+/).slice(0, 3).join(' ');
    const shown = shopAmount(amount, ingredient);
    return shown === amount ? match : shown;
  });
}

/** Zahl ohne Tausenderpunkt, damit sie wieder lesbar ist („1500“, nicht „1.500“). */
const plain = (n: number, digits: number) => n.toLocaleString('de-DE', { maximumFractionDigits: digits, useGrouping: false });

/** Menge um einen Faktor verändern (Portionen): Zahl ändert sich, Einheit und Schreibweise bleiben. */
export function scaleAmount(amount: string, factor: number): string {
  const p = parseAmount(amount);
  if (factor === 1 || p.qty === null) return amount;
  const n = p.qty * factor;
  return amount.replace(p.numText, plain(n, n >= 10 ? 0 : 1));
}

/** Mengen im Fließtext mit einer bekannten Einheit um einen Faktor verändern („2 TL“ → „4 TL“). */
export function scaleInText(text: string, factor: number): string {
  if (factor === 1) return text;
  return text.replace(AMOUNT_IN_TEXT, (match, num: string, word: string) => {
    const p = parseAmount(`${num} ${word}`);
    return p.unit ? scaleAmount(`${num} ${word}`, factor) : match;
  });
}

/** Spalte mit dem Namen der Zutat (Zutat/Artikel/… oder letzte Spalte). */
export function nameColumn(header: string[]): number {
  const h = header.map((x) => x.trim().toLowerCase());
  const i = h.findIndex((x) => /zutat|artikel|produkt|name/.test(x));
  return i >= 0 ? i : h.length - 1;
}
