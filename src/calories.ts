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
  ['saure sahne', 118],
  ['hühner brühe', 5],
  ['hühnerbrühe', 5],
  ['rinder brühe', 4],
  ['rinderbrühe', 4],
  ['brühe', 2],
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
  ['tomatenmark', 95],
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
  ['mais', 83, 0, 140],
  ['kichererbsen', 120, 0, 240],
  ['erbsen', 80, 0, 280],
  ['kidney', 99, 0, 250],
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

/** Nährwerte je 100 g (Gramm, Energie in kcal und kJ). */
export interface Nutrition {
  kj: number;
  kcal: number;
  fat: number;
  /** davon gesättigte Fettsäuren */
  saturated: number;
  carbs: number;
  /** davon Zucker */
  sugar: number;
  protein: number;
  salt: number;
  fiber?: number;
}

/**
 * Nährwerte von Etiketten, die Kevin fotografiert hat (genauer als die Richtwerte oben).
 * Schlüssel = Suchwort aus FOODS; dessen kcal muss mit dem Etikett übereinstimmen.
 */
export const LABELS: Record<string, Nutrition> = {
  // REWE, Saure Sahne 10 %
  'saure sahne': { kj: 491, kcal: 118, fat: 10, saturated: 6.9, carbs: 3.5, sugar: 3.5, protein: 3, salt: 0.1 },
  // „<0,5 g“ auf Etiketten ist als 0,5 g eingetragen (Obergrenze)
  // Gemüsebrühe (Glas, Pulver), Werte je 100 ml zubereitet
  brühe: { kj: 9, kcal: 2, fat: 0, saturated: 0, carbs: 0.5, sugar: 0.5, fiber: 0.5, protein: 0, salt: 1 },
  // Hühner Brühe (Glas), Werte je 100 ml zubereitet
  hühnerbrühe: { kj: 21, kcal: 5, fat: 0.1, saturated: 0.1, carbs: 0.8, sugar: 0.3, fiber: 0.5, protein: 0.2, salt: 1.1 },
  'hühner brühe': { kj: 21, kcal: 5, fat: 0.1, saturated: 0.1, carbs: 0.8, sugar: 0.3, fiber: 0.5, protein: 0.2, salt: 1.1 },
  // Rinderbrühe (Glas), Werte je 100 ml zubereitet
  rinderbrühe: { kj: 18, kcal: 4, fat: 0.1, saturated: 0.1, carbs: 0.6, sugar: 0.1, fiber: 0.5, protein: 0.2, salt: 0.82 },
  'rinder brühe': { kj: 18, kcal: 4, fat: 0.1, saturated: 0.1, carbs: 0.6, sugar: 0.1, fiber: 0.5, protein: 0.2, salt: 0.82 },
  // Kidneybohnen (Dose), Werte je 100 g abgetropft
  kidney: { kj: 415, kcal: 99, fat: 0.6, saturated: 0, carbs: 13, sugar: 0, fiber: 5.8, protein: 7.4, salt: 0.42 },
  // Tomaten gehackt (Dose); gilt auch für frische Tomaten (kaum Unterschied)
  tomate: { kj: 86, kcal: 20, fat: 0.5, saturated: 0.1, carbs: 3, sugar: 3, fiber: 1.1, protein: 1.3, salt: 0.05 },
  // ja! Mais (Dose), Werte je 100 g abgetropft
  // ja! Tomatenmark (zweifach konzentriert), Werte je 100 g
  tomatenmark: { kj: 402, kcal: 95, fat: 1, saturated: 0.2, carbs: 15, sugar: 15, fiber: 3.1, protein: 4.8, salt: 0.6 },
  mais: { kj: 349, kcal: 83, fat: 1.8, saturated: 0.4, carbs: 12, sugar: 6.3, fiber: 3.9, protein: 2.6, salt: 0.4 },
};

/**
 * Fett, Kohlenhydrate, Eiweiß je 100 g (Richtwerte) für alle Lebensmittel aus FOODS ohne Etikett.
 * Schlüssel = Suchwort aus FOODS. Gewürze und Wasser (0 kcal) brauchen keinen Eintrag.
 */
