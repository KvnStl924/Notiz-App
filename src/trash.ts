import { useEffect, useState } from 'preact/hooks';
import type { Note } from './model';

/**
 * Papierkorb für gelöschte Rezepte und Notizen. Einträge bleiben TRASH_DAYS Tage erhalten
 * und werden danach automatisch endgültig gelöscht (beim Öffnen der App geprüft).
 * Der Papierkorb liegt auf diesem Gerät; gelöscht wird auf beiden Geräten gleich.
 */

export const TRASH_DAYS = 30;
const DAY = 86_400_000;
const KEY = 'notiz.trash.v1';

export interface TrashEntry {
  note: Note;
  /** ISO-Zeitpunkt des Löschens */
  deletedAt: string;
}

/** Entfernt alles, was älter als TRASH_DAYS ist. */
export function purgeExpired(entries: TrashEntry[], now = Date.now()): TrashEntry[] {
  return entries.filter((e) => now - Date.parse(e.deletedAt) < TRASH_DAYS * DAY);
}

/** Ganze Tage, die noch bleiben (mindestens 0). */
export function daysLeft(entry: TrashEntry, now = Date.now()): number {
  return Math.max(0, Math.ceil((Date.parse(entry.deletedAt) + TRASH_DAYS * DAY - now) / DAY));
}

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

class Trash {
  private entries: TrashEntry[] = [];
  private listeners = new Set<() => void>();

  constructor() {
    try {
      const raw = storage.get(KEY);
      if (raw) this.entries = JSON.parse(raw) as TrashEntry[];
    } catch {
      this.entries = [];
    }
    this.entries = purgeExpired(this.entries);
    this.persist();
  }

  /** Einträge, neueste zuerst. Abgelaufene werden vorher entfernt. */
  list(): TrashEntry[] {
    const before = this.entries.length;
    this.entries = purgeExpired(this.entries);
    if (this.entries.length !== before) this.persist();
    return [...this.entries].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  }

  count(): number {
    return this.list().length;
  }

  add(note: Note, now = new Date()) {
    // Gleiche Notiz nicht doppelt führen
    this.entries = this.entries.filter((e) => e.note.id !== note.id);
    this.entries.push({ note, deletedAt: now.toISOString() });
    this.persist();
  }

  /** Eintrag herausnehmen (zum Wiederherstellen) und zurückgeben. */
  take(id: string): Note | undefined {
    const e = this.entries.find((x) => x.note.id === id);
    if (!e) return undefined;
    this.entries = this.entries.filter((x) => x.note.id !== id);
    this.persist();
    return e.note;
  }

  /** Endgültig löschen. */
  forever(id: string) {
    this.entries = this.entries.filter((x) => x.note.id !== id);
    this.persist();
  }

  empty() {
    this.entries = [];
    this.persist();
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private persist() {
    storage.set(KEY, JSON.stringify(this.entries));
    this.listeners.forEach((l) => l());
  }
}

export const trash = new Trash();

/** Rendert neu, sobald sich der Papierkorb ändert. */
export function useTrash(): TrashEntry[] {
  const [, set] = useState(0);
  useEffect(() => {
    const off = trash.subscribe(() => set((v) => v + 1));
    set((v) => v + 1);
    return off;
  }, []);
  return trash.list();
}
