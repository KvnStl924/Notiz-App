/**
 * Kalorien eines ganzen Gerichts, grob geschätzt (plus/minus, nicht auf die Kalorie genau).
 *
 * Gewicht je Zutat, in dieser Reihenfolge:
 *   1. Gramm in Klammern hinter der Menge, z. B. „1 Dose (140 g)“: Gewicht von einem Stück, mal Anzahl
 *   2. Gewicht oder Volumen (g, kg, ml, l, TL, EL, Tasse) wie bei der Gramm-Umrechnung
 *   3. Stück, Zehe oder Dose: Durchschnittsgewicht aus der Tabelle unten
 * Kalorien je 100 g kommen aus der Tabelle unten (Richtwerte, roh bzw. ungekocht).
 */
import { parenGrams, parseAmount, toGrams, unitOf } from './units';

/**
 * Lebensmittel: Suchwort, kcal je 100 g, Gewicht eines Stücks (g), Gewicht einer Dose (g, abgetropft).
 * Ein Suchwort passt, wenn ein Wort der Zutat damit anfängt oder (bis auf eine Mehrzahl-Endung) endet:
 * „Weizenmehl“ → „mehl“, „Kirschtomaten“ → „tomate“. „=“ vorne: nur das ganze Wort („=ei“, nicht „Salbei“).
 * Suchwörter mit Leerzeichen müssen als Ganzes vorkommen. Reihenfolge wichtig: erster Treffer gilt,
 * daher Genaueres zuerst („tomatenmark“ vor „tomate“, „süßkartoffel“ vor „kartoffel“).
 */