const MACROS: Record<string, [fat: number, carbs: number, protein: number]> = {
  fond: [0.3, 0.5, 1.5],
  schokolade: [31, 57, 6],
  kuvertüre: [32, 50, 7],
  'grüne bohnen': [0.2, 5, 2],
  'crème fraîche': [30, 3, 2.5],
  'creme fraiche': [30, 3, 2.5],
  fraîche: [30, 3, 2.5],
  fraiche: [30, 3, 2.5],
  erdnussbutter: [50, 15, 25],
  erdnussmus: [50, 15, 25],
  buttermilch: [0.5, 4, 3.4],
  butterschmalz: [99.8, 0, 0],
  butterkeks: [12, 74, 7.5],
  kokosmilch: [18, 3, 2],
  kondensmilch: [7.5, 10, 7],
  kochsahne: [15, 4, 3],
  cremefine: [9, 6, 3],
  kochcreme: [9, 6, 3],
  tzatziki: [10, 4, 4],
  zaziki: [10, 4, 4],
  pesto: [45, 6, 5],
  hummus: [20, 14, 8],
  schlagsahne: [32, 3, 2.4],
  schmand: [24, 3.5, 2.6],
  frischkäse: [22, 4, 6],
  hüttenkäse: [4, 3, 12],
  mascarpone: [44, 4, 4],
  mozzarella: [19, 1, 18],
  burrata: [22, 1, 15],
  parmesan: [29, 0, 32],
  pecorino: [28, 0, 30],
  feta: [21, 1, 16],
  halloumi: [25, 2, 21],
  ricotta: [11, 3, 9],
  magerquark: [0.3, 4, 12],
  quark: [5, 3.5, 12],
  skyr: [0.2, 4, 11],
  joghurt: [3.5, 4.5, 4],
  gouda: [29, 0, 25],
  emmentaler: [29, 0, 28],
  cheddar: [33, 1, 25],
  käse: [28, 1, 25],
  eigelb: [27, 1, 16],
  eiweiß: [0, 1, 11],
  '=eier': [10, 1, 13],
  '=ei': [10, 1, 13],
  butter: [82, 0.6, 0.7],
  margarine: [80, 0.5, 0.2],
  schmalz: [100, 0, 0],
  milch: [3.5, 4.8, 3.4],
  sahne: [31, 3, 2.5],
  mayonnaise: [75, 2, 1],
  mayo: [75, 2, 1],
  nutella: [31, 57, 6],
  nougat: [31, 57, 6],
  lotus: [37, 57, 3],
  öl: [100, 0, 0],
  oliven: [14, 2, 1],
  paniermehl: [3, 72, 10],
  semmelbrösel: [3, 72, 10],
  mehl: [1, 72, 10],
  stärke: [0, 86, 0.5],
  grieß: [1, 70, 11],
  haferflocken: [7, 59, 13],
  reisnudeln: [1, 80, 6],
  preiselbeer: [0.5, 45, 0.5],
  reis: [0.6, 77, 7],
  nudeln: [1.5, 71, 12],
  spaghetti: [1.5, 71, 12],
  penne: [1.5, 71, 12],
  fusilli: [1.5, 71, 12],
  tagliatelle: [1.5, 71, 12],
  makkaroni: [1.5, 71, 12],
  lasagne: [1.5, 71, 12],
  pasta: [1.5, 71, 12],
  gnocchi: [0.5, 32, 4],
  couscous: [2, 70, 12],
  bulgur: [1.5, 70, 12],
  quinoa: [6, 64, 14],
  blätterteig: [25, 33, 5],
  pizzateig: [4, 48, 8],
  teig: [12, 45, 7],
  toast: [4, 48, 8],
  brötchen: [2, 55, 9],
  brot: [2, 45, 8],
  tortilla: [7, 50, 8],
  wrap: [7, 50, 8],
  hefe: [1, 8, 12],
  backpulver: [0, 25, 0],
  puderzucker: [0, 100, 0],
  vanillezucker: [0, 100, 0],
  zucker: [0, 100, 0],
  honig: [0, 80, 0.4],
  sirup: [0, 65, 0],
  marmelade: [0, 60, 0.4],
  konfitüre: [0, 60, 0.4],
  kakao: [21, 11, 20],
  keks: [20, 68, 6],
  mandel: [53, 6, 24],
  haselnuss: [61, 11, 15],
  walnuss: [65, 11, 15],
  erdnuss: [49, 12, 26],
  cashew: [44, 30, 18],
  pinienkern: [68, 13, 14],
  sesam: [50, 10, 18],
  kokosraspel: [64, 7, 6],
  nüsse: [55, 10, 18],
  rosinen: [0.5, 69, 2.5],
  hackfleisch: [20, 0, 18],
  rinderhack: [15, 0, 20],
  '=hack': [20, 0, 18],
  hähnchen: [3, 0, 23],
  hühnchen: [3, 0, 23],
  huhn: [7, 0, 20],
  pute: [1.5, 0, 23],
  rind: [10, 0, 21],
  steak: [10, 0, 21],
  schwein: [13, 0, 20],
  speck: [45, 0, 15],
  bacon: [45, 0, 15],
  guanciale: [65, 0, 10],
  pancetta: [42, 0, 16],
  schinken: [10, 1, 20],
  salami: [34, 1, 23],
  chorizo: [38, 2, 24],
  würstchen: [24, 1, 13],
  wurst: [24, 1, 13],
  lachs: [13, 0, 20],
  thunfisch: [1, 0, 26],
  garnelen: [1, 0, 19],
  kabeljau: [0.7, 0, 18],
  fisch: [3, 0, 18],
  tofu: [7, 2, 13],
  pulver: [10, 40, 12],
  süßkartoffel: [0.1, 20, 1.6],
  kartoffel: [0.1, 15, 2],
  frühlingszwiebel: [0.3, 5, 1.8],
  lauchzwiebel: [0.3, 5, 1.8],
  zwiebel: [0.1, 8, 1.2],
  knoblauch: [0.5, 28, 6],
  passierte: [0.2, 5, 1.5],
  passata: [0.2, 5, 1.5],
  paprika: [0.3, 5, 1],
  karotte: [0.2, 8, 0.9],
  möhre: [0.2, 8, 0.9],
  zucchini: [0.3, 2, 1.5],
  aubergine: [0.2, 3, 1.2],
  brokkoli: [0.4, 3, 3.5],
  blumenkohl: [0.3, 2.5, 2],
  spinat: [0.4, 1, 2.9],
  eisberg: [0.2, 2, 1],
  salat: [0.2, 2, 1],
  gurke: [0.1, 2, 0.6],
  champignon: [0.3, 0.5, 3],
  pilze: [0.3, 0.5, 3],
  kichererbsen: [2.5, 15, 7],
  erbsen: [0.5, 11, 6],
  bohnen: [0.5, 14, 7],
  linsen: [1.5, 48, 24],
  lauch: [0.3, 3, 2],
  porree: [0.3, 3, 2],
  sellerie: [0.2, 2, 1],
  kürbis: [0.1, 5, 1],
  avocado: [15, 1, 2],
  ingwer: [0.8, 15, 1.8],
  chili: [0.4, 7, 2],
  rotkohl: [0.2, 4, 1.5],
  kohl: [0.2, 4, 1.5],
  sauerkraut: [0.3, 1, 1.5],
  apfel: [0.2, 11, 0.3],
  banane: [0.2, 20, 1.1],
  zitrone: [0.3, 3, 0.7],
  limette: [0.3, 3, 0.7],
  orange: [0.2, 9, 1],
  erdbeer: [0.4, 5.5, 0.7],
  himbeer: [0.3, 5, 1.3],
  heidelbeer: [0.6, 7, 0.6],
  blaubeer: [0.6, 7, 0.6],
  beeren: [0.4, 6, 1],
  ananas: [0.1, 12, 0.5],
  mango: [0.4, 13, 0.8],
  essig: [0, 0.5, 0],
  wein: [0, 2.5, 0.1],
  bier: [0, 3, 0.5],
  sojasauce: [0, 5, 8],
  sojasoße: [0, 5, 8],
  ketchup: [0.2, 24, 1.2],
  senf: [4, 5, 6],
  saft: [0.1, 10, 0.4],
};

