import { useEffect, useState } from 'preact/hooks';
import { type Note, type ShopItem, newId } from './model';
import { demoNotes } from './demo';
import { mergeRecipe } from './shopping';

/** localStorage kann fehlen oder Fehler werfen (z. B. im eingebetteten Vorschau-Rahmen): dann nur im Arbeitsspeicher. */
const mem = new Map<string, string>();
const storage = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return mem.get(k) ?? null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      mem.set(k, v);
    }
  },
};

/** Lokale Sammlung mit Speichern und Abonnenten (local-first). Später kommt Firestore über dieselbe Schnittstelle dazu. */
class Collection<T extends { id: string }> {
  protected items = new Map<string, T>();
  private listeners = new Set<() => void>();
  /** true, wenn beim Start schon gespeicherte Daten da waren */
  protected hadData = false;

  constructor(private key: string) {
    try {
      const raw = storage.get(key);
      if (raw) {
        this.hadData = true;
        for (const n of JSON.parse(raw) as T[]) this.items.set(n.id, n);
      }
    } catch {
      /* beschädigter Speicher: leer starten */
    }
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  protected persist() {
    storage.set(this.key, JSON.stringify([...this.items.values()]));
    this.listeners.forEach((l) => l());
  }
}

class NoteStore extends Collection<Note> {
  constructor() {
    super('notiz.notes.v2');
    if (!this.hadData && import.meta.env.VITE_DEMO) for (const n of demoNotes()) this.items.set(n.id, n);
  }
  all(): Note[] {
    return [...this.items.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  get(id: string) {
    return this.items.get(id);
  }
  save(note: Note) {
    note.updatedAt = new Date().toISOString();
    this.items.set(note.id, note);
    this.persist();
  }
  remove(id: string) {
    this.items.delete(id);
    this.persist();
  }
}

class ShopStore extends Collection<ShopItem> {
  constructor() {
    super('notiz.shopping.v1');
  }
  all(): ShopItem[] {
    return [...this.items.values()].sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  }
  forRecipe(id: string) {
    return this.all().filter((i) => i.recipeId === id);
  }
  /** Zutaten eines Rezepts übernehmen (ohne Doppelte). */
  addFromRecipe(note: Note) {
    const r = mergeRecipe(this.all(), note);
    for (const i of [...r.added, ...r.updated]) this.items.set(i.id, i);
    if (r.added.length || r.updated.length) this.persist();
    return r;
  }
  addCustom(): ShopItem {
    const item: ShopItem = {
      id: newId(),
      name: '',
      amount: '',
      recipeId: null,
      recipeTitle: '',
      home: false,
      bought: false,
      addedAt: new Date().toISOString(),
    };
    this.items.set(item.id, item);
    this.persist();
    return item;
  }
  /** Nach direkter Änderung eines Postens aufrufen. */
  save(item: ShopItem) {
    this.items.set(item.id, item);
    this.persist();
  }
  remove(id: string) {
    this.items.delete(id);
    this.persist();
  }
  removeWhere(pred: (i: ShopItem) => boolean) {
    for (const i of [...this.items.values()]) if (pred(i)) this.items.delete(i.id);
    this.persist();
  }
  /** Zeigt die Demo-Liste in der Vorschau. */
  seedDemo(notes: Note[]) {
    const c = notes.find((n) => n.title === 'Spaghetti Carbonara');
    if (!c) return;
    const { added } = this.addFromRecipe(c);
    if (added[0]) added[0].home = true; // Spaghetti: zuhause
    if (added[1]) added[1].bought = true; // Guanciale: gekauft
    this.persist();
  }
}

export const store = new NoteStore();
export const shop = new ShopStore();
if (import.meta.env.VITE_DEMO && shop.all().length === 0 && !storage.get('notiz.shopping.v1')) shop.seedDemo(store.all());

function useCollection<C extends Collection<{ id: string }>>(c: C): void {
  const [, set] = useState(0);
  useEffect(() => c.subscribe(() => set((v) => v + 1)), []);
}

/** Rendert neu, sobald sich Notizen ändern. */
export function useNotes(): Note[] {
  useCollection(store);
  return store.all();
}

/** Rendert neu, sobald sich die Einkaufsliste ändert. */
export function useShopping(): ShopItem[] {
  useCollection(shop);
  return shop.all();
}