const FOODS: [string, number, number?, number?][] = [
  // Fertiges und Zusammengesetztes zuerst
  ['saure sahne', 115],
  ['brühe', 5],
  ['fond', 10],
  ['schokolade', 540],
  ['kuvertüre', 540],
  ['chiliflocken', 0],
  ['grüne bohnen', 30, 0, 220],
  ['crème fraîche', 290],
  ['creme fraiche', 290],
  ['fraîche', 290],
  ['fraiche', 290],
  ['erdnussbutter', 600],
  ['erdnussmus', 600],
  ['buttermilch', 40],
  ['butterschmalz', 900],
  ['butterkeks', 440],
  ['kokosmilch', 180, 0, 400],
  ['kondensmilch', 130],
  ['kochsahne', 170],
  ['cremefine', 120],
  ['kochcreme', 120],
  ['tzatziki', 120],
  ['zaziki', 120],
  ['pesto', 450],
  ['hummus', 300],
  ['schlagsahne', 310],
  ['schmand', 240],
  ['frischkäse', 250],
  ['hüttenkäse', 100],
  ['mascarpone', 430],
  ['mozzarella', 250, 125],
  ['burrata', 260, 125],
  ['parmesan', 400],
  ['pecorino', 390],
  ['feta', 270, 200],
  ['halloumi', 320, 225],
  ['ricotta', 150],
  ['magerquark', 70],
  ['quark', 110],
  ['skyr', 63],
  ['joghurt', 65],
  ['gouda', 360],
  ['emmentaler', 380],
  ['cheddar', 400],
  ['käse', 350],
  ['eigelb', 320, 18],
  ['eiweiß', 50, 33],
  ['=eier', 155, 60],
  ['=ei', 155, 60],
  ['butter', 740],
  ['margarine', 720],
  ['schmalz', 900],
  ['milch', 64],
  ['sahne', 310],
  ['mayonnaise', 680],
  ['mayo', 680],
  ['nutella', 540],
  ['nougat', 540],
  ['lotus', 580],

  // Öl vor Oliven („Olivenöl“)
  ['öl', 880],
  ['oliven', 140],

  // Getreide, Teig, Backzutaten
  ['paniermehl', 360],
  ['semmelbrösel', 360],
  ['mehl', 350],
  ['stärke', 350],
  ['grieß', 350],
  ['haferflocken', 370],
  ['reisnudeln', 360],
  ['preiselbeer', 190],
  ['reis', 350],
  ['nudeln', 355],
  ['spaghetti', 355],
  ['penne', 355],
  ['fusilli', 355],
  ['tagliatelle', 355],
  ['makkaroni', 355],
  ['lasagne', 355],
  ['pasta', 355],
  ['gnocchi', 150],
  ['couscous', 360],
  ['bulgur', 350],
  ['quinoa', 370],
  ['blätterteig', 400],
  ['pizzateig', 260],
  ['teig', 300],
  ['toast', 260, 25],
  ['brötchen', 270, 60],
  ['brot', 250],
  ['tortilla', 300, 60],
  ['wrap', 300, 60],
  ['hefe', 100],
  ['backpulver', 100],
  ['puderzucker', 400],
  ['vanillezucker', 400, 8],
  ['zucker', 400],
  ['honig', 305],
  ['sirup', 260],
  ['marmelade', 250],
  ['konfitüre', 250],
  ['kakao', 360],
  ['keks', 480],

  // Nüsse und Samen
  ['mandel', 600],
  ['haselnuss', 640],
  ['walnuss', 690],
  ['erdnuss', 590],
  ['cashew', 580],
  ['pinienkern', 680],
  ['sesam', 570],
  ['kokosraspel', 650],
  ['nüsse', 620],
  ['rosinen', 300],

  // Fleisch, Fisch, Tofu
  ['hackfleisch', 250],
  ['rinderhack', 220],
  ['=hack', 250], // nicht „gehackt“
  ['hähnchen', 130, 180],
  ['hühnchen', 130, 180],
  ['huhn', 130],
  ['pute', 110, 180],
  ['rind', 180],
  ['steak', 180, 200],
  ['schwein', 200],
  ['speck', 500],
  ['bacon', 500],
  ['guanciale', 650],
  ['pancetta', 450],
  ['schinken', 180],
  ['salami', 400],
  ['chorizo', 450],
  ['würstchen', 280, 50],
  ['wurst', 280],
  ['lachs', 200, 125],
  ['thunfisch', 115, 0, 140],
  ['garnelen', 90],
  ['kabeljau', 80],
  ['fisch', 100],
  ['tofu', 120],

  // Gemüse (Gewürzpulver vor Paprika)
  ['pulver', 300],
  ['süßkartoffel', 86, 250],
  ['kartoffel', 75, 150],
  ['frühlingszwiebel', 30, 15],
  ['lauchzwiebel', 30, 15],
  ['zwiebel', 40, 100],
  ['knoblauch', 140, 5],
  ['tomatenmark', 80],
  ['passierte', 30],
  ['passata', 30],
  ['tomate', 20, 100, 400],
  ['paprika', 30, 160],
  ['karotte', 40, 80],
  ['möhre', 40, 80],
  ['zucchini', 20, 250],
  ['aubergine', 25, 300],
  ['brokkoli', 35, 400],
  ['blumenkohl', 25, 600],
  ['spinat', 23],
  ['eisberg', 15, 500],
  ['salat', 15],
  ['gurke', 15, 400],
  ['champignon', 22, 20],
  ['pilze', 22],
  ['mais', 90, 0, 140],
  ['kichererbsen', 120, 0, 240],
  ['erbsen', 80, 0, 280],
  ['kidney', 110, 0, 250],
  ['bohnen', 100, 0, 250],
  ['linsen', 300, 0, 260],
  ['lauch', 30, 200],
  ['porree', 30, 200],
  ['sellerie', 20, 60],
  ['kürbis', 30],
  ['avocado', 160, 150],
  ['ingwer', 80],
  ['chili', 40, 10],
  ['rotkohl', 30],
  ['kohl', 30],
  ['sauerkraut', 20],

  // Obst
  ['apfel', 52, 150],
  ['banane', 90, 120],
  ['zitrone', 30, 100],
  ['limette', 30, 60],
  ['orange', 47, 180],
  ['erdbeer', 32],
  ['himbeer', 40],
  ['heidelbeer', 57],
  ['blaubeer', 57],
  ['beeren', 45],
  ['ananas', 50],
  ['mango', 60, 300],

  // Flüssiges und Soßen (Essig vor Wein: „Weinessig“)
  ['essig', 20],
  ['wein', 80],
  ['bier', 43],
  ['sojasauce', 60],
  ['sojasoße', 60],
  ['ketchup', 110],
  ['senf', 90],
  ['saft', 45],
  ['wasser', 0],

  // Gewürze und Kräuter: kaum Kalorien
  ['salz', 0],
  ['pfeffer', 0],
  ['oregano', 0],
  ['basilikum', 0],
  ['petersilie', 0],
  ['thymian', 0],
  ['rosmarin', 0],
  ['schnittlauch', 0],
  ['dill', 0],
  ['koriander', 0],
  ['zimt', 0],
  ['kümmel', 0],
  ['muskat', 0],
  ['lorbeer', 0],
  ['gewürz', 0],
  ['kräuter', 0],
];