/** Fett, Kohlenhydrate, Eiweiß je 100 g zu einem Suchwort (Etikett vor Richtwert). */
export function macrosOf(key: string): { fat: number; carbs: number; protein: number } | null {
  const l = LABELS[key];
  if (l) return { fat: l.fat, carbs: l.carbs, protein: l.protein };
  const m = MACROS[key];
  return m ? { fat: m[0], carbs: m[1], protein: m[2] } : null;
}

/** Alle Suchwörter, für die Tests. */
export const FOOD_KEYS = (): { key: string; kcal: number }[] => FOODS.map(([key, kcal]) => ({ key, kcal }));

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
  const found = (hit: (typeof FOODS)[number] | undefined) =>
    hit ? { key: hit[0], kcal: hit[1], piece: hit[2] || 0, can: hit[3] || 0 } : null;
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
  /** Gramm fürs ganze Gericht (nur Zutaten mit bekannten Werten) */
  fat: number;
  carbs: number;
  protein: number;
  /** mit eigenen kcal in Klammern: zählen bei den Kalorien, aber nicht bei Fett, Kohlenhydraten, Eiweiß */
  kcalOnly: string[];
  /** Zutaten, die nicht in der Tabelle stehen (Gewicht wäre bekannt oder egal) */
  unknown: string[];
  /** Zutaten, deren Gewicht sich nicht bestimmen lässt */
  noWeight: string[];
}

/** Name ohne eigene Angaben in Klammern, für die Anzeige. */
const shortName = (name: string) => name.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim() || name;

export function estimateCalories(rows: { name: string; amount: string }[]): CalorieEstimate {
  let kcal = 0;
  let fat = 0;
  let carbs = 0;
  let protein = 0;
  const unknown: string[] = [];
  const noWeight: string[] = [];
  const kcalOnly: string[] = [];
  for (const r of rows) {
    const own = ownKcal(r.name);
    const food = foodOf(r.name);
    const per100 = own ?? food?.kcal ?? null;
    if (per100 === 0) continue; // Salz, Gewürze, Wasser
    const g = gramsOf(r.amount, r.name);
    if (per100 === null) unknown.push(shortName(r.name));
    else if (g === null) noWeight.push(shortName(r.name));
    else {
      kcal += (g * per100) / 100;
      // eigene kcal gehören zu einem anderen Produkt: dessen Fett usw. kennen wir nicht
      const m = own === null && food ? macrosOf(food.key) : null;
      if (m) {
        fat += (g * m.fat) / 100;
        carbs += (g * m.carbs) / 100;
        protein += (g * m.protein) / 100;
      } else kcalOnly.push(shortName(r.name));
    }
  }
  return { kcal, fat, carbs, protein, kcalOnly, unknown, noWeight };
}
