import { useEffect, useState } from 'preact/hooks';
import { type Note, type ShopItem, newId } from './model';
import { demoNotes } from './demo';
import { mergeRecipe } from './shopping';
import { trash } from './trash';

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
export class Collection<T extends { id: string }> {
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

export interface NoteHooks {
  saved(n: Note): void;
  removed(id: string): void;
}

export class NoteStore extends Collection<Note> {
  /** Der Sync hängt sich hier ein, um lokale Änderungen mitzubekommen. */
  hooks: NoteHooks[] = [];
  constructor(key = 'notiz.notes.v2', demo = true) {
    super(key);
    if (demo && !this.hadData && import.meta.env.VITE_DEMO) for (const n of demoNotes()) this.items.set(n.id, n);
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
    this.hooks.forEach((h) => h.saved(note));
  }
  /** Löschen: die Notiz wandert in den Papierkorb (30 Tage wiederherstellbar). */
  remove(id: string) {
    const note = this.items.get(id);
    this.items.delete(id);
    this.persist();
    if (note) trash.add(note);
    this.hooks.forEach((h) => h.removed(id));
  }
  /** Sofort verwerfen, ohne Papierkorb (z. B. leere Entwürfe). */
  discard(id: string) {
    this.items.delete(id);
    this.persist();
    this.hooks.forEach((h) => h.removed(id));
  }
  /** Änderung vom Sync: speichern, ohne wieder hochzuladen. */
  applyRemote(note: Note) {
    this.items.set(note.id, note);
    this.persist();
  }
  removeRemote(id: string) {
    const note = this.items.get(id);
    if (this.items.delete(id)) {
      this.persist();
      if (note) trash.add(note);
    }
  }
}

export interface ShopHooks {
  saved(i: ShopItem): void;
  removed(id: string): void;
}

export class ShopStore extends Collection<ShopItem> {
  hooks: ShopHooks[] = [];
  constructor(key = 'notiz.shopping.v1') {
    super(key);
  }
  get(id: string) {
    return this.items.get(id);
  }
  applyRemote(item: ShopItem) {
    this.items.set(item.id, item);
    this.persist();
  }
  removeRemote(id: string) {
    if (this.items.delete(id)) this.persist();
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
    if (r.added.length || r.updated.length) {
      this.persist();
      for (const i of [...r.added, ...r.updated]) this.hooks.forEach((h) => h.saved(i));
    }
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
    this.hooks.forEach((h) => h.saved(item));
    return item;
  }
  /** Nach direkter Änderung eines Postens aufrufen. */
  save(item: ShopItem) {
    this.items.set(item.id, item);
    this.persist();
    this.hooks.forEach((h) => h.saved(item));
  }
  remove(id: string) {
    this.items.delete(id);
    this.persist();
    this.hooks.forEach((h) => h.removed(id));
  }
  removeWhere(pred: (i: ShopItem) => boolean) {
    const gone = [...this.items.values()].filter(pred);
    for (const i of gone) this.items.delete(i.id);
    this.persist();
    for (const i of gone) this.hooks.forEach((h) => h.removed(i.id));
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
  useEffect(() => {
    const off = c.subscribe(() => set((v) => v + 1));
    set((v) => v + 1); // Änderungen zwischen erstem Zeichnen und Anmeldung nachholen
    return off;
  }, []);
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

/** Rendert neu, wenn sich Notizen ändern, und liefert eine einzelne Notiz (auch wenn der Sync sie ersetzt). */
export function useNote(id: string): Note | undefined {
  useCollection(store);
  return store.get(id);
}
