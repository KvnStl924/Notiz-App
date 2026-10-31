import { type Block, type Note, type ShopItem, newId } from './model';

export interface Ingredient {
  name: string;
  amount: string;
}

type Table = Extract<Block, { kind: 'table' }>;

/** Findet die Zutaten-Tabelle: bevorzugt die erste Tabelle nach einer Überschrift mit „Zutat“, sonst die erste Tabelle. */
function ingredientTable(note: Note): Table | undefined {
  for (let i = 0; i < note.blocks.length; i++) {
    const b = note.blocks[i];
    if (b.kind === 'heading' && /zutat/i.test(b.text)) {
      const t = note.blocks.slice(i + 1).find((x): x is Table => x.kind === 'table');
      if (t) return t;
    }
  }
  return note.blocks.find((b): b is Table => b.kind === 'table');
}

/**
 * Liest Zutaten aus der Tabelle. Spalten werden an ihren Überschriften erkannt
 * (Zutat/Artikel, Menge/Anzahl, Einheit). Fehlen die, gilt: letzte Spalte = Name.
 */
export function ingredientsOf(note: Note): Ingredient[] {
  const t = ingredientTable(note);
  if (!t) return [];
  const h = t.header.map((x) => x.trim().toLowerCase());
  const find = (re: RegExp) => h.findIndex((x) => re.test(x));

  const name = find(/zutat|artikel|produkt|name/) >= 0 ? find(/zutat|artikel|produkt|name/) : h.length - 1;
  let qty = find(/menge|anzahl/);
  let unit = find(/einheit/);
  const rest = h.map((_, i) => i).filter((i) => i !== name && i !== qty && i !== unit);
  if (qty < 0 && rest.length) qty = rest.shift()!;
  if (unit < 0 && rest.length) unit = rest.shift()!;

  const seen = new Set<string>();
  const out: Ingredient[] = [];
  for (const row of t.rows) {
    const n = (row[name] ?? '').trim();
    if (!n) continue;
    const amount = [qty, unit]
      .filter((i) => i >= 0)
      .map((i) => (row[i] ?? '').trim())
      .filter(Boolean)
      .join(' ');
    const key = n.toLowerCase() + '|' + amount.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: n, amount });
  }
  return out;
}

export interface MergeResult {
  added: ShopItem[];
  /** bestehende Posten, deren Menge angepasst wurde */
  updated: ShopItem[];
  unchanged: number;
  found: number;
}

/**
 * Überträgt die Zutaten eines Rezepts auf die Einkaufsliste, ohne Doppelte anzulegen.
 * Bereits vorhandene Zutaten (gleicher Name) behalten ihre Häkchen; nur die Menge wird
 * angepasst, solange sie noch nicht gekauft ist.
 */
export function mergeRecipe(existing: ShopItem[], note: Note, now = new Date()): MergeResult {
  const ing = ingredientsOf(note);
  const mine = existing.filter((i) => i.recipeId === note.id);
  const res: MergeResult = { added: [], updated: [], unchanged: 0, found: ing.length };

  for (const g of ing) {
    const hit = mine.find((i) => i.name.toLowerCase() === g.name.toLowerCase());
    if (!hit) {
      res.added.push({
        id: newId(),
        name: g.name,
        amount: g.amount,
        recipeId: note.id,
        recipeTitle: note.title,
        home: false,
        bought: false,
        addedAt: now.toISOString(),
      });
    } else if (hit.amount !== g.amount && !hit.bought) {
      hit.amount = g.amount;
      res.updated.push(hit);
    } else {
      res.unchanged++;
    }
  }
  return res;
}
