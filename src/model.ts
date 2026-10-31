export function newId(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export type NoteType = 'note' | 'recipe';

export interface CheckItem {
  id: string;
  text: string;
  done: boolean;
}

/** Jede Notiz besteht aus Blöcken mit eigener ID (später: Live-Sync pro Block). */
export type Block =
  | { kind: 'heading'; id: string; text: string; level: number }
  | { kind: 'text'; id: string; text: string }
  | { kind: 'checklist'; id: string; items: CheckItem[] }
  | { kind: 'table'; id: string; header: string[]; rows: string[][] }
  /** `done` ist der Koch-Fortschritt (Schritt abgehakt), gleich lang wie `steps`; steht nicht im Markdown */
  | { kind: 'steps'; id: string; steps: string[]; done?: boolean[] }
  | { kind: 'image'; id: string; source: string; caption: string };

export interface Note {
  id: string;
  title: string;
  type: NoteType;
  servings: number | null;
  blocks: Block[];
  updatedAt: string; // ISO
}

export const mk = {
  note(p: Partial<Note> = {}): Note {
    return {
      id: newId(),
      title: '',
      type: 'note',
      servings: null,
      blocks: [],
      updatedAt: new Date().toISOString(),
      ...p,
    };
  },
  heading: (text = '', level = 2): Block => ({ kind: 'heading', id: newId(), text, level }),
  text: (text = ''): Block => ({ kind: 'text', id: newId(), text }),
  item: (text = '', done = false): CheckItem => ({ id: newId(), text, done }),
  checklist: (items: CheckItem[] = [mk.item()]): Block => ({ kind: 'checklist', id: newId(), items }),
  table: (header: string[], rows: string[][]): Block => ({ kind: 'table', id: newId(), header, rows }),
  steps: (steps: string[] = ['']): Block => ({ kind: 'steps', id: newId(), steps }),
  image: (source: string, caption = ''): Block => ({ kind: 'image', id: newId(), source, caption }),
};

/** Vorlage für ein neues Rezept. */
export function newRecipe(): Note {
  return mk.note({
    type: 'recipe',
    servings: 4,
    blocks: [
      mk.heading('Zutaten'),
      mk.table(['Menge', 'Einheit', 'Zutat'], [['', '', '']]),
      mk.heading('Zubereitung'),
      mk.steps(['']),
    ],
  });
}

/** Ein Eintrag der Einkaufsliste. `home` = habe ich zuhause, `bought` = im Laden gekauft. */
export interface ShopItem {
  id: string;
  name: string;
  amount: string;
  /** null = eigener Eintrag, sonst ID des Rezepts, aus dem er stammt */
  recipeId: string | null;
  recipeTitle: string;
  home: boolean;
  bought: boolean;
  addedAt: string; // ISO
}

export const isDone = (i: ShopItem) => i.home || i.bought;
