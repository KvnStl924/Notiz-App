import { useEffect, useState } from 'preact/hooks';
import { type Note } from './model';

const KEY = 'notiz.notes.v2';

/** Lokaler Speicher (local-first). Später kommt Firestore über dieselbe Schnittstelle dazu. */
class Store {
  private notes = new Map<string, Note>();
  private listeners = new Set<() => void>();
  version = 0;

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) for (const n of JSON.parse(raw) as Note[]) this.notes.set(n.id, n);
    } catch {
      /* beschädigter Speicher: leer starten */
    }
  }

  all(): Note[] {
    return [...this.notes.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  get(id: string) {
    return this.notes.get(id);
  }
  save(note: Note) {
    note.updatedAt = new Date().toISOString();
    this.notes.set(note.id, note);
    this.persist();
  }
  remove(id: string) {
    this.notes.delete(id);
    this.persist();
  }
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private persist() {
    this.version++;
    localStorage.setItem(KEY, JSON.stringify([...this.notes.values()]));
    this.listeners.forEach((l) => l());
  }
}

export const store = new Store();

/** Rendert neu, sobald sich Notizen ändern. */
export function useNotes(): Note[] {
  const [, set] = useState(0);
  useEffect(() => store.subscribe(() => set((v) => v + 1)), []);
  return store.all();
}