/** Text in Klammern gehört nicht zum Namen („Butter (Keksboden)“ ist Butter). */
const cleanName = (name: string) =>
  name
    .replace(/\([^)]*\)/g, ' ')
    .toLowerCase()
    .trim();

function wordMatches(w: string, key: string): boolean {
  if (key.startsWith('=')) return w === key.slice(1);
  if (w.startsWith(key)) return true;
  const i = w.lastIndexOf(key);
  return i > 0 && w.length - i - key.length <= 2; // „Tomaten“, „Zwiebeln“
}

export function foodOf(name: string) {
  const n = cleanName(name);
  const found = (hit: (typeof FOODS)[number] | undefined) => (hit ? { kcal: hit[1], piece: hit[2] || 0, can: hit[3] || 0 } : null);
  const phrase = FOODS.find(([key]) => key.includes(' ') && n.includes(key));
  if (phrase) return found(phrase);
  // Hauptwort steht meist hinten („Gehackte Tomaten“, „Rote Linsen“): von hinten suchen
  const words = n.split(/[^a-zäöüß]+/).filter(Boolean).reverse();
  for (const w of words) {
    const hit = FOODS.find(([key]) => !key.includes(' ') && wordMatches(w, key));
    if (hit) return found(hit);
  }
  return null;
}

/** Gewicht einer Zutat in Gramm, null wenn es sich nicht bestimmen lässt. */
export function gramsOf(amount: string, name: string): number | null {
  const inParens = parenGrams(amount) ?? parenGrams(name);
  if (inParens !== null) return inParens;
  const plain = amount.replace(/\([^)]*\)/g, ' ').trim();
  const g = toGrams(plain, cleanName(name));
  if (g) return g.grams;
  const p = parseAmount(plain);
  if (p.qty === null) return null;
  const u = unitOf(p.unit);
  if (u.kind === 'volume') return p.qty * u.factor; // ohne bekannte Dichte: 1 ml ≈ 1 g
  if (p.unit === 'Prise') return p.qty * 0.5;
  const food = foodOf(name);
  if (!food) return null;
  if (p.unit === 'Dose') return food.can ? p.qty * food.can : null;
  if (p.unit === '' || p.unit === 'Stück' || p.unit === 'Zehe') return food.piece ? p.qty * food.piece : null;
  return null;
}

/** Eigene Kalorien je 100 g in Klammern hinter der Zutat, z. B. „Rama Cremefine 7 % (90 kcal)“. */
const OWN_KCAL = /\(\s*(?:ca\.?\s*)?(\d+(?:[.,]\d+)?)\s*kcal\s*\)/i;

export function ownKcal(name: string): number | null {
  const m = name.match(OWN_KCAL);
  return m ? Number(m[1].replace(',', '.')) : null;
}

export interface CalorieEstimate {
  kcal: number;
  /** Zutaten, die nicht in der Tabelle stehen (Gewicht wäre bekannt oder egal) */
  unknown: string[];
  /** Zutaten, deren Gewicht sich nicht bestimmen lässt */
  noWeight: string[];
}

/** Name ohne eigene Angaben in Klammern, für die Anzeige. */
const shortName = (name: string) => name.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim() || name;

export function estimateCalories(rows: { name: string; amount: string }[]): CalorieEstimate {
  let kcal = 0;
  const unknown: string[] = [];
  const noWeight: string[] = [];
  for (const r of rows) {
    const per100 = ownKcal(r.name) ?? foodOf(r.name)?.kcal ?? null;
    if (per100 === 0) continue; // Salz, Gewürze, Wasser
    const g = gramsOf(r.amount, r.name);
    if (per100 === null) unknown.push(shortName(r.name));
    else if (g === null) noWeight.push(shortName(r.name));
    else kcal += (g * per100) / 100;
  }
  return { kcal, unknown, noWeight };
}
